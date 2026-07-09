'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Matter {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
}

interface MatterWithOutcome extends Matter {
  outcome?: string | null;
  settlement_amount?: number | null;
  close_date?: string | null;
  unbilledHours?: number;
  unbilledAmount?: number;
  staffRate?: number;
}

interface TimeEntry {
  id: string;
  inquiry_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
  assigned_to: string | null;
  billable: boolean;
  task_category: string;
  hourly_rate: number | null;
  invoice_id: string | null;
  invoiced_at: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  notes: string | null;
  line_items: LineItem[];
  stripe_invoice_url: string | null;
  stripe_sync_status: string | null;
  contact_inquiries?: { name: string; email: string } | null;
}

interface LineItem {
  id?: string;
  description: string;
  hours?: number;
  rate?: number;
  quantity: number;
  unit_price: number;
  total: number;
  time_log_id?: string;
  work_date?: string;
  task_category?: string;
}

interface BillingRate {
  service_type: string;
  rate_per_hour: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
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

// ─── Export Helpers ───────────────────────────────────────────────────────────

function exportInvoicesToCSV(invoices: Invoice[], matterName: string) {
  if (!invoices.length) return;
  const rows = invoices.map(inv => ({
    'Invoice Number': inv.invoice_number,
    'Issue Date': inv.invoice_date,
    'Due Date': inv.due_date,
    'Amount': inv.amount.toFixed(2),
    'Amount Paid': inv.amount_paid.toFixed(2),
    'Outstanding': (inv.amount - inv.amount_paid).toFixed(2),
    'Payment Status': inv.payment_status,
    'Invoice Status': inv.status,
    'Notes': inv.notes || '',
    'Stripe Synced': inv.stripe_sync_status === 'synced' ? 'Yes' : 'No',
  }));
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String((row as Record<string, string>)[h] ?? '').replace(/"/g, '""');
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${matterName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportInvoicesToPDF(invoices: Invoice[], matter: Matter) {
  const fmtCur = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
  const fmtD = (d: string | null) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalBilled = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const totalOutstanding = totalBilled - totalPaid;

  const rows = invoices.map(inv => {
    const lineItemsHtml = (inv.line_items || []).map((li: LineItem) => `
      <tr class="li-row">
        <td colspan="2" style="padding:4px 8px;font-size:10px;color:#555;">${li.description}</td>
        <td style="padding:4px 8px;font-size:10px;text-align:center;">${li.hours ? li.hours.toFixed(1) + 'h' : li.quantity}</td>
        <td style="padding:4px 8px;font-size:10px;text-align:right;">${li.rate ? fmtCur(li.rate) : fmtCur(li.unit_price)}</td>
        <td style="padding:4px 8px;font-size:10px;text-align:right;">${fmtCur(li.total)}</td>
      </tr>`).join('');

    const statusColor = inv.payment_status === 'paid' ? '#16a34a' : inv.payment_status === 'partial' ? '#2563eb' : '#d97706';

    return `
      <div class="invoice-block">
        <div class="inv-header">
          <div>
            <span class="inv-num">${inv.invoice_number}</span>
            <span class="status-badge" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">${inv.payment_status?.toUpperCase() || 'UNPAID'}</span>
          </div>
          <div class="inv-amount">${fmtCur(inv.amount)}</div>
        </div>
        <div class="inv-meta">Issued ${fmtD(inv.invoice_date)} · Due ${fmtD(inv.due_date)}${inv.amount_paid > 0 ? ` · Paid ${fmtCur(inv.amount_paid)} · Outstanding ${fmtCur(inv.amount - inv.amount_paid)}` : ''}</div>
        ${(inv.line_items || []).length > 0 ? `
        <table class="li-table">
          <thead><tr><th colspan="2">Description</th><th style="text-align:center;">Qty/Hrs</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>${lineItemsHtml}</tbody>
        </table>` : ''}
        ${inv.notes ? `<div class="inv-notes">${inv.notes}</div>` : ''}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Matter Invoices — ${matter.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #666; font-size: 12px; margin: 0 0 6px; }
    .matter-info { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
    .matter-info p { margin: 2px 0; font-size: 12px; color: #444; }
    .matter-info .name { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 4px; }
    .kpis { display: flex; gap: 12px; margin-bottom: 28px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-family: Arial, sans-serif; }
    .kpi-value { font-size: 18px; font-weight: 600; margin-top: 4px; }
    .invoice-block { border: 1px solid #e0e0e0; border-radius: 10px; padding: 16px 20px; margin-bottom: 16px; page-break-inside: avoid; }
    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .inv-num { font-size: 14px; font-weight: 700; margin-right: 8px; }
    .status-badge { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
    .inv-amount { font-size: 18px; font-weight: 700; }
    .inv-meta { font-size: 11px; color: #666; margin-bottom: 10px; }
    .li-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .li-table thead tr { background: #f5f5f5; }
    .li-table th { padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 1px solid #ddd; font-family: Arial, sans-serif; }
    .li-row td { border-bottom: 1px solid #f0f0f0; }
    .inv-notes { margin-top: 10px; font-size: 11px; color: #666; font-style: italic; border-top: 1px solid #eee; padding-top: 8px; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <h1>Matter Invoice Archive</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="matter-info">
    <p class="name">${matter.name}</p>
    <p>${matter.email} · ${matter.service}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Total Invoiced</div><div class="kpi-value">${fmtCur(totalBilled)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Collected</div><div class="kpi-value" style="color:#16a34a;">${fmtCur(totalPaid)}</div></div>
    <div class="kpi"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:${totalOutstanding > 0 ? '#d97706' : '#16a34a'};">${fmtCur(totalOutstanding)}</div></div>
    <div class="kpi"><div class="kpi-label">Invoices</div><div class="kpi-value">${invoices.length}</div></div>
  </div>
  ${rows}
  <div class="footer">Broussard Legal Services · Confidential — For accounting, tax planning, and client billing archives</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

const CATEGORY_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  research: 'Legal Research',
  client_communication: 'Client Communication',
  court_appearance: 'Court Appearance',
  review: 'Document Review',
  negotiation: 'Negotiation',
  administrative: 'Administrative',
  deposition: 'Deposition',
  discovery: 'Discovery',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  drafting: 'bg-blue-100 text-blue-700',
  research: 'bg-purple-100 text-purple-700',
  client_communication: 'bg-green-100 text-green-700',
  court_appearance: 'bg-red-100 text-red-700',
  review: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-indigo-100 text-indigo-700',
  administrative: 'bg-gray-100 text-gray-600',
  deposition: 'bg-orange-100 text-orange-700',
  discovery: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-600',
};

const PAYMENT_STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  unpaid: { label: 'Unpaid', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  partial: { label: 'Partial', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  written_off: { label: 'Written Off', cls: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

const INVOICE_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const OUTCOME_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  won: { label: 'Won', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🏆' },
  settled: { label: 'Settled', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🤝' },
  favorable_judgment: { label: 'Favorable Judgment', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '⚖️' },
  dismissed: { label: 'Dismissed', cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: '✓' },
  lost: { label: 'Lost', cls: 'bg-red-50 text-red-700 border-red-200', icon: '✗' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: '↩' },
  pending_close: { label: 'Pending Close', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: '⏳' },
};

function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = PAYMENT_STATUS_CFG[status] ?? PAYMENT_STATUS_CFG.unpaid;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveView = 'select_matter' | 'select_entries' | 'build_invoice' | 'invoices_list';
type MatterTab = 'all' | 'closed';

export default function MatterInvoiceBuilder() {
  const supabase = createClient();

  const [view, setView] = useState<ActiveView>('select_matter');
  const [matterTab, setMatterTab] = useState<MatterTab>('closed');
  const [matters, setMatters] = useState<Matter[]>([]);
  const [closedMatters, setClosedMatters] = useState<MatterWithOutcome[]>([]);
  const [billingRates, setBillingRates] = useState<BillingRate[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickInvoicing, setQuickInvoicing] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingPortal, setSendingPortal] = useState<string | null>(null);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [matterSearch, setMatterSearch] = useState('');
  const [creatingCheckout, setCreatingCheckout] = useState<string | null>(null);

  // Invoice form state
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(() => addDays(todayStr(), 30));
  const [notes, setNotes] = useState('Payment due within 30 days. Thank you for your business.');
  const [taxRate, setTaxRate] = useState(0);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // Load billing rates
  useEffect(() => {
    async function loadRates() {
      const { data } = await supabase
        .from('billing_hourly_rates')
        .select('service_type, rate_per_hour')
        .eq('is_active', true);
      if (data) setBillingRates(data as BillingRate[]);
    }
    loadRates();
  }, []);

  // Load matters
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .order('created_at', { ascending: false });
      if (data) setMatters(data as Matter[]);
    }
    load();
  }, []);

  // Load closed matters with outcomes and unbilled hours
  useEffect(() => {
    async function loadClosed() {
      setLoadingClosed(true);
      try {
        // Get matters with outcomes
        const { data: outcomes } = await supabase
          .from('matter_outcomes')
          .select('inquiry_id, outcome, settlement_amount, close_date')
          .order('close_date', { ascending: false });

        if (!outcomes || outcomes.length === 0) {
          setClosedMatters([]);
          return;
        }

        const outcomeMap = new Map(outcomes.map((o: { inquiry_id: string; outcome: string; settlement_amount: number | null; close_date: string }) => [o.inquiry_id, o]));
        const matterIds = outcomes.map((o: { inquiry_id: string }) => o.inquiry_id);

        // Get matter details
        const { data: matterData } = await supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status')
          .in('id', matterIds);

        if (!matterData) { setClosedMatters([]); return; }

        // Get unbilled time entries for each matter
        const { data: timeLogs } = await supabase
          .from('retainer_time_logs')
          .select('inquiry_id, hours, hourly_rate, invoice_id, billable')
          .in('inquiry_id', matterIds)
          .eq('billable', true)
          .is('invoice_id', null);

        // Build unbilled summary per matter
        const unbilledMap = new Map<string, { hours: number; amount: number }>();
        (timeLogs || []).forEach((log: { inquiry_id: string; hours: number; hourly_rate: number | null }) => {
          const existing = unbilledMap.get(log.inquiry_id) || { hours: 0, amount: 0 };
          const hrs = Number(log.hours);
          const rate = Number(log.hourly_rate) || 0;
          unbilledMap.set(log.inquiry_id, {
            hours: existing.hours + hrs,
            amount: existing.amount + hrs * rate,
          });
        });

        const enriched: MatterWithOutcome[] = matterData.map((m: Matter) => {
          const outcome = outcomeMap.get(m.id);
          const unbilled = unbilledMap.get(m.id);
          // Find matching billing rate for this service
          const matchedRate = billingRates.find(r =>
            m.service?.toLowerCase().includes(r.service_type.toLowerCase()) ||
            r.service_type.toLowerCase().includes(m.service?.toLowerCase() || '')
          );
          return {
            ...m,
            outcome: outcome?.outcome || null,
            settlement_amount: outcome?.settlement_amount || null,
            close_date: outcome?.close_date || null,
            unbilledHours: unbilled?.hours || 0,
            unbilledAmount: unbilled?.amount || 0,
            staffRate: matchedRate?.rate_per_hour || 0,
          };
        });

        setClosedMatters(enriched);
      } catch (e) {
        console.error('Failed to load closed matters:', e);
      } finally {
        setLoadingClosed(false);
      }
    }
    loadClosed();
  }, [billingRates]);

  // Load time entries for selected matter
  const loadTimeEntries = useCallback(async (matterId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('retainer_time_logs')
        .select('id, inquiry_id, hours, description, work_date, logged_by, assigned_to, billable, task_category, hourly_rate, invoice_id, invoiced_at')
        .eq('inquiry_id', matterId)
        .eq('billable', true)
        .order('work_date', { ascending: false });
      if (err) throw err;
      setTimeEntries((data || []) as TimeEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Load invoices for selected matter
  const loadInvoices = useCallback(async (matterId: string) => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, payment_status, status, notes, line_items, stripe_invoice_url, stripe_sync_status, contact_inquiries(name, email)')
        .eq('inquiry_id', matterId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setInvoices((data || []) as Invoice[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  function handleSelectMatter(matter: Matter) {
    setSelectedMatter(matter);
    setSelectedEntryIds(new Set());
    loadTimeEntries(matter.id);
    loadInvoices(matter.id);
    setView('select_entries');
  }

  function toggleEntry(id: string) {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllUnbilled() {
    const unbilled = timeEntries.filter(e => !e.invoice_id);
    const allSelected = unbilled.every(e => selectedEntryIds.has(e.id));
    if (allSelected) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(unbilled.map(e => e.id)));
    }
  }

  const selectedEntries = timeEntries.filter(e => selectedEntryIds.has(e.id));
  const subtotal = selectedEntries.reduce((s, e) => s + Number(e.hours) * (Number(e.hourly_rate) || 0), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalDue = subtotal + taxAmount;

  // ─── One-Click Quick Invoice from Closed Matter ───────────────────────────

  async function handleQuickInvoice(matter: MatterWithOutcome) {
    setQuickInvoicing(matter.id);
    setError(null);
    try {
      // Fetch all unbilled entries for this matter
      const { data: entries, error: fetchErr } = await supabase
        .from('retainer_time_logs')
        .select('id, inquiry_id, hours, description, work_date, logged_by, assigned_to, billable, task_category, hourly_rate, invoice_id, invoiced_at')
        .eq('inquiry_id', matter.id)
        .eq('billable', true)
        .is('invoice_id', null)
        .order('work_date', { ascending: true });

      if (fetchErr) throw fetchErr;
      if (!entries || entries.length === 0) {
        setError(`No unbilled time entries found for ${matter.name}. All hours have already been invoiced.`);
        return;
      }

      // Auto-apply staff rate from billing_hourly_rates if entry has no rate
      const matchedRate = billingRates.find(r =>
        matter.service?.toLowerCase().includes(r.service_type.toLowerCase()) ||
        r.service_type.toLowerCase().includes(matter.service?.toLowerCase() || '')
      );
      const fallbackRate = matchedRate?.rate_per_hour || 0;

      const enrichedEntries = entries.map((e: TimeEntry) => ({
        ...e,
        hourly_rate: e.hourly_rate || fallbackRate,
      }));

      const invNumber = generateInvoiceNumber();
      const today = todayStr();
      const due = addDays(today, 30);

      const lineItems: LineItem[] = enrichedEntries.map((e: TimeEntry) => ({
        description: `${CATEGORY_LABELS[e.task_category] || e.task_category}${e.description ? ': ' + e.description : ''}${e.assigned_to ? ` (${e.assigned_to})` : e.logged_by ? ` (${e.logged_by})` : ''}`,
        hours: Number(e.hours),
        rate: Number(e.hourly_rate) || fallbackRate,
        quantity: 1,
        unit_price: Number(e.hours) * (Number(e.hourly_rate) || fallbackRate),
        total: Number(e.hours) * (Number(e.hourly_rate) || fallbackRate),
        time_log_id: e.id,
        work_date: e.work_date,
        task_category: e.task_category,
      }));

      const invoiceTotal = lineItems.reduce((s, li) => s + li.total, 0);

      const outcomeNote = matter.outcome
        ? `Matter closed — ${OUTCOME_CFG[matter.outcome]?.label || matter.outcome}${matter.settlement_amount ? ` · Settlement: ${fmt(matter.settlement_amount)}` : ''}. `
        : '';

      // Insert invoice
      const { data: inv, error: invErr } = await supabase
        .from('client_invoices')
        .insert({
          inquiry_id: matter.id,
          invoice_number: invNumber,
          invoice_date: today,
          due_date: due,
          amount: invoiceTotal,
          amount_paid: 0,
          currency: 'usd',
          status: 'pending',
          payment_status: 'unpaid',
          line_items: lineItems,
          notes: `${outcomeNote}Payment due within 30 days. Thank you for your business.`,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // Mark all entries as invoiced
      await supabase
        .from('retainer_time_logs')
        .update({ invoice_id: inv.id, invoiced_at: new Date().toISOString() })
        .in('id', enrichedEntries.map((e: TimeEntry) => e.id));

      // Auto-send email to client portal
      const lineItemsForEmail = lineItems.map(li => ({
        date: li.work_date || today,
        description: li.description,
        hours: li.hours || li.quantity,
        rate: li.rate || li.unit_price,
        total: li.total,
        workType: li.task_category || 'Legal Services',
      }));

      const emailRes = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: matter.email,
          clientName: matter.name,
          invoiceNumber: invNumber,
          issueDate: today,
          dueDate: due,
          firmName: 'Broussard Legal Services',
          firmEmail: 'contact@broussardlegalservices.com',
          firmPhone: '',
          matterRef: matter.service,
          lineItems: lineItemsForEmail,
          subtotal: invoiceTotal,
          taxRate: 0,
          taxAmount: 0,
          totalDue: invoiceTotal,
          notes: `${outcomeNote}Payment due within 30 days.`,
        }),
      });

      const emailData = await emailRes.json();
      const emailSent = emailRes.ok;

      setSuccessMsg(
        `✓ Invoice ${invNumber} created for ${fmt(invoiceTotal)} (${enrichedEntries.length} line items)${emailSent ? ' · Sent to client portal' : ' · Email delivery pending (check RESEND_API_KEY)'}`
      );

      // Refresh closed matters list
      setClosedMatters(prev => prev.map(m =>
        m.id === matter.id ? { ...m, unbilledHours: 0, unbilledAmount: 0 } : m
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create quick invoice');
    } finally {
      setQuickInvoicing(null);
    }
  }

  // ─── Build invoice from selected entries ──────────────────────────────────

  async function handleCreateInvoice() {
    if (!selectedMatter || selectedEntries.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const lineItems: LineItem[] = selectedEntries.map(e => ({
        description: `${CATEGORY_LABELS[e.task_category] || e.task_category}${e.description ? ': ' + e.description : ''}${e.assigned_to ? ` (${e.assigned_to})` : e.logged_by ? ` (${e.logged_by})` : ''}`,
        hours: Number(e.hours),
        rate: Number(e.hourly_rate) || 0,
        quantity: 1,
        unit_price: Number(e.hours) * (Number(e.hourly_rate) || 0),
        total: Number(e.hours) * (Number(e.hourly_rate) || 0),
        time_log_id: e.id,
        work_date: e.work_date,
        task_category: e.task_category,
      }));

      // Insert invoice
      const { data: inv, error: invErr } = await supabase
        .from('client_invoices')
        .insert({
          inquiry_id: selectedMatter.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          amount: totalDue,
          amount_paid: 0,
          currency: 'usd',
          status: 'pending',
          payment_status: 'unpaid',
          line_items: lineItems,
          notes,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // Mark time entries as invoiced
      const { error: updateErr } = await supabase
        .from('retainer_time_logs')
        .update({ invoice_id: inv.id, invoiced_at: new Date().toISOString() })
        .in('id', selectedEntries.map(e => e.id));

      if (updateErr) console.warn('Failed to mark entries as invoiced:', updateErr);

      setSuccessMsg(`Invoice ${invoiceNumber} created for ${fmt(totalDue)}`);
      setInvoiceNumber(generateInvoiceNumber());
      setSelectedEntryIds(new Set());
      await loadTimeEntries(selectedMatter.id);
      await loadInvoices(selectedMatter.id);
      setView('invoices_list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  // Send invoice via Resend
  async function handleSendEmail(invoice: Invoice) {
    if (!selectedMatter) return;
    setSendingEmail(true);
    setError(null);
    try {
      const lineItems = (invoice.line_items || []).map((item: LineItem) => ({
        date: item.work_date || invoice.invoice_date,
        description: item.description,
        hours: item.hours || item.quantity,
        rate: item.rate || item.unit_price,
        total: item.total,
        workType: item.task_category || 'Legal Services',
      }));

      const subtotalAmt = lineItems.reduce((s: number, i: { total: number }) => s + i.total, 0);

      const res = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: selectedMatter.email,
          clientName: selectedMatter.name,
          invoiceNumber: invoice.invoice_number,
          issueDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          firmName: 'Broussard Legal Services',
          firmEmail: 'contact@broussardlegalservices.com',
          firmPhone: '',
          matterRef: selectedMatter.service,
          lineItems,
          subtotal: subtotalAmt,
          taxRate: 0,
          taxAmount: 0,
          totalDue: invoice.amount,
          notes: invoice.notes || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      setSuccessMsg(`Invoice ${invoice.invoice_number} sent to ${selectedMatter.email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invoice email');
    } finally {
      setSendingEmail(false);
    }
  }

  // Send to client portal (email + portal notification)
  async function handleSendToPortal(invoice: Invoice) {
    if (!selectedMatter) return;
    setSendingPortal(invoice.id);
    setError(null);
    try {
      // Send email
      const lineItems = (invoice.line_items || []).map((item: LineItem) => ({
        date: item.work_date || invoice.invoice_date,
        description: item.description,
        hours: item.hours || item.quantity,
        rate: item.rate || item.unit_price,
        total: item.total,
        workType: item.task_category || 'Legal Services',
      }));
      const subtotalAmt = lineItems.reduce((s: number, i: { total: number }) => s + i.total, 0);

      const emailRes = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: selectedMatter.email,
          clientName: selectedMatter.name,
          invoiceNumber: invoice.invoice_number,
          issueDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          firmName: 'Broussard Legal Services',
          firmEmail: 'contact@broussardlegalservices.com',
          firmPhone: '',
          matterRef: selectedMatter.service,
          lineItems,
          subtotal: subtotalAmt,
          taxRate: 0,
          taxAmount: 0,
          totalDue: invoice.amount,
          notes: invoice.notes || '',
        }),
      });

      // Also trigger portal notification
      await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice_issued',
          recipientEmail: selectedMatter.email,
          recipientName: selectedMatter.name,
          data: {
            invoiceNumber: invoice.invoice_number,
            amount: fmt(invoice.amount),
            dueDate: fmtDate(invoice.due_date),
            portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'}/portal/invoices`,
          },
        }),
      }).catch(() => null); // non-blocking

      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error || 'Failed to send to portal');

      setSuccessMsg(`Invoice ${invoice.invoice_number} sent to client portal (${selectedMatter.email})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send to client portal');
    } finally {
      setSendingPortal(null);
    }
  }

  // Sync to Stripe
  async function handleSyncStripe(invoice: Invoice) {
    setSyncingStripe(true);
    setError(null);
    try {
      const res = await fetch('/api/invoices/sync-to-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync to Stripe');
      setSuccessMsg(`Invoice synced to Stripe. Payment link generated.`);
      if (selectedMatter) await loadInvoices(selectedMatter.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync to Stripe');
    } finally {
      setSyncingStripe(false);
    }
  }

  // Mark paid / partial
  async function handleMarkPayment(invoice: Invoice, type: 'paid' | 'partial') {
    setMarkingPaid(invoice.id);
    setError(null);
    try {
      let amountPaid = invoice.amount;
      if (type === 'partial') {
        const amt = parseFloat(partialPaymentAmount);
        if (isNaN(amt) || amt <= 0) throw new Error('Enter a valid partial payment amount');
        amountPaid = amt;
      }

      const { error: err } = await supabase
        .from('client_invoices')
        .update({
          amount_paid: amountPaid,
          status: type === 'paid' ? 'paid' : 'pending',
          payment_status: type === 'paid' ? 'paid' : 'partial',
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amountPaid,
        })
        .eq('id', invoice.id);

      if (err) throw err;
      setSuccessMsg(`Invoice ${invoice.invoice_number} marked as ${type === 'paid' ? 'paid in full' : 'partial payment recorded'}`);
      setSelectedInvoiceForPayment(null);
      setPartialPaymentAmount('');
      if (selectedMatter) await loadInvoices(selectedMatter.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update payment status');
    } finally {
      setMarkingPaid(null);
    }
  }

  // Create Stripe Checkout Session for direct payment
  async function handleCreateCheckout(invoice: Invoice) {
    if (!selectedMatter) return;
    setCreatingCheckout(invoice.id);
    setError(null);
    try {
      const outstanding = invoice.amount - invoice.amount_paid;
      if (outstanding <= 0) {
        setError('This invoice has already been paid in full.');
        return;
      }

      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: outstanding,
          currency: 'usd',
          invoice_number: invoice.invoice_number,
          success_url: `${window.location.origin}/payment-success?invoice_id=${invoice.id}&invoice_number=${encodeURIComponent(invoice.invoice_number)}&amount=${outstanding}`,
          cancel_url: window.location.href,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link');
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create Stripe checkout session');
    } finally {
      setCreatingCheckout(null);
    }
  }

  // ─── Filtered matter lists ────────────────────────────────────────────────

  const filteredMatters = matters.filter(m =>
    !matterSearch ||
    m.name.toLowerCase().includes(matterSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(matterSearch.toLowerCase()) ||
    m.service?.toLowerCase().includes(matterSearch.toLowerCase())
  );

  const filteredClosed = closedMatters.filter(m =>
    !matterSearch ||
    m.name.toLowerCase().includes(matterSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(matterSearch.toLowerCase()) ||
    m.service?.toLowerCase().includes(matterSearch.toLowerCase())
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Matter Invoice Builder</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create invoices from time logs, send via email, and reconcile with Stripe</p>
        </div>
        {selectedMatter && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setView('select_entries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${view === 'select_entries' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              Time Entries
            </button>
            <button
              onClick={() => setView('build_invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${view === 'build_invoice' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              Build Invoice {selectedEntryIds.size > 0 && `(${selectedEntryIds.size})`}
            </button>
            <button
              onClick={() => setView('invoices_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${view === 'invoices_list' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              Invoices {invoices.length > 0 && `(${invoices.length})`}
            </button>
            <button
              onClick={() => { setSelectedMatter(null); setView('select_matter'); setSelectedEntryIds(new Set()); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white text-gray-500 border-gray-200 hover:border-gray-300 transition-colors"
            >
              ← Change Matter
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
          <p className="text-sm text-emerald-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      {/* ── View: Select Matter ── */}
      {view === 'select_matter' && (
        <div className="space-y-4">
          {/* Tab switcher + search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setMatterTab('closed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${matterTab === 'closed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ⚡ Closed Matters
                {closedMatters.filter(m => (m.unbilledHours || 0) > 0).length > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {closedMatters.filter(m => (m.unbilledHours || 0) > 0).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMatterTab('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${matterTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All Matters
              </button>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by name, email, or service…"
                value={matterSearch}
                onChange={e => setMatterSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
              />
            </div>
          </div>

          {/* ── Closed Matters Tab: One-Click Quick Invoice ── */}
          {matterTab === 'closed' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">One-Click Invoice from Closed Matters</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-populate all unbilled hours with staff rates and send to client portal instantly</p>
                  </div>
                </div>
              </div>

              {loadingClosed ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Loading closed matters…
                  </div>
                </div>
              ) : filteredClosed.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">
                  {matterSearch ? 'No closed matters match your search' : 'No closed matters with recorded outcomes found'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredClosed.map(m => {
                    const outcomeCfg = m.outcome ? OUTCOME_CFG[m.outcome] : null;
                    const hasUnbilled = (m.unbilledHours || 0) > 0;
                    const isProcessing = quickInvoicing === m.id;
                    return (
                      <div key={m.id} className={`px-6 py-5 flex items-start gap-4 flex-wrap ${hasUnbilled ? '' : 'opacity-60'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-gray-900">{m.name}</span>
                            {outcomeCfg && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${outcomeCfg.cls}`}>
                                {outcomeCfg.icon} {outcomeCfg.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{m.email} · {m.service}</p>
                          {m.close_date && (
                            <p className="text-xs text-gray-400 mt-0.5">Closed {fmtDate(m.close_date)}{m.settlement_amount ? ` · Settlement ${fmt(m.settlement_amount)}` : ''}</p>
                          )}
                          {/* Unbilled summary */}
                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            {hasUnbilled ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  {Number(m.unbilledHours).toFixed(1)}h unbilled
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{fmt(m.unbilledAmount || 0)} ready to invoice</span>
                                {m.staffRate && m.staffRate > 0 && (
                                  <span className="text-xs text-gray-400">{fmt(m.staffRate)}/hr rate</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-emerald-600 font-semibold">✓ All hours invoiced</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasUnbilled ? (
                            <button
                              onClick={() => handleQuickInvoice(m)}
                              disabled={isProcessing}
                              className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                            >
                              {isProcessing ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  Creating…
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                                  Quick Invoice
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSelectMatter(m)}
                              className="px-3 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
                            >
                              View Invoices
                            </button>
                          )}
                          <button
                            onClick={() => handleSelectMatter(m)}
                            className="px-3 py-2 border border-gray-200 text-gray-500 text-xs font-semibold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
                            title="Manual invoice builder"
                          >
                            Manual
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── All Matters Tab ── */}
          {matterTab === 'all' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">All Matters</h3>
                <p className="text-xs text-gray-500 mt-0.5">Choose the matter to generate an invoice for</p>
              </div>
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {filteredMatters.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-gray-400">No matters found</div>
                ) : filteredMatters.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMatter(m)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.email} · {m.service}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {m.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View: Select Time Entries ── */}
      {view === 'select_entries' && selectedMatter && (
        <div className="space-y-4">
          {/* Matter header */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">{selectedMatter.name}</p>
              <p className="text-xs text-gray-500">{selectedMatter.email} · {selectedMatter.service}</p>
            </div>
            {selectedEntryIds.size > 0 && (
              <button
                onClick={() => setView('build_invoice')}
                className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Build Invoice ({selectedEntryIds.size} entries · {fmt(subtotal)}) →
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Billable Time Entries</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select entries to include in the invoice</p>
              </div>
              <button
                onClick={toggleAllUnbilled}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline"
              >
                {timeEntries.filter(e => !e.invoice_id).every(e => selectedEntryIds.has(e.id)) ? 'Deselect All' : 'Select All Unbilled'}
              </button>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Loading entries…</div>
            ) : timeEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">No billable time entries for this matter</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {timeEntries.map(entry => {
                  const isInvoiced = !!entry.invoice_id;
                  const isSelected = selectedEntryIds.has(entry.id);
                  const amount = Number(entry.hours) * (Number(entry.hourly_rate) || 0);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => !isInvoiced && toggleEntry(entry.id)}
                      className={`px-6 py-4 flex items-start gap-4 transition-colors ${isInvoiced ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-gray-50'} ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="mt-0.5">
                        {isInvoiced ? (
                          <div className="w-4 h-4 rounded border border-gray-300 bg-gray-100 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
                          </div>
                        ) : (
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[entry.task_category] || 'bg-gray-100 text-gray-600'}`}>
                            {CATEGORY_LABELS[entry.task_category] || entry.task_category}
                          </span>
                          <span className="text-xs text-gray-500">{fmtDate(entry.work_date)}</span>
                          {isInvoiced && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Already Invoiced</span>}
                        </div>
                        <p className="text-sm text-gray-800 mt-1">{entry.description || 'No description'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entry.assigned_to ? `Assigned to ${entry.assigned_to}` : entry.logged_by ? `Logged by ${entry.logged_by}` : 'Admin'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(amount)}</p>
                        <p className="text-xs text-gray-500">{Number(entry.hours).toFixed(1)}h × {fmt(Number(entry.hourly_rate) || 0)}/hr</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View: Build Invoice ── */}
      {view === 'build_invoice' && selectedMatter && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Invoice Details</h3>
              <p className="text-xs text-gray-500 mt-0.5">Review and configure before generating</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Client info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
                <p className="text-sm font-bold text-gray-900">{selectedMatter.name}</p>
                <p className="text-xs text-gray-500">{selectedMatter.email}</p>
                <p className="text-xs text-gray-500">{selectedMatter.service}</p>
              </div>

              {/* Invoice fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Number</label>
                  <input
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              </div>

              {/* Line items preview */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Line Items ({selectedEntries.length})</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Description</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Hrs</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Rate</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedEntries.map(e => (
                        <tr key={e.id}>
                          <td className="px-4 py-2.5 text-gray-800">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${CATEGORY_COLORS[e.task_category] || 'bg-gray-100 text-gray-600'}`}>
                              {CATEGORY_LABELS[e.task_category] || e.task_category}
                            </span>
                            {e.description || 'Legal Services'}
                            {(e.assigned_to || e.logged_by) && (
                              <span className="ml-1 text-gray-400">({e.assigned_to || e.logged_by})</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600 font-mono">{Number(e.hours).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600 font-mono">{fmt(Number(e.hourly_rate) || 0)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 font-mono">{fmt(Number(e.hours) * (Number(e.hourly_rate) || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 text-right text-gray-600 font-semibold">Subtotal</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 font-mono">{fmt(subtotal)}</td>
                      </tr>
                      {taxRate > 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Tax ({taxRate}%)</td>
                          <td className="px-4 py-2 text-right text-gray-600 font-mono">{fmt(taxAmount)}</td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-900">Total Due</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono text-sm">{fmt(totalDue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Tax rate */}
              <div className="flex items-center gap-4">
                <div className="w-40">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes / Payment Terms</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateInvoice}
                  disabled={saving || selectedEntries.length === 0}
                  className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Creating…' : `Create Invoice (${fmt(totalDue)})`}
                </button>
                <button
                  onClick={() => setView('select_entries')}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-300 transition-colors"
                >
                  ← Back to Entries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View: Invoices List ── */}
      {view === 'invoices_list' && selectedMatter && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Invoices — {selectedMatter.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => exportInvoicesToCSV(invoices, selectedMatter.name)}
                  disabled={invoices.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  title="Export invoices as CSV"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  CSV
                </button>
                <button
                  onClick={() => exportInvoicesToPDF(invoices, selectedMatter)}
                  disabled={invoices.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  title="Export invoices as PDF"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  PDF
                </button>
                <button
                  onClick={() => { setSelectedEntryIds(new Set()); setView('select_entries'); }}
                  className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                >
                  + New Invoice
                </button>
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">No invoices yet for this matter</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const isPaymentTarget = selectedInvoiceForPayment?.id === inv.id;
                  const outstanding = inv.amount - inv.amount_paid;
                  const isSendingToPortal = sendingPortal === inv.id;
                  return (
                    <div key={inv.id} className="px-6 py-5 space-y-3">
                      {/* Invoice header row */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{inv.invoice_number}</span>
                            <PaymentStatusBadge status={inv.payment_status || 'unpaid'} />
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${INVOICE_STATUS_CFG[inv.status]?.cls || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {INVOICE_STATUS_CFG[inv.status]?.label || inv.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Issued {fmtDate(inv.invoice_date)} · Due {fmtDate(inv.due_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-gray-900">{fmt(inv.amount)}</p>
                          {inv.amount_paid > 0 && (
                            <p className="text-xs text-gray-500">
                              Paid: {fmt(inv.amount_paid)} · Outstanding: {fmt(outstanding)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress bar for partial payments */}
                      {inv.amount_paid > 0 && inv.amount_paid < inv.amount && (
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (inv.amount_paid / inv.amount) * 100)}%` }}
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Send to Portal */}
                        <button
                          onClick={() => handleSendToPortal(inv)}
                          disabled={isSendingToPortal}
                          className="px-3 py-1.5 text-xs font-semibold border border-indigo-200 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          {isSendingToPortal ? 'Sending…' : 'Send to Portal'}
                        </button>

                        {/* Send email */}
                        <button
                          onClick={() => handleSendEmail(inv)}
                          disabled={sendingEmail}
                          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                          {sendingEmail ? 'Sending…' : 'Email Only'}
                        </button>

                        {/* Sync to Stripe */}
                        {inv.stripe_sync_status !== 'synced' ? (
                          <button
                            onClick={() => handleSyncStripe(inv)}
                            disabled={syncingStripe}
                            className="px-3 py-1.5 text-xs font-semibold border border-purple-200 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                            {syncingStripe ? 'Syncing…' : 'Sync to Stripe'}
                          </button>
                        ) : (
                          <a
                            href={inv.stripe_invoice_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-semibold border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            Stripe Link
                          </a>
                        )}

                        {/* Mark paid */}
                        {inv.payment_status !== 'paid' && (
                          <>
                            {/* Pay Now via Stripe Checkout */}
                            <button
                              onClick={() => handleCreateCheckout(inv)}
                              disabled={creatingCheckout === inv.id}
                              className="px-3 py-1.5 text-xs font-semibold border border-violet-200 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                              title="Generate a Stripe Checkout link for direct client payment"
                            >
                              {creatingCheckout === inv.id ? (
                                <>
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  Generating…
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Pay Now
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleMarkPayment(inv, 'paid')}
                              disabled={markingPaid === inv.id}
                              className="px-3 py-1.5 text-xs font-semibold border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                            >
                              {markingPaid === inv.id ? 'Saving…' : '✓ Mark Paid'}
                            </button>
                            <button
                              onClick={() => setSelectedInvoiceForPayment(isPaymentTarget ? null : inv)}
                              className="px-3 py-1.5 text-xs font-semibold border border-blue-200 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              Partial Payment
                            </button>
                          </>
                        )}
                      </div>

                      {/* Partial payment input */}
                      {isPaymentTarget && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-semibold text-blue-700 mb-1">Payment Amount</label>
                            <input
                              type="number"
                              min="0.01"
                              max={outstanding}
                              step="0.01"
                              value={partialPaymentAmount}
                              onChange={e => setPartialPaymentAmount(e.target.value)}
                              placeholder={`Max ${fmt(outstanding)}`}
                              className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                            />
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleMarkPayment(inv, 'partial')}
                              disabled={markingPaid === inv.id}
                              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {markingPaid === inv.id ? 'Saving…' : 'Record Payment'}
                            </button>
                            <button
                              onClick={() => { setSelectedInvoiceForPayment(null); setPartialPaymentAmount(''); }}
                              className="px-3 py-2 border border-blue-200 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
