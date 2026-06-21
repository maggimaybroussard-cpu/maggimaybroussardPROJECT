'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
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

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  work_type?: string;
  retainer_subscriptions?: {
    customer_name: string;
    plan_name: string;
  } | null;
}

interface LineItem {
  id: string;
  type: 'time_log' | 'retainer' | 'custom';
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  timeLogId?: string;
  workType?: string;
  workDate?: string;
}

interface InvoiceForm {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientFirm: string;
  clientService: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  lineItems: LineItem[];
}

interface ExistingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  created_at: string;
  inquiry_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  stripe_sync_status: string | null;
}

interface InvoiceReminder {
  id: string;
  invoice_id: string;
  inquiry_id: string | null;
  reminder_type: 'before_due' | 'after_due';
  trigger_days: number;
  scheduled_date: string;
  sent_at: string | null;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  resend_email_id: string | null;
  error_message: string | null;
  created_at: string;
  client_invoices?: {
    invoice_number: string;
    due_date: string;
    amount: number;
    status: string;
    contact_inquiries?: { name: string; email: string; service: string } | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900) + 100;
  return `INV-${y}${m}-${rand}`;
}

function workTypeLabel(wt: string | null | undefined) {
  const map: Record<string, string> = {
    research: 'Legal Research',
    drafting: 'Drafting',
    calls: 'Client Calls',
    review: 'Document Review',
    filing: 'Court Filing',
    discovery: 'Discovery',
    other: 'Other',
  };
  return map[wt ?? ''] ?? (wt ?? 'Other');
}

function statusBadge(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'overdue') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function reminderStatusBadge(status: string) {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'skipped') return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
  { value: 'net_7', label: 'Net 7', days: 7 },
  { value: 'net_15', label: 'Net 15', days: 15 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'net_45', label: 'Net 45', days: 45 },
  { value: 'net_60', label: 'Net 60', days: 60 },
];

const WORK_TYPES = [
  { value: 'research', label: 'Legal Research' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'calls', label: 'Client Calls' },
  { value: 'review', label: 'Document Review' },
  { value: 'filing', label: 'Court Filing' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'other', label: 'Other' },
];

function newLineItem(type: LineItem['type'] = 'custom'): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    description: '',
    quantity: 1,
    unit_price: 0,
    total: 0,
  };
}

// ─── Case Info Panel ──────────────────────────────────────────────────────────

function CaseInfoPanel({ client }: { client: Client }) {
  const statusColors: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    active_client: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    consultation_scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
    proposal_sent: 'bg-purple-50 text-purple-700 border-purple-200',
    closed: 'bg-gray-100 text-gray-500 border-gray-200',
    archived: 'bg-gray-100 text-gray-400 border-gray-200',
  };
  const statusLabel = client.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colorClass = statusColors[client.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="bg-[#FAF7F2] border border-[#4A3728]/15 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4A3728]/10 flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4A3728]">
              <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <p className="text-xs font-semibold text-[#4A3728] uppercase tracking-widest">Case Details</p>
        </div>
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${colorClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Service / Matter</p>
          <p className="text-sm font-semibold text-foreground">{client.service}</p>
        </div>
        {client.firm && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Organization</p>
            <p className="text-sm text-foreground">{client.firm}</p>
          </div>
        )}
      </div>

      {client.message && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Case Description</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{client.message}</p>
        </div>
      )}

      {client.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Admin Notes</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{client.notes}</p>
        </div>
      )}

      <div className="pt-1 border-t border-[#4A3728]/10">
        <p className="text-[10px] text-muted-foreground/60">
          Inquiry submitted {new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────

function InvoicePreview({ form }: { form: InvoiceForm }) {
  const subtotal = form.lineItems.reduce((s, li) => s + li.total, 0);
  const termLabel = PAYMENT_TERMS.find((t) => t.value === form.paymentTerms)?.label ?? form.paymentTerms;

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Letterhead header */}
      <div className="w-full">
        <Image
          src="/assets/images/letterhead-1780100512052.png"
          alt="Broussard Legal Services letterhead"
          width={1200}
          height={200}
          className="w-full h-auto block"
          priority
        />
      </div>

      {/* Invoice number banner */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-border bg-[#FAF7F2]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Invoice</p>
          <p className="text-xl font-serif font-semibold text-[#4A3728]">{form.invoiceNumber || 'INV-XXXX-XXX'}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-8 py-5 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Bill To</p>
          <p className="text-sm font-semibold text-foreground">{form.clientName || '—'}</p>
          {form.clientFirm && <p className="text-xs text-muted-foreground">{form.clientFirm}</p>}
          {form.clientEmail && <p className="text-xs text-muted-foreground">{form.clientEmail}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Invoice Date</p>
          <p className="text-sm text-foreground">{form.invoiceDate ? fmtDate(form.invoiceDate) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Due Date</p>
          <p className="text-sm text-foreground">{form.dueDate ? fmtDate(form.dueDate) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Payment Terms</p>
          <p className="text-sm text-foreground">{termLabel}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="px-8 py-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold pb-2 pr-4">Description</th>
              <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold pb-2 px-2 w-16">Qty</th>
              <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold pb-2 px-2 w-24">Rate</th>
              <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold pb-2 pl-2 w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {form.lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground text-xs italic">No line items added yet</td>
              </tr>
            ) : (
              form.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4">
                    <p className="text-foreground font-medium">{li.description || '—'}</p>
                    {li.workDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(li.workDate)}{li.workType ? ` · ${workTypeLabel(li.workType)}` : ''}</p>
                    )}
                    {li.type === 'retainer' && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-[#355E3B]/10 text-[#355E3B] font-semibold uppercase tracking-wide">Retainer</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-muted-foreground">{li.quantity}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">{fmt(li.unit_price)}</td>
                  <td className="py-3 pl-2 text-right font-semibold text-foreground">{fmt(li.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-56">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium text-foreground">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-base font-semibold text-foreground">Total Due</span>
              <span className="text-base font-bold text-[#355E3B]">{fmt(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {form.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{form.notes}</p>
          </div>
        )}
      </div>

      {/* Footer image */}
      <div className="w-full mt-2">
        <Image
          src="/assets/images/footer-1780100663536.png"
          alt="Broussard Legal Services footer"
          width={1200}
          height={120}
          className="w-full h-auto block"
        />
      </div>
    </div>
  );
}

// ─── Reminders Panel ──────────────────────────────────────────────────────────

function InvoiceRemindersPanel() {
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('invoice_reminders')
        .select(`
          id, invoice_id, inquiry_id, reminder_type, trigger_days, scheduled_date,
          sent_at, send_status, resend_email_id, error_message, created_at,
          client_invoices (
            invoice_number, due_date, amount, status,
            contact_inquiries ( name, email, service )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (fetchErr) throw fetchErr;
      setReminders((data as InvoiceReminder[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/schedule-invoice-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run reminders');
      setRunResult(data.summary);
      fetchReminders();
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : 'Failed to run reminders.');
    } finally {
      setRunning(false);
    }
  };

  const filtered = reminders.filter((r) => filterStatus === 'all' || r.send_status === filterStatus);

  const pendingCount = reminders.filter((r) => r.send_status === 'pending').length;
  const sentCount = reminders.filter((r) => r.send_status === 'sent').length;
  const failedCount = reminders.filter((r) => r.send_status === 'failed').length;

  return (
    <div className="space-y-5">
      {/* Header + Run button */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-foreground font-semibold">Automated Invoice Reminders</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sends email reminders <strong>7 days before</strong> due date and <strong>3 days after</strong> due date to clients with unpaid invoices.
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {running ? (
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
          {running ? 'Running…' : 'Run Reminders Now'}
        </button>
      </div>

      {/* Schedule info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-widest mb-0.5">Before Due Reminder</p>
            <p className="text-sm font-semibold text-amber-900">7 Days Before Due Date</p>
            <p className="text-xs text-amber-700 mt-0.5">Friendly payment reminder sent to client email with portal link</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-800 uppercase tracking-widest mb-0.5">Overdue Reminder</p>
            <p className="text-sm font-semibold text-red-900">3 Days After Due Date</p>
            <p className="text-xs text-red-700 mt-0.5">Urgent overdue notice sent + invoice auto-marked as overdue</p>
          </div>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Reminders processed — {runResult.sent} sent, {runResult.skipped} skipped, {runResult.failed} failed.
        </div>
      )}
      {runError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {runError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">{pendingCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">Pending</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-[#355E3B]">{sentCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">Sent</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-red-600">{failedCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">Failed</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-xl w-fit">
        {(['all', 'pending', 'sent', 'failed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              filterStatus === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Reminders table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-14 text-center">
          <svg className="mx-auto mb-3 text-muted-foreground/40" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
          </svg>
          <p className="text-muted-foreground text-sm">No reminders found</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Run reminders to process pending invoices</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-3">Invoice</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Client</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Type</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Due Date</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Scheduled</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Sent At</th>
                  <th className="text-center text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const inv = r.client_invoices;
                  const client = (inv as any)?.contact_inquiries;
                  return (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground text-xs">
                        {inv?.invoice_number ?? '—'}
                        {inv?.amount && (
                          <p className="text-muted-foreground font-normal">{fmt(Number(inv.amount))}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-foreground font-medium text-xs">{client?.name ?? '—'}</p>
                        <p className="text-muted-foreground text-[10px]">{client?.email ?? ''}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        {r.reminder_type === 'before_due' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            7d Before
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            3d After
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground text-xs">{fmtDate(inv?.due_date ?? null)}</td>
                      <td className="px-3 py-3.5 text-muted-foreground text-xs">{fmtDate(r.scheduled_date)}</td>
                      <td className="px-3 py-3.5 text-muted-foreground text-xs">{r.sent_at ? fmtDate(r.sent_at) : '—'}</td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${reminderStatusBadge(r.send_status)}`}>
                          {r.send_status}
                        </span>
                        {r.error_message && (
                          <p className="text-[10px] text-red-500 mt-0.5 max-w-32 truncate" title={r.error_message}>{r.error_message}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceGeneratorDashboard() {
  const [view, setView] = useState<'generator' | 'history' | 'reminders'>('generator');

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [retainerSubs, setRetainerSubs] = useState<RetainerSubscription[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [existingInvoices, setExistingInvoices] = useState<ExistingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stripe sync state
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Form state
  const today = todayStr();
  const [form, setForm] = useState<InvoiceForm>({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientFirm: '',
    clientService: '',
    invoiceNumber: generateInvoiceNumber(),
    invoiceDate: today,
    dueDate: addDays(today, 30),
    paymentTerms: 'net_30',
    notes: 'Payment is due within the specified terms. Please make checks payable to Broussard Legal Services or pay via the secure client portal.',
    lineItems: [],
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedTimeLogs, setSelectedTimeLogs] = useState<Set<string>>(new Set());
  const [clientRetainerSub, setClientRetainerSub] = useState<RetainerSubscription | null>(null);
  const [clientTimeLogs, setClientTimeLogs] = useState<TimeLog[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [clientsRes, subsRes, logsRes, invoicesRes] = await Promise.all([
        supabase.from('contact_inquiries').select('id,name,firm,email,service,message,status,notes,created_at').order('name'),
        supabase.from('retainer_subscriptions').select('id,customer_name,customer_email,plan_name,amount,status,current_period_start,current_period_end,inquiry_id').eq('status', 'active').order('customer_name'),
        supabase.from('retainer_time_logs').select('id,retainer_subscription_id,hours,description,work_date,logged_at,retainer_subscriptions(customer_name,plan_name)').order('work_date', { ascending: false }),
        supabase.from('client_invoices').select('id,invoice_number,invoice_date,due_date,amount,amount_paid,status,notes,line_items,created_at,inquiry_id,stripe_invoice_id,stripe_invoice_url,stripe_sync_status').order('created_at', { ascending: false }),
      ]);
      setClients(clientsRes.data || []);
      setRetainerSubs(subsRes.data || []);
      const rawLogs = (logsRes.data || []) as TimeLog[];
      const parsedLogs = rawLogs.map((log) => {
        const match = (log.description ?? '').match(/^\[([^\]]+)\]/);
        return { ...log, work_type: match ? match[1] : 'other' };
      });
      setTimeLogs(parsedLogs);
      setExistingInvoices(invoicesRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!form.clientId) {
      setClientRetainerSub(null);
      setClientTimeLogs([]);
      setSelectedTimeLogs(new Set());
      return;
    }
    const sub = retainerSubs.find((s) => s.inquiry_id === form.clientId) ?? null;
    setClientRetainerSub(sub);
    if (sub) {
      const logs = timeLogs.filter((l) => l.retainer_subscription_id === sub.id);
      setClientTimeLogs(logs);
    } else {
      setClientTimeLogs([]);
    }
    setSelectedTimeLogs(new Set());
  }, [form.clientId, retainerSubs, timeLogs]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      setSelectedClient(null);
      setForm((f) => ({ ...f, clientId: '', clientName: '', clientEmail: '', clientFirm: '', clientService: '', lineItems: [] }));
      return;
    }
    setSelectedClient(client);

    // Auto-generate a service line item from the case data
    const serviceLineItem: LineItem = {
      id: Math.random().toString(36).slice(2),
      type: 'custom',
      description: `Legal Services — ${client.service}`,
      quantity: 1,
      unit_price: 0,
      total: 0,
    };

    setForm((f) => ({
      ...f,
      clientId,
      clientName: client.name,
      clientEmail: client.email,
      clientFirm: client.firm,
      clientService: client.service,
      lineItems: [serviceLineItem],
    }));
  }

  function handleTermsChange(terms: string) {
    const termDef = PAYMENT_TERMS.find((t) => t.value === terms);
    const newDue = termDef ? addDays(form.invoiceDate, termDef.days) : form.dueDate;
    setForm((f) => ({ ...f, paymentTerms: terms, dueDate: newDue }));
  }

  function handleInvoiceDateChange(date: string) {
    const termDef = PAYMENT_TERMS.find((t) => t.value === form.paymentTerms);
    const newDue = termDef ? addDays(date, termDef.days) : form.dueDate;
    setForm((f) => ({ ...f, invoiceDate: date, dueDate: newDue }));
  }

  function addCustomLineItem() {
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, newLineItem('custom')] }));
  }

  function addRetainerLineItem() {
    if (!clientRetainerSub) return;
    const existing = form.lineItems.find((li) => li.type === 'retainer');
    if (existing) return;
    const item: LineItem = {
      id: Math.random().toString(36).slice(2),
      type: 'retainer',
      description: `${clientRetainerSub.plan_name} — Monthly Retainer Fee`,
      quantity: 1,
      unit_price: Number(clientRetainerSub.amount),
      total: Number(clientRetainerSub.amount),
    };
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, item] }));
  }

  function toggleTimeLogSelection(logId: string) {
    setSelectedTimeLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
        setForm((f) => ({ ...f, lineItems: f.lineItems.filter((li) => li.timeLogId !== logId) }));
      } else {
        next.add(logId);
        const log = clientTimeLogs.find((l) => l.id === logId);
        if (log) {
          const wt = log.work_type ?? 'other';
          const rawDesc = log.description ?? '';
          const cleanDesc = rawDesc.replace(/^\[[^\]]+\]\s*/, '').trim() || `${workTypeLabel(wt)} — ${log.work_date}`;
          const hourlyRate = clientRetainerSub ? Math.round(Number(clientRetainerSub.amount) / 10) : 150;
          const item: LineItem = {
            id: Math.random().toString(36).slice(2),
            type: 'time_log',
            description: cleanDesc,
            quantity: Number(log.hours),
            unit_price: hourlyRate,
            total: Number(log.hours) * hourlyRate,
            timeLogId: logId,
            workType: wt,
            workDate: log.work_date,
          };
          setForm((f) => ({ ...f, lineItems: [...f.lineItems, item] }));
        }
      }
      return next;
    });
  }

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total = Number(updated.quantity) * Number(updated.unit_price);
        }
        return updated;
      }),
    }));
  }

  function removeLineItem(id: string) {
    const li = form.lineItems.find((l) => l.id === id);
    if (li?.timeLogId) {
      setSelectedTimeLogs((prev) => { const n = new Set(prev); n.delete(li.timeLogId!); return n; });
    }
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((l) => l.id !== id) }));
  }

  const subtotal = form.lineItems.reduce((s, li) => s + li.total, 0);

  async function handleSave() {
    if (!form.clientName || !form.clientEmail || form.lineItems.length === 0) {
      setActionError('Please select a client and add at least one line item.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('client_invoices').insert({
        inquiry_id: form.clientId || null,
        invoice_number: form.invoiceNumber,
        invoice_date: form.invoiceDate,
        due_date: form.dueDate,
        amount: subtotal,
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
        line_items: form.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total: li.total,
        })),
        notes: form.notes || null,
      });
      if (insertError) throw insertError;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setForm((f) => ({
        ...f,
        invoiceNumber: generateInvoiceNumber(),
        lineItems: [],
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientFirm: '',
        clientService: '',
      }));
      setSelectedClient(null);
      setSelectedTimeLogs(new Set());
      fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!form.clientName || !form.clientEmail || form.lineItems.length === 0) {
      setActionError('Please select a client and add at least one line item before sending.');
      return;
    }
    setSending(true);
    setActionError(null);
    try {
      const supabase = createClient();
      const { data: savedInvoice, error: insertError } = await supabase.from('client_invoices').insert({
        inquiry_id: form.clientId || null,
        invoice_number: form.invoiceNumber,
        invoice_date: form.invoiceDate,
        due_date: form.dueDate,
        amount: subtotal,
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
        line_items: form.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total: li.total,
        })),
        notes: form.notes || null,
      }).select().single();
      if (insertError) throw insertError;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
      const firstName = form.clientName.split(' ')[0];
      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal);
      const formattedDueDate = form.dueDate
        ? new Date(form.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';

      // Send transactional invoice notification via Resend
      const notifyRes = await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: form.clientEmail,
          toName: form.clientName,
          subject: `Invoice #${form.invoiceNumber} — ${formattedAmount} due ${formattedDueDate}`,
          badge: 'Invoice Ready',
          heading: `Invoice #${form.invoiceNumber} — ${formattedAmount} Due`,
          body: `Hi ${firstName},\n\nPlease find your invoice for ${form.clientService} below.\n\nInvoice #${form.invoiceNumber}\nAmount Due: ${formattedAmount}\nDue Date: ${formattedDueDate}\n\nYou can pay securely online using the button below. If you have any questions about this invoice, please reply to this email.`,
          ctaLabel: 'Pay Invoice Now',
          ctaUrl: `${siteUrl}/portal/invoices`,
          eventType: 'invoice',
          templateId: 'invoice_issued_custom',
          variables: {
            '{{firstName}}': firstName,
            '{{invoiceNumber}}': form.invoiceNumber,
            '{{amount}}': formattedAmount,
            '{{dueDate}}': formattedDueDate,
            '{{serviceName}}': form.clientService,
            '{{siteUrl}}': siteUrl,
          },
        }),
      });

      if (!notifyRes.ok) {
        console.warn('Invoice saved but transactional notification email may have failed.');
      }

      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);
      setForm((f) => ({
        ...f,
        invoiceNumber: generateInvoiceNumber(),
        lineItems: [],
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientFirm: '',
        clientService: '',
      }));
      setSelectedClient(null);
      setSelectedTimeLogs(new Set());
      fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to send invoice.');
    } finally {
      setSending(false);
    }
  }

  // ── Stripe Sync Handler ───────────────────────────────────────────────────────

  async function handleSyncToStripe(invoiceId: string, invoiceNumber: string) {
    setSyncingInvoiceId(invoiceId);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const res = await fetch('/api/invoices/sync-to-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncSuccess(`Invoice ${invoiceNumber} synced to Stripe${data.alreadySynced ? ' (already synced)' : ''}.`);
      setTimeout(() => setSyncSuccess(null), 5000);
      fetchData();
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync to Stripe.');
      setTimeout(() => setSyncError(null), 6000);
    } finally {
      setSyncingInvoiceId(null);
    }
  }

  // ── History helpers ───────────────────────────────────────────────────────────

  const filteredInvoices = existingInvoices.filter((inv) => {
    const matchSearch = !historySearch ||
      inv.invoice_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      (inv.notes ?? '').toLowerCase().includes(historySearch.toLowerCase());
    const matchStatus = historyStatus === 'all' || inv.status === historyStatus;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = existingInvoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((s, inv) => s + (Number(inv.amount) - Number(inv.amount_paid)), 0);

  const totalPaid = existingInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((s, inv) => s + Number(inv.amount_paid), 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading invoice data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-700 font-medium mb-2">Failed to load data</p>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-xl w-fit">
        {(['generator', 'history', 'reminders'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'generator' ? 'Invoice Builder' : v === 'history' ? 'Invoice History' : (
              <span className="flex items-center gap-1.5">
                Reminders
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#355E3B] text-white text-[9px] font-bold">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── GENERATOR VIEW ── */}
      {view === 'generator' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-5">
            {/* Success / Error banners */}
            {saveSuccess && (
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Invoice saved successfully.
              </div>
            )}
            {sendSuccess && (
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Invoice saved and notification sent to client.
              </div>
            )}
            {actionError && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {actionError}
              </div>
            )}

            {/* Client & Invoice Details */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-serif text-base text-foreground font-semibold">Client & Invoice Details</h3>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Client</label>
                <select
                  value={form.clientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Select a client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.firm ? `(${c.firm})` : ''}</option>
                  ))}
                </select>
              </div>

              {form.clientId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Client Name</label>
                    <input
                      type="text"
                      value={form.clientName}
                      onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Client Email</label>
                    <input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Invoice #</label>
                  <input
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Payment Terms</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => handleTermsChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Invoice Date</label>
                  <input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => handleInvoiceDateChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Case Info Panel */}
            {selectedClient && (
              <CaseInfoPanel client={selectedClient} />
            )}

{/* Retainer & Time Log Picker */}
            {form.clientId && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-serif text-base text-foreground font-semibold">Add Charges</h3>

                {clientRetainerSub ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#355E3B]/5 border border-[#355E3B]/20">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{clientRetainerSub.plan_name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(Number(clientRetainerSub.amount))} / month · Active retainer</p>
                    </div>
                    <button
                      onClick={addRetainerLineItem}
                      disabled={form.lineItems.some((li) => li.type === 'retainer')}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#355E3B] text-white text-xs font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {form.lineItems.some((li) => li.type === 'retainer') ? 'Added ✓' : '+ Add Retainer'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No active retainer subscription found for this client.</p>
                )}

                {clientTimeLogs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Billable Time Logs</p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {clientTimeLogs.map((log) => {
                        const selected = selectedTimeLogs.has(log.id);
                        const wt = log.work_type ?? 'other';
                        const rawDesc = log.description ?? '';
                        const cleanDesc = rawDesc.replace(/^\[[^\]]+\]\s*/, '').trim() || `${workTypeLabel(wt)} work`;
                        return (
                          <button
                            key={log.id}
                            onClick={() => toggleTimeLogSelection(log.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              selected
                                ? 'bg-[#355E3B]/8 border-[#355E3B]/30 ring-1 ring-[#355E3B]/20'
                                : 'bg-background border-border hover:border-[#355E3B]/30'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${selected ? 'bg-[#355E3B] border-[#355E3B]' : 'border-border'}`}>
                              {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground font-medium truncate">{cleanDesc}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(log.work_date)} · {workTypeLabel(wt)} · {log.hours}h</p>
                            </div>
                            <span className="text-xs font-semibold text-foreground flex-shrink-0">{log.hours}h</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={addCustomLineItem}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground text-sm hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Custom Line Item
                </button>
              </div>
            )}

            {/* Line Items Editor */}
            {form.lineItems.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <h3 className="font-serif text-base text-foreground font-semibold">Line Items</h3>
                <div className="space-y-3">
                  {form.lineItems.map((li) => (
                    <div key={li.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={li.description}
                          onChange={(e) => updateLineItem(li.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="Qty"
                          min="0"
                          step="0.25"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={li.unit_price}
                          onChange={(e) => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="Rate"
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-sm font-semibold text-foreground">{fmt(li.total)}</span>
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <button onClick={() => removeLineItem(li.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-border flex justify-end">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Total</p>
                    <p className="text-2xl font-bold text-[#355E3B]">{fmt(subtotal)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Payment Notes / Terms</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Add payment instructions, bank details, or additional notes…"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-secondary/40 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {showPreview ? 'Hide Preview' : 'Preview Invoice'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || sending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#355E3B] text-[#355E3B] text-sm font-semibold hover:bg-[#355E3B]/5 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="w-4 h-4 rounded-full border-2 border-[#355E3B] border-t-transparent animate-spin" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                )}
                Save Invoice
              </button>
              <button
                onClick={handleSend}
                disabled={saving || sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
                Save & Send to Client
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className={`${showPreview ? 'block' : 'hidden xl:block'}`}>
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Invoice Preview</p>
              <InvoicePreview form={form} />
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Invoices</p>
              <p className="text-3xl font-semibold text-foreground">{existingInvoices.length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Outstanding</p>
              <p className="text-3xl font-semibold text-amber-600">{fmt(totalOutstanding)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Collected</p>
              <p className="text-3xl font-semibold text-[#355E3B]">{fmt(totalPaid)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Overdue</p>
              <p className="text-3xl font-semibold text-red-600">
                {existingInvoices.filter((inv) => inv.status === 'overdue').length}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search invoices…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => setView('generator')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Invoice
            </button>
          </div>

          {/* Stripe sync banners */}
          {syncSuccess && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {syncSuccess}
            </div>
          )}
          {syncError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {syncError}
            </div>
          )}

          {/* Invoice table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="mx-auto mb-3 text-muted-foreground/40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p className="text-muted-foreground text-sm">No invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-3">Invoice #</th>
                      <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Date</th>
                      <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Due</th>
                      <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Amount</th>
                      <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Paid</th>
                      <th className="text-center text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Status</th>
                      <th className="text-center text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Stripe</th>
                      <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const isSyncing = syncingInvoiceId === inv.id;
                      const syncStatus = inv.stripe_sync_status ?? 'unsynced';
                      const isSynced = syncStatus === 'synced' && !!inv.stripe_invoice_id;
                      const canSync = inv.status !== 'paid' && inv.status !== 'cancelled';
                      return (
                        <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-foreground">{inv.invoice_number}</td>
                          <td className="px-3 py-3.5 text-muted-foreground">{fmtDate(inv.invoice_date)}</td>
                          <td className="px-3 py-3.5 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                          <td className="px-3 py-3.5 text-right font-semibold text-foreground">{fmt(Number(inv.amount))}</td>
                          <td className="px-3 py-3.5 text-right text-muted-foreground">{fmt(Number(inv.amount_paid))}</td>
                          <td className="px-3 py-3.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${statusBadge(inv.status)}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {isSynced ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-semibold">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  Synced
                                </span>
                                {inv.stripe_invoice_url && (
                                  <a
                                    href={inv.stripe_invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-violet-600 hover:text-violet-800 underline underline-offset-2"
                                  >
                                    View in Stripe ↗
                                  </a>
                                )}
                              </div>
                            ) : syncStatus === 'failed' ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold">
                                  Failed
                                </span>
                                {canSync && (
                                  <button
                                    onClick={() => handleSyncToStripe(inv.id, inv.invoice_number)}
                                    disabled={isSyncing}
                                    className="text-[10px] text-red-600 hover:text-red-800 underline underline-offset-2 disabled:opacity-50"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            ) : syncStatus === 'syncing' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                                <span className="w-2.5 h-2.5 rounded-full border border-amber-600 border-t-transparent animate-spin" />
                                Syncing…
                              </span>
                            ) : canSync ? (
                              <button
                                onClick={() => handleSyncToStripe(inv.id, inv.invoice_number)}
                                disabled={isSyncing}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
                              >
                                {isSyncing ? (
                                  <span className="w-2.5 h-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                                ) : (
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                                )}
                                {isSyncing ? 'Syncing…' : 'Sync to Stripe'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground text-xs">
                            {Array.isArray(inv.line_items) ? `${inv.line_items.length} item${inv.line_items.length !== 1 ? 's' : ''}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── REMINDERS VIEW ── */}
      {view === 'reminders' && <InvoiceRemindersPanel />}
    </div>
  );
}
