'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  line_items: InvoiceLineItem[];
  created_at: string;
  inquiry_id: string | null;
  contact_inquiries?: {
    name: string;
    email: string;
    service: string;
    booking_stage: string;
  } | null;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  time_log_id?: string;
  work_type?: string;
}

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  work_type?: string;
  case_task?: string | null;
  invoice_id?: string | null;
  billed_at?: string | null;
  hourly_rate?: number | null;
  retainer_subscriptions?: {
    customer_name: string;
    plan_name: string;
    amount: number;
  } | null;
}

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  inquiry_id: string | null;
}

interface CaseInvoiceSummary {
  inquiryId: string;
  clientName: string;
  clientEmail: string;
  service: string;
  invoices: Invoice[];
  timeLogs: TimeLog[];
  retainer: RetainerSubscription | null;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  unbilledHours: number;
  unbilledAmount: number;
  retainerBalance: number;
  retainerUsedHours: number;
  retainerTotalHours: number;
  hasOverdue: boolean;
  latestDueDate: string | null;
  daysOverdue: number;
}

interface LateAlert {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  service: string;
}

interface DashboardStats {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  pendingCount: number;
  unbilledHours: number;
  unbilledAmount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const RETAINER_TIER_HOURS: Record<string, number> = {
  essential: 10, standard: 20, 'full-service': 40, full_service: 40, 'monthly retainer': 10,
};

function getTierHours(planName: string, amount: number): number {
  const key = planName?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (RETAINER_TIER_HOURS[key]) return RETAINER_TIER_HOURS[key];
  const amt = Math.round(Number(amount));
  if (amt >= 2800) return 40;
  if (amt >= 1500) return 20;
  if (amt >= 750) return 10;
  if (amt >= 500) return 5;
  return 10;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Late Payment Alert Banner ────────────────────────────────────────────────

function LateAlertBanner({ alerts, onDismiss }: { alerts: LateAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-700">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-red-800">
            {alerts.length} Late Payment{alerts.length !== 1 ? 's' : ''} Require Attention
          </p>
          <p className="text-xs text-red-600 mt-0.5">Invoices past their due date — follow up or send reminders</p>
        </div>
      </div>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.invoiceId} className="flex items-center justify-between gap-3 bg-white/70 border border-red-100 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-red-800">{alert.invoiceNumber}</span>
                <span className="text-xs text-red-600">·</span>
                <span className="text-xs font-semibold text-red-700">{alert.clientName}</span>
                <span className="text-xs text-red-500 hidden sm:inline">({alert.service})</span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-red-600">Due {fmtDate(alert.dueDate)}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
                  {alert.daysOverdue}d overdue
                </span>
                <span className="text-xs font-semibold text-red-800">{fmt(alert.amount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`mailto:${alert.clientEmail}?subject=Invoice ${alert.invoiceNumber} — Payment Overdue&body=Hi, this is a reminder that invoice ${alert.invoiceNumber} for ${fmt(alert.amount)} was due on ${fmtDate(alert.dueDate)} and is now ${alert.daysOverdue} days overdue. Please arrange payment at your earliest convenience.`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Remind
              </a>
              <button
                onClick={() => onDismiss(alert.invoiceId)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-700 hover:bg-red-100 transition-colors"
                title="Dismiss alert"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upcoming Due Warning ─────────────────────────────────────────────────────

function UpcomingDueBanner({ invoices }: { invoices: Invoice[] }) {
  const upcoming = invoices.filter((inv) => {
    if (inv.status !== 'pending') return false;
    const days = daysUntilDue(inv.due_date);
    return days >= 0 && days <= 7;
  });
  if (upcoming.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">
          {upcoming.length} Invoice{upcoming.length !== 1 ? 's' : ''} Due Within 7 Days
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {upcoming.map((inv) => {
            const days = daysUntilDue(inv.due_date);
            const client = inv.contact_inquiries?.name ?? 'Client';
            return `${inv.invoice_number} (${client}) — ${days === 0 ? 'due today' : `${days}d`}`;
          }).join(' · ')}
        </p>
      </div>
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ stats, loading }: { stats: DashboardStats; loading: boolean }) {
  const cards = [
    {
      label: 'Total Invoiced', value: fmt(stats.totalInvoiced), sub: 'all time',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
      iconBg: 'bg-slate-100 text-slate-600',
    },
    {
      label: 'Collected', value: fmt(stats.totalCollected), sub: 'payments received',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Outstanding', value: fmt(stats.totalOutstanding), sub: `${stats.pendingCount} pending`,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
      iconBg: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Overdue', value: fmt(stats.totalOverdue), sub: `${stats.overdueCount} invoice${stats.overdueCount !== 1 ? 's' : ''}`,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
      iconBg: stats.overdueCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500',
    },
    {
      label: 'Unbilled Hours', value: `${stats.unbilledHours.toFixed(1)} hrs`, sub: fmt(stats.unbilledAmount) + ' potential',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
      iconBg: 'bg-violet-100 text-violet-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`bg-card border rounded-2xl p-5 ${c.label === 'Overdue' && stats.overdueCount > 0 ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.iconBg}`}>{c.icon}</div>
          {loading ? (
            <div className="h-6 w-20 bg-secondary animate-pulse rounded-lg" />
          ) : (
            <p className="text-xl font-bold text-foreground">{c.value}</p>
          )}
          <p className="text-xs text-muted-foreground font-medium mt-0.5">{c.label}</p>
          {!loading && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Case Invoice Card ────────────────────────────────────────────────────────

function CaseInvoiceCard({ summary, onMarkPaid }: { summary: CaseInvoiceSummary; onMarkPaid: (invoiceId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const retainerPct = summary.retainerTotalHours > 0
    ? Math.min(100, (summary.retainerUsedHours / summary.retainerTotalHours) * 100)
    : 0;
  const retainerColor = retainerPct >= 90 ? '#dc2626' : retainerPct >= 75 ? '#d97706' : '#355E3B';

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${summary.hasOverdue ? 'border-red-200' : 'border-border'}`}>
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 p-5 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-bold text-foreground">{summary.clientName}</p>
            {summary.hasOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{summary.service}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{summary.invoices.length}</span> invoice{summary.invoices.length !== 1 ? 's' : ''}
            </span>
            {summary.unbilledHours > 0 && (
              <span className="text-xs text-violet-600 font-semibold">
                {summary.unbilledHours.toFixed(1)} hrs unbilled
              </span>
            )}
            {summary.retainer && (
              <span className="text-xs text-muted-foreground">
                Retainer: <span className="font-semibold text-foreground">{summary.retainerUsedHours.toFixed(1)}/{summary.retainerTotalHours} hrs</span>
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-foreground">{fmt(summary.totalBilled)}</p>
          <p className="text-xs text-emerald-600 font-semibold">{fmt(summary.totalPaid)} paid</p>
          {summary.totalOutstanding > 0 && (
            <p className={`text-xs font-semibold ${summary.hasOverdue ? 'text-red-600' : 'text-amber-600'}`}>
              {fmt(summary.totalOutstanding)} due
            </p>
          )}
        </div>
        <div className="shrink-0 mt-1">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Retainer Balance Bar */}
      {summary.retainer && (
        <div className="px-5 pb-3 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-muted-foreground uppercase tracking-widest text-[10px]">Retainer Balance</span>
            <span className="font-semibold" style={{ color: retainerColor }}>
              {(summary.retainerTotalHours - summary.retainerUsedHours).toFixed(1)} hrs remaining
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${retainerPct}%`, background: retainerColor }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{summary.retainerUsedHours.toFixed(1)} hrs used</span>
            <span>{summary.retainer.plan_name} · {fmt(summary.retainer.amount)}/mo</span>
          </div>
        </div>
      )}

      {/* Expanded: Invoices + Time Logs */}
      {expanded && (
        <div className="border-t border-border">
          {/* Invoices */}
          <div className="p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoices</p>
            {summary.invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.invoices.map((inv) => {
                  const overdueDays = inv.status !== 'paid' && inv.status !== 'cancelled' ? daysOverdue(inv.due_date) : 0;
                  const dueSoon = inv.status === 'pending' && daysUntilDue(inv.due_date) <= 7 && daysUntilDue(inv.due_date) >= 0;
                  return (
                    <div key={inv.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${overdueDays > 0 ? 'bg-red-50/50 border-red-100' : dueSoon ? 'bg-amber-50/50 border-amber-100' : 'bg-secondary/20 border-border/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{inv.invoice_number}</span>
                          <StatusBadge status={inv.status} />
                          {overdueDays > 0 && (
                            <span className="text-[10px] font-bold text-red-600">{overdueDays}d overdue</span>
                          )}
                          {dueSoon && (
                            <span className="text-[10px] font-bold text-amber-600">due in {daysUntilDue(inv.due_date)}d</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>Issued {fmtDate(inv.invoice_date)}</span>
                          <span>Due {fmtDate(inv.due_date)}</span>
                          {inv.line_items?.length > 0 && <span>{inv.line_items.length} line item{inv.line_items.length !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{fmt(inv.amount)}</p>
                        {inv.amount_paid > 0 && inv.amount_paid < inv.amount && (
                          <p className="text-[10px] text-emerald-600">{fmt(inv.amount_paid)} paid</p>
                        )}
                        {inv.status === 'pending' || inv.status === 'overdue' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onMarkPaid(inv.id); }}
                            className="mt-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                          >
                            Mark Paid
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Billable Hours */}
          {summary.timeLogs.length > 0 && (
            <div className="px-5 pb-5 space-y-3 border-t border-border/50 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Billable Hours</p>
                {summary.unbilledHours > 0 && (
                  <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                    {summary.unbilledHours.toFixed(1)} hrs unbilled · {fmt(summary.unbilledAmount)}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {summary.timeLogs.slice(0, 8).map((log) => {
                  const isBilled = !!log.billed_at || !!log.invoice_id;
                  const rawDesc = log.description ?? '';
                  const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
                  const cleanDesc = typeMatch ? rawDesc.replace(typeMatch[0], '').trim() : rawDesc;
                  const rate = log.hourly_rate ?? 0;
                  const lineAmt = rate > 0 ? Number(log.hours) * rate : 0;
                  return (
                    <div key={log.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${isBilled ? 'bg-emerald-50/40 border-emerald-100' : 'bg-secondary/20 border-border/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{Number(log.hours).toFixed(1)} hrs</span>
                          {log.work_type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50 capitalize">{log.work_type}</span>
                          )}
                          {log.case_task && <span className="text-muted-foreground truncate max-w-[120px]">{log.case_task}</span>}
                        </div>
                        {cleanDesc && <p className="text-muted-foreground truncate mt-0.5">{cleanDesc}</p>}
                        <p className="text-muted-foreground/60 mt-0.5">{fmtDate(log.work_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {lineAmt > 0 && <p className="font-semibold text-foreground">{fmt(lineAmt)}</p>}
                        {isBilled ? (
                          <span className="text-[10px] text-emerald-600 font-semibold">Billed</span>
                        ) : (
                          <span className="text-[10px] text-violet-600 font-semibold">Unbilled</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {summary.timeLogs.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center py-1">+{summary.timeLogs.length - 8} more entries</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceTrackingDashboard() {
  const [caseSummaries, setCaseSummaries] = useState<CaseInvoiceSummary[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [lateAlerts, setLateAlerts] = useState<LateAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<DashboardStats>({
    totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0, totalOverdue: 0,
    overdueCount: 0, pendingCount: 0, unbilledHours: 0, unbilledAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'paid' | 'unbilled'>('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [invoicesRes, timeLogsRes, retainersRes] = await Promise.all([
        supabase
          .from('client_invoices')
          .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, status, notes, line_items, created_at, inquiry_id, contact_inquiries(name, email, service, booking_stage)')
          .order('created_at', { ascending: false }),
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, inquiry_id, hours, description, work_date, work_type, case_task, invoice_id, billed_at, hourly_rate, retainer_subscriptions(customer_name, plan_name, amount)')
          .order('work_date', { ascending: false }),
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, status, current_period_start, current_period_end, inquiry_id')
          .in('status', ['active', 'past_due', 'trialing']),
      ]);

      if (invoicesRes.error) throw new Error(invoicesRes.error.message);
      if (timeLogsRes.error) throw new Error(timeLogsRes.error.message);
      if (retainersRes.error) throw new Error(retainersRes.error.message);

      const invoices: Invoice[] = (invoicesRes.data || []).map((inv) => ({
        ...inv,
        contact_inquiries: Array.isArray(inv.contact_inquiries) ? inv.contact_inquiries[0] ?? null : inv.contact_inquiries,
      }));
      const timeLogs: TimeLog[] = (timeLogsRes.data || []).map((log) => ({
        ...log,
        retainer_subscriptions: Array.isArray(log.retainer_subscriptions) ? log.retainer_subscriptions[0] ?? null : log.retainer_subscriptions,
      }));
      const retainers: RetainerSubscription[] = retainersRes.data || [];

      setAllInvoices(invoices);

      // Build per-case summaries
      const caseMap: Record<string, CaseInvoiceSummary> = {};

      // Seed from invoices
      invoices.forEach((inv) => {
        const key = inv.inquiry_id ?? `no-case-${inv.id}`;
        if (!caseMap[key]) {
          caseMap[key] = {
            inquiryId: inv.inquiry_id ?? '',
            clientName: inv.contact_inquiries?.name ?? 'Unknown Client',
            clientEmail: inv.contact_inquiries?.email ?? '',
            service: inv.contact_inquiries?.service ?? '—',
            invoices: [],
            timeLogs: [],
            retainer: null,
            totalBilled: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            unbilledHours: 0,
            unbilledAmount: 0,
            retainerBalance: 0,
            retainerUsedHours: 0,
            retainerTotalHours: 0,
            hasOverdue: false,
            latestDueDate: null,
            daysOverdue: 0,
          };
        }
        caseMap[key].invoices.push(inv);
      });

      // Attach time logs
      timeLogs.forEach((log) => {
        const key = log.inquiry_id ?? `sub-${log.retainer_subscription_id}`;
        if (!caseMap[key]) {
          const sub = retainers.find((r) => r.id === log.retainer_subscription_id);
          const logSub = log.retainer_subscriptions as { customer_name: string; plan_name: string; amount: number } | null;
          caseMap[key] = {
            inquiryId: log.inquiry_id ?? '',
            clientName: logSub?.customer_name ?? sub?.customer_name ?? 'Unknown Client',
            clientEmail: sub?.customer_email ?? '',
            service: sub?.plan_name ?? '—',
            invoices: [],
            timeLogs: [],
            retainer: sub ?? null,
            totalBilled: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            unbilledHours: 0,
            unbilledAmount: 0,
            retainerBalance: 0,
            retainerUsedHours: 0,
            retainerTotalHours: 0,
            hasOverdue: false,
            latestDueDate: null,
            daysOverdue: 0,
          };
        }
        caseMap[key].timeLogs.push(log);
      });

      // Attach retainers
      retainers.forEach((ret) => {
        const key = ret.inquiry_id ?? `ret-${ret.id}`;
        if (caseMap[key]) {
          caseMap[key].retainer = ret;
        }
      });

      // Compute aggregates
      const alerts: LateAlert[] = [];
      Object.values(caseMap).forEach((summary) => {
        summary.totalBilled = summary.invoices.reduce((s, i) => s + Number(i.amount), 0);
        summary.totalPaid = summary.invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
        summary.totalOutstanding = summary.invoices
          .filter((i) => i.status === 'pending' || i.status === 'overdue')
          .reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);

        // Overdue check
        const overdueInvoices = summary.invoices.filter((i) => {
          if (i.status === 'paid' || i.status === 'cancelled') return false;
          return daysOverdue(i.due_date) > 0;
        });
        summary.hasOverdue = overdueInvoices.length > 0;
        if (summary.hasOverdue) {
          summary.daysOverdue = Math.max(...overdueInvoices.map((i) => daysOverdue(i.due_date)));
        }

        // Late alerts
        overdueInvoices.forEach((inv) => {
          alerts.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            clientName: summary.clientName,
            clientEmail: summary.clientEmail,
            amount: Number(inv.amount) - Number(inv.amount_paid),
            dueDate: inv.due_date,
            daysOverdue: daysOverdue(inv.due_date),
            service: summary.service,
          });
        });

        // Retainer hours
        if (summary.retainer) {
          const totalHrs = getTierHours(summary.retainer.plan_name, summary.retainer.amount);
          const usedHrs = summary.timeLogs.reduce((s, l) => s + Number(l.hours), 0);
          summary.retainerTotalHours = totalHrs;
          summary.retainerUsedHours = usedHrs;
          summary.retainerBalance = Math.max(0, totalHrs - usedHrs) * (totalHrs > 0 ? Number(summary.retainer.amount) / totalHrs : 0);
        }

        // Unbilled hours
        const unbilledLogs = summary.timeLogs.filter((l) => !l.billed_at && !l.invoice_id);
        summary.unbilledHours = unbilledLogs.reduce((s, l) => s + Number(l.hours), 0);
        summary.unbilledAmount = unbilledLogs.reduce((s, l) => {
          const rate = l.hourly_rate ?? 0;
          return s + (rate > 0 ? Number(l.hours) * rate : 0);
        }, 0);
      });

      // Sort: overdue first, then by outstanding desc
      const sorted = Object.values(caseMap).sort((a, b) => {
        if (a.hasOverdue && !b.hasOverdue) return -1;
        if (!a.hasOverdue && b.hasOverdue) return 1;
        return b.totalOutstanding - a.totalOutstanding;
      });

      setCaseSummaries(sorted);
      setLateAlerts(alerts.sort((a, b) => b.daysOverdue - a.daysOverdue));

      // Stats
      const allInvs = invoices;
      const totalInvoiced = allInvs.reduce((s, i) => s + Number(i.amount), 0);
      const totalCollected = allInvs.reduce((s, i) => s + Number(i.amount_paid), 0);
      const pendingInvs = allInvs.filter((i) => i.status === 'pending');
      const overdueInvs = allInvs.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && daysOverdue(i.due_date) > 0);
      const totalOutstanding = pendingInvs.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);
      const totalOverdue = overdueInvs.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);
      const allUnbilledLogs = timeLogs.filter((l) => !l.billed_at && !l.invoice_id);
      const unbilledHours = allUnbilledLogs.reduce((s, l) => s + Number(l.hours), 0);
      const unbilledAmount = allUnbilledLogs.reduce((s, l) => {
        const rate = l.hourly_rate ?? 0;
        return s + (rate > 0 ? Number(l.hours) * rate : 0);
      }, 0);

      setStats({
        totalInvoiced, totalCollected, totalOutstanding, totalOverdue,
        overdueCount: overdueInvs.length, pendingCount: pendingInvs.length,
        unbilledHours, unbilledAmount,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice tracking data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const supabase = createClient();
      const inv = allInvoices.find((i) => i.id === invoiceId);
      if (!inv) return;
      const { error: updateError } = await supabase
        .from('client_invoices')
        .update({ status: 'paid', amount_paid: inv.amount, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);
      if (updateError) throw updateError;
      showToast('Invoice marked as paid.', 'success');
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update invoice.', 'error');
    }
  };

  const handleDismissAlert = (invoiceId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, invoiceId]));
  };

  const visibleAlerts = lateAlerts.filter((a) => !dismissedAlerts.has(a.invoiceId));

  const filtered = caseSummaries.filter((s) => {
    const matchSearch = !search ||
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.clientEmail.toLowerCase().includes(search.toLowerCase()) ||
      s.service.toLowerCase().includes(search.toLowerCase()) ||
      s.invoices.some((i) => i.invoice_number.toLowerCase().includes(search.toLowerCase()));
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'overdue' && s.hasOverdue) ||
      (statusFilter === 'pending' && s.invoices.some((i) => i.status === 'pending')) ||
      (statusFilter === 'paid' && s.invoices.every((i) => i.status === 'paid' || i.status === 'cancelled') && s.invoices.length > 0) ||
      (statusFilter === 'unbilled' && s.unbilledHours > 0);
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />)}
        </div>
        <div className="bg-card border border-border rounded-2xl h-48 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-card border border-border rounded-2xl h-24 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <StatsRow stats={stats} loading={false} />

      {/* Late Payment Alerts */}
      <LateAlertBanner alerts={visibleAlerts} onDismiss={handleDismissAlert} />

      {/* Upcoming Due Warning */}
      <UpcomingDueBanner invoices={allInvoices} />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by client, service, or invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'overdue', 'pending', 'paid', 'unbilled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                statusFilter === f
                  ? f === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All Cases' : f === 'unbilled' ? 'Unbilled Hours' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'overdue' && stats.overdueCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === 'overdue' ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>
                  {stats.overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Case Invoice Cards */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No invoices found</p>
          <p className="text-xs text-muted-foreground">
            {search || statusFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Create your first invoice using the Invoice Generator.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              {filtered.length} case{filtered.length !== 1 ? 's' : ''} · {filtered.reduce((s, c) => s + c.invoices.length, 0)} invoice{filtered.reduce((s, c) => s + c.invoices.length, 0) !== 1 ? 's' : ''}
            </p>
          </div>
          {filtered.map((summary) => (
            <CaseInvoiceCard
              key={summary.inquiryId || summary.clientName}
              summary={summary}
              onMarkPaid={handleMarkPaid}
            />
          ))}
        </div>
      )}
    </div>
  );
}
