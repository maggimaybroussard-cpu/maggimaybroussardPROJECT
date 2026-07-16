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
  inquiry_id: string | null;
  created_at: string;
  contact_inquiries?: {
    name: string;
    email: string;
    service: string;
    booking_stage: string;
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

interface ClientInvoiceGroup {
  clientName: string;
  clientEmail: string;
  service: string;
  inquiryId: string | null;
  invoices: Invoice[];
  retainer: RetainerSubscription | null;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  hasOverdue: boolean;
  overdueCount: number;
  overdueAmount: number;
  pendingCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const color = pct === 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Overdue Alert Banner ─────────────────────────────────────────────────────

function OverdueAlertBanner({ groups }: { groups: ClientInvoiceGroup[] }) {
  const overdueGroups = groups.filter((g) => g.hasOverdue);
  if (overdueGroups.length === 0) return null;

  const totalOverdue = overdueGroups.reduce((sum, g) => sum + g.overdueAmount, 0);

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-700">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-red-800">
            {overdueGroups.reduce((sum, g) => sum + g.overdueCount, 0)} Overdue Invoice{overdueGroups.reduce((sum, g) => sum + g.overdueCount, 0) !== 1 ? 's' : ''} across {overdueGroups.length} client{overdueGroups.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-red-600 mt-0.5">{fmt(totalOverdue)} total outstanding past due date</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {overdueGroups.map((g) => {
          const overdueInvoices = g.invoices.filter((inv) => inv.status === 'overdue' || (inv.status === 'pending' && daysOverdue(inv.due_date) > 0));
          return overdueInvoices.map((inv) => {
            const days = daysOverdue(inv.due_date);
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 bg-white/70 border border-red-100 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-800 truncate">{g.clientName}</p>
                  <p className="text-[10px] text-red-600">{inv.invoice_number} · Due {fmtDate(inv.due_date)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-bold text-red-800">{fmt(inv.amount - inv.amount_paid)}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold border border-red-200">
                    {days}d overdue
                  </span>
                </div>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

// ─── Client Invoice Card ──────────────────────────────────────────────────────

function ClientInvoiceCard({ group }: { group: ClientInvoiceGroup }) {
  const [expanded, setExpanded] = useState(false);
  const collectionRate = group.totalBilled > 0 ? Math.round((group.totalPaid / group.totalBilled) * 100) : 0;

  const retainerBadge = group.retainer
    ? group.retainer.status === 'active'
      ? { label: 'Active Retainer', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : { label: 'Retainer ' + group.retainer.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
    : null;

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all duration-200 ${group.hasOverdue ? 'border-red-200 shadow-sm shadow-red-50' : 'border-border'}`}>
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="font-semibold text-foreground text-sm truncate">{group.clientName}</h3>
              {group.hasOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  {group.overdueCount} Overdue
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{group.clientEmail}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{group.service}</p>
          </div>
          {retainerBadge && (
            <span className={`inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-semibold shrink-0 ${retainerBadge.cls}`}>
              {retainerBadge.label}
            </span>
          )}
        </div>

        {/* Amounts Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-secondary/40 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Billed</p>
            <p className="text-sm font-bold text-foreground">{fmt(group.totalBilled)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-0.5">Received</p>
            <p className="text-sm font-bold text-emerald-700">{fmt(group.totalPaid)}</p>
          </div>
          <div className={`rounded-xl p-2.5 text-center ${group.totalDue > 0 ? (group.hasOverdue ? 'bg-red-50' : 'bg-amber-50') : 'bg-secondary/40'}`}>
            <p className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${group.totalDue > 0 ? (group.hasOverdue ? 'text-red-600' : 'text-amber-600') : 'text-muted-foreground'}`}>Due</p>
            <p className={`text-sm font-bold ${group.totalDue > 0 ? (group.hasOverdue ? 'text-red-700' : 'text-amber-700') : 'text-muted-foreground'}`}>{fmt(group.totalDue)}</p>
          </div>
        </div>

        {/* Collection Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-medium">Collection rate</span>
            <span className={`text-[10px] font-bold ${collectionRate === 100 ? 'text-emerald-600' : collectionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{collectionRate}%</span>
          </div>
          <ProgressBar paid={group.totalPaid} total={group.totalBilled} />
        </div>

        {/* Retainer Info */}
        {group.retainer && (
          <div className="bg-secondary/30 rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Retainer</p>
              <p className="text-xs font-semibold text-foreground truncate">{group.retainer.plan_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-foreground">{fmt(group.retainer.amount)}<span className="text-[10px] text-muted-foreground font-normal">/mo</span></p>
              {group.retainer.current_period_end && (
                <p className="text-[10px] text-muted-foreground">Renews {fmtDate(group.retainer.current_period_end)}</p>
              )}
            </div>
          </div>
        )}

        {/* Invoice count summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}</span>
          {group.pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
              {group.pendingCount} pending
            </span>
          )}
          {group.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold">
              {group.overdueCount} overdue
            </span>
          )}
        </div>
      </div>

      {/* Expand Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors text-xs text-muted-foreground font-medium"
      >
        <span>{expanded ? 'Hide invoices' : 'View all invoices'}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded Invoice List */}
      {expanded && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {group.invoices.length === 0 ? (
            <p className="px-5 py-4 text-xs text-muted-foreground text-center">No invoices found</p>
          ) : (
            group.invoices.map((inv) => {
              const isOverdueNow = inv.status === 'pending' && daysOverdue(inv.due_date) > 0;
              const effectiveStatus = isOverdueNow ? 'overdue' : inv.status;
              const days = effectiveStatus === 'overdue' ? daysOverdue(inv.due_date) : 0;
              const remaining = inv.amount - inv.amount_paid;

              return (
                <div key={inv.id} className={`px-5 py-3 ${effectiveStatus === 'overdue' ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{inv.invoice_number}</span>
                        <StatusBadge status={effectiveStatus} />
                        {days > 0 && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200">
                            {days}d overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Issued {fmtDate(inv.invoice_date)} · Due {fmtDate(inv.due_date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">{fmt(inv.amount)}</p>
                      {inv.amount_paid > 0 && inv.amount_paid < inv.amount && (
                        <p className="text-[10px] text-emerald-600">{fmt(inv.amount_paid)} paid</p>
                      )}
                      {remaining > 0 && inv.status !== 'paid' && (
                        <p className={`text-[10px] font-semibold ${effectiveStatus === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>{fmt(remaining)} due</p>
                      )}
                    </div>
                  </div>
                  {inv.amount > 0 && (
                    <ProgressBar paid={inv.amount_paid} total={inv.amount} />
                  )}
                  {effectiveStatus === 'overdue' && (
                    <div className="mt-2">
                      <a
                        href={`mailto:${group.clientEmail}?subject=Invoice ${inv.invoice_number} — Payment Overdue&body=Hi ${group.clientName},%0A%0AThis is a reminder that invoice ${inv.invoice_number} for ${fmt(remaining)} was due on ${fmtDate(inv.due_date)} and is now ${days} days overdue.%0A%0APlease arrange payment at your earliest convenience.%0A%0AThank you.`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-700 text-white text-[10px] font-bold hover:bg-red-800 transition-colors"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        Send Reminder
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function SummaryStats({ groups }: { groups: ClientInvoiceGroup[] }) {
  const totalBilled = groups.reduce((s, g) => s + g.totalBilled, 0);
  const totalPaid = groups.reduce((s, g) => s + g.totalPaid, 0);
  const totalDue = groups.reduce((s, g) => s + g.totalDue, 0);
  const totalOverdue = groups.reduce((s, g) => s + g.overdueAmount, 0);
  const overdueClients = groups.filter((g) => g.hasOverdue).length;
  const activeRetainers = groups.filter((g) => g.retainer?.status === 'active').length;

  const stats = [
    { label: 'Total Billed', value: fmt(totalBilled), sub: `${groups.length} client${groups.length !== 1 ? 's' : ''}`, color: 'text-foreground', bg: 'bg-card' },
    { label: 'Collected', value: fmt(totalPaid), sub: totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% collection rate` : '—', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Outstanding', value: fmt(totalDue), sub: `${groups.filter((g) => g.pendingCount > 0).length} client${groups.filter((g) => g.pendingCount > 0).length !== 1 ? 's' : ''} with open invoices`, color: totalDue > 0 ? 'text-amber-700' : 'text-foreground', bg: totalDue > 0 ? 'bg-amber-50' : 'bg-card' },
    { label: 'Overdue', value: fmt(totalOverdue), sub: `${overdueClients} client${overdueClients !== 1 ? 's' : ''} past due`, color: totalOverdue > 0 ? 'text-red-700' : 'text-foreground', bg: totalOverdue > 0 ? 'bg-red-50' : 'bg-card' },
    { label: 'Active Retainers', value: String(activeRetainers), sub: `of ${groups.length} engagement${groups.length !== 1 ? 's' : ''}`, color: 'text-foreground', bg: 'bg-card' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} border border-border rounded-2xl px-4 py-4`}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{s.label}</p>
          <p className={`text-2xl font-bold ${s.color} leading-none mb-1`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientInvoicesDashboard() {
  const [groups, setGroups] = useState<ClientInvoiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'paid' | 'retainer'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'overdue' | 'due' | 'billed'>('overdue');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [invoicesRes, retainersRes] = await Promise.all([
        supabase
          .from('client_invoices')
          .select(`
            id, invoice_number, invoice_date, due_date, amount, amount_paid,
            status, notes, inquiry_id, created_at,
            contact_inquiries (name, email, service, booking_stage)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, status, current_period_start, current_period_end, inquiry_id')
          .in('status', ['active', 'past_due', 'trialing']),
      ]);

      if (invoicesRes.error) throw new Error(invoicesRes.error.message);

      const invoices: Invoice[] = (invoicesRes.data || []) as Invoice[];
      const retainers: RetainerSubscription[] = (retainersRes.data || []) as RetainerSubscription[];

      // Group invoices by client (using inquiry_id or email fallback)
      const groupMap = new Map<string, ClientInvoiceGroup>();

      for (const inv of invoices) {
        const clientInfo = inv.contact_inquiries;
        const key = inv.inquiry_id ?? (clientInfo?.email ?? 'unknown');
        const clientName = clientInfo?.name ?? 'Unknown Client';
        const clientEmail = clientInfo?.email ?? '';
        const service = clientInfo?.service ?? '—';

        if (!groupMap.has(key)) {
          const retainer = retainers.find((r) => r.inquiry_id === inv.inquiry_id || r.customer_email === clientEmail) ?? null;
          groupMap.set(key, {
            clientName,
            clientEmail,
            service,
            inquiryId: inv.inquiry_id,
            invoices: [],
            retainer,
            totalBilled: 0,
            totalPaid: 0,
            totalDue: 0,
            hasOverdue: false,
            overdueCount: 0,
            overdueAmount: 0,
            pendingCount: 0,
          });
        }

        const group = groupMap.get(key)!;
        group.invoices.push(inv);

        const isOverdueNow = inv.status === 'pending' && daysOverdue(inv.due_date) > 0;
        const effectiveStatus = isOverdueNow ? 'overdue' : inv.status;

        if (effectiveStatus !== 'cancelled') {
          group.totalBilled += Number(inv.amount);
          group.totalPaid += Number(inv.amount_paid);
          const remaining = Number(inv.amount) - Number(inv.amount_paid);
          if (effectiveStatus !== 'paid') {
            group.totalDue += remaining;
          }
          if (effectiveStatus === 'overdue') {
            group.hasOverdue = true;
            group.overdueCount += 1;
            group.overdueAmount += remaining;
          }
          if (effectiveStatus === 'pending') {
            group.pendingCount += 1;
          }
        }
      }

      // Also include retainer clients with no invoices
      for (const ret of retainers) {
        const key = ret.inquiry_id ?? ret.customer_email;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            clientName: ret.customer_name,
            clientEmail: ret.customer_email,
            service: ret.plan_name,
            inquiryId: ret.inquiry_id,
            invoices: [],
            retainer: ret,
            totalBilled: 0,
            totalPaid: 0,
            totalDue: 0,
            hasOverdue: false,
            overdueCount: 0,
            overdueAmount: 0,
            pendingCount: 0,
          });
        }
      }

      setGroups(Array.from(groupMap.values()));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtering & Sorting ───────────────────────────────────────────────────

  const filtered = groups
    .filter((g) => {
      const matchSearch =
        !search ||
        g.clientName.toLowerCase().includes(search.toLowerCase()) ||
        g.clientEmail.toLowerCase().includes(search.toLowerCase()) ||
        g.service.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'overdue' && g.hasOverdue) ||
        (statusFilter === 'pending' && g.pendingCount > 0) ||
        (statusFilter === 'paid' && g.totalBilled > 0 && g.totalDue === 0) ||
        (statusFilter === 'retainer' && g.retainer !== null);
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'overdue') {
        if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
        return b.overdueAmount - a.overdueAmount;
      }
      if (sortBy === 'due') return b.totalDue - a.totalDue;
      if (sortBy === 'billed') return b.totalBilled - a.totalBilled;
      return a.clientName.localeCompare(b.clientName);
    });

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-56 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-red-800 mb-1">Failed to load invoice data</p>
        <p className="text-xs text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <SummaryStats groups={groups} />

      {/* Overdue Alert Banner */}
      <OverdueAlertBanner groups={filtered} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
            {(['all', 'overdue', 'pending', 'paid', 'retainer'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  statusFilter === f
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f === 'retainer' ? 'Retainer' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="overdue">Sort: Overdue first</option>
            <option value="due">Sort: Most due</option>
            <option value="billed">Sort: Most billed</option>
            <option value="name">Sort: Name A–Z</option>
          </select>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {groups.length} client engagement{groups.length !== 1 ? 's' : ''}
        </p>
        {filtered.filter((g) => g.hasOverdue).length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {filtered.filter((g) => g.hasOverdue).length} with overdue invoices
          </span>
        )}
      </div>

      {/* Client Invoice Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No invoices found</p>
          <p className="text-xs text-muted-foreground">
            {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Client invoices will appear here once created'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((group) => (
            <ClientInvoiceCard
              key={group.inquiryId ?? group.clientEmail}
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  );
}
