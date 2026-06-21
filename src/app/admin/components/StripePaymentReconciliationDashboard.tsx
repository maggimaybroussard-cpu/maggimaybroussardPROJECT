'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaidReceiptLog {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  status: string;
  raw_metadata: Record<string, string> | null;
  created_at: string;
}

interface ClientInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  stripe_invoice_id: string | null;
  created_at: string;
  contact_inquiries?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ReconciliationRow {
  paymentIntentId: string;
  amount: number;
  currency: string;
  customerEmail: string | null;
  customerName: string | null;
  receiptStatus: string;
  receiptCreatedAt: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  invoiceStatus: string | null;
  invoiceDueDate: string | null;
  caseId: string | null;
  syncStatus: 'matched' | 'unmatched' | 'discrepancy' | 'partial';
  discrepancyNote: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const SYNC_BADGE: Record<string, { label: string; cls: string }> = {
  matched: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  discrepancy: { label: 'Discrepancy', cls: 'bg-red-50 text-red-700 border-red-200' },
  unmatched: { label: 'Unmatched', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const RECEIPT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid_in_full: { label: 'Paid in Full', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  no_invoice_match: { label: 'No Invoice', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function exportToCSV(rows: ReconciliationRow[]) {
  const headers = [
    'Payment Intent ID', 'Customer Name', 'Customer Email', 'Amount', 'Currency',
    'Receipt Status', 'Invoice Number', 'Invoice Amount', 'Invoice Status',
    'Invoice Due Date', 'Sync Status', 'Discrepancy Note', 'Date',
  ];
  const csvRows = rows.map((r) => [
    r.paymentIntentId,
    r.customerName ?? '',
    r.customerEmail ?? '',
    r.amount.toFixed(2),
    r.currency.toUpperCase(),
    r.receiptStatus,
    r.invoiceNumber ?? '',
    r.invoiceAmount?.toFixed(2) ?? '',
    r.invoiceStatus ?? '',
    r.invoiceDueDate ? fmtDate(r.invoiceDueDate) : '',
    r.syncStatus,
    r.discrepancyNote ?? '',
    fmtDateTime(r.receiptCreatedAt),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StripePaymentReconciliationDashboard() {
  const supabase = createClient();

  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'discrepancy' | 'partial'>('all');
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<Record<string, 'success' | 'error'>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch paid receipt logs
      const { data: logs, error: logsErr } = await supabase
        .from('paid_receipt_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsErr) throw logsErr;

      // Fetch invoices that have a stripe_invoice_id or are referenced by logs
      const invoiceIds = (logs ?? [])
        .map((l: PaidReceiptLog) => l.invoice_id)
        .filter(Boolean) as string[];

      let invoiceMap: Record<string, ClientInvoice> = {};

      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase
          .from('client_invoices')
          .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, currency, status, stripe_invoice_id, created_at, contact_inquiries(id, name, email)')
          .in('id', invoiceIds);

        (invoices ?? []).forEach((inv: ClientInvoice) => {
          invoiceMap[inv.id] = inv;
        });
      }

      // Build reconciliation rows
      const reconciled: ReconciliationRow[] = (logs ?? []).map((log: PaidReceiptLog) => {
        const invoice = log.invoice_id ? invoiceMap[log.invoice_id] : null;

        let syncStatus: ReconciliationRow['syncStatus'] = 'unmatched';
        let discrepancyNote: string | null = null;

        if (invoice) {
          const amountDiff = Math.abs(log.amount - invoice.amount);
          if (log.status === 'paid_in_full' && invoice.status === 'paid') {
            syncStatus = 'matched';
          } else if (log.status === 'partial') {
            syncStatus = 'partial';
            discrepancyNote = `Paid ${fmt(log.amount, log.currency)} of ${fmt(invoice.amount, invoice.currency)} total`;
          } else if (amountDiff > 0.01) {
            syncStatus = 'discrepancy';
            discrepancyNote = `Payment ${fmt(log.amount, log.currency)} vs invoice ${fmt(invoice.amount, invoice.currency)}`;
          } else if (invoice.status !== 'paid' && log.status === 'paid_in_full') {
            syncStatus = 'discrepancy';
            discrepancyNote = 'Payment confirmed but invoice not marked paid';
          } else {
            syncStatus = 'matched';
          }
        } else {
          syncStatus = 'unmatched';
          discrepancyNote = 'No matching invoice found for this payment';
        }

        return {
          paymentIntentId: log.payment_intent_id,
          amount: log.amount,
          currency: log.currency,
          customerEmail: log.customer_email,
          customerName: log.customer_name,
          receiptStatus: log.status,
          receiptCreatedAt: log.created_at,
          invoiceId: log.invoice_id,
          invoiceNumber: invoice?.invoice_number ?? log.invoice_number,
          invoiceAmount: invoice?.amount ?? null,
          invoiceStatus: invoice?.status ?? null,
          invoiceDueDate: invoice?.due_date ?? null,
          caseId: (invoice?.contact_inquiries as { id?: string } | null)?.id ?? null,
          syncStatus,
          discrepancyNote,
        };
      });

      setRows(reconciled);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Simulate retry for failed/unmatched payments
  const handleRetry = async (paymentIntentId: string) => {
    setRetryingId(paymentIntentId);
    try {
      const res = await fetch('/api/webhooks/stripe-payment-intent/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      });
      if (res.ok) {
        setRetryResult((prev) => ({ ...prev, [paymentIntentId]: 'success' }));
        setTimeout(() => load(), 1500);
      } else {
        setRetryResult((prev) => ({ ...prev, [paymentIntentId]: 'error' }));
      }
    } catch {
      setRetryResult((prev) => ({ ...prev, [paymentIntentId]: 'error' }));
    } finally {
      setRetryingId(null);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = rows.filter((r) => {
    const matchesFilter = filter === 'all' || r.syncStatus === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.paymentIntentId.toLowerCase().includes(q) ||
      (r.customerEmail ?? '').toLowerCase().includes(q) ||
      (r.customerName ?? '').toLowerCase().includes(q) ||
      (r.invoiceNumber ?? '').toLowerCase().includes(q);
    const matchesFrom = !dateFrom || new Date(r.receiptCreatedAt) >= new Date(dateFrom);
    const matchesTo = !dateTo || new Date(r.receiptCreatedAt) <= new Date(dateTo + 'T23:59:59');
    return matchesFilter && matchesSearch && matchesFrom && matchesTo;
  });

  const stats = {
    total: rows.length,
    matched: rows.filter((r) => r.syncStatus === 'matched').length,
    partial: rows.filter((r) => r.syncStatus === 'partial').length,
    discrepancy: rows.filter((r) => r.syncStatus === 'discrepancy').length,
    unmatched: rows.filter((r) => r.syncStatus === 'unmatched').length,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    matchedAmount: rows.filter((r) => r.syncStatus === 'matched').reduce((s, r) => s + r.amount, 0),
  };

  const healthScore = stats.total > 0
    ? Math.round(((stats.matched + stats.partial * 0.5) / stats.total) * 100)
    : 100;

  const healthColor = healthScore >= 90 ? '#059669' : healthScore >= 70 ? '#D97706' : '#DC2626';
  const healthLabel = healthScore >= 90 ? 'Excellent' : healthScore >= 70 ? 'Fair' : 'Needs Attention';

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary mr-3">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span className="text-sm text-muted-foreground">Loading reconciliation data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700 font-medium">{error}</p>
        <button onClick={load} className="mt-3 text-xs text-red-600 underline hover:no-underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Payments', value: stats.total.toString(), sub: fmt(stats.totalAmount), color: 'text-foreground' },
          { label: 'Matched', value: stats.matched.toString(), sub: `${stats.total ? Math.round((stats.matched / stats.total) * 100) : 0}% sync rate`, color: 'text-emerald-700' },
          { label: 'Partial', value: stats.partial.toString(), sub: 'Partially paid', color: 'text-amber-700' },
          { label: 'Discrepancies', value: stats.discrepancy.toString(), sub: 'Needs review', color: 'text-red-700' },
          { label: 'Unmatched', value: stats.unmatched.toString(), sub: 'No invoice found', color: 'text-slate-600' },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{card.label}</p>
            <p className={`text-3xl font-semibold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Reconciliation Health Score ─────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Reconciliation Health</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats.matched} of {stats.total} payments fully reconciled ·{' '}
              <span className="font-semibold text-foreground">{fmt(stats.matchedAmount)}</span> confirmed revenue
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: healthColor }}>{healthScore}%</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: healthColor }}>{healthLabel}</p>
          </div>
        </div>
        <div className="w-full h-2.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${healthScore}%`, background: healthColor }}
          />
        </div>
        {stats.discrepancy > 0 && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {stats.discrepancy} discrepanc{stats.discrepancy === 1 ? 'y requires' : 'ies require'} manual review
          </p>
        )}
      </div>

      {/* ── Filters & Search ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'matched', 'partial', 'discrepancy', 'unmatched'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                {f === 'all' ? `All (${stats.total})` : f === 'matched' ? `Matched (${stats.matched})` : f === 'partial' ? `Partial (${stats.partial})` : f === 'discrepancy' ? `Discrepancies (${stats.discrepancy})` : `Unmatched (${stats.unmatched})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => exportToCSV(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
              title="Export filtered results to CSV"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Search + Date Range */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by PI, email, name, invoice…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Clear date filter"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground/40 mb-3">
            <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
          </svg>
          <p className="text-sm text-muted-foreground">No payment records found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Stripe payment confirmations will appear here once received</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-5 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Payment Intent</th>
                  <th className="text-left px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Customer</th>
                  <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-left px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice</th>
                  <th className="text-left px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Sync Status</th>
                  <th className="text-left px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Receipt Status</th>
                  <th className="text-left px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                  <th className="text-right px-4 py-3.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  const syncBadge = SYNC_BADGE[row.syncStatus] ?? SYNC_BADGE.unmatched;
                  const receiptBadge = RECEIPT_STATUS_BADGE[row.receiptStatus] ?? { label: row.receiptStatus, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
                  const isExpanded = expandedRow === row.paymentIntentId;
                  const retryState = retryResult[row.paymentIntentId];

                  return (
                    <React.Fragment key={row.paymentIntentId}>
                      <tr
                        className={`hover:bg-secondary/20 transition-colors cursor-pointer ${isExpanded ? 'bg-secondary/10' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : row.paymentIntentId)}
                      >
                        {/* Payment Intent ID */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${row.syncStatus === 'matched' ? 'text-emerald-500' : row.syncStatus === 'discrepancy' ? 'text-red-500' : row.syncStatus === 'partial' ? 'text-amber-500' : 'text-slate-400'}`}>
                              {row.syncStatus === 'matched' ? (
                                <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                              ) : row.syncStatus === 'discrepancy' ? (
                                <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                              ) : (
                                <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>
                              )}
                            </svg>
                            <code className="text-xs font-mono text-foreground/80 truncate max-w-[140px]" title={row.paymentIntentId}>
                              {row.paymentIntentId.slice(0, 20)}…
                            </code>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-4">
                          {row.caseId ? (
                            <a
                              href={`/admin/cases/${row.caseId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="group"
                            >
                              <p className="text-sm font-medium text-foreground truncate max-w-[160px] group-hover:text-primary group-hover:underline transition-colors">{row.customerName || '—'}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[160px]">{row.customerEmail || '—'}</p>
                            </a>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{row.customerName || '—'}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[160px]">{row.customerEmail || '—'}</p>
                            </>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">{fmt(row.amount, row.currency)}</p>
                          {row.invoiceAmount && row.invoiceAmount !== row.amount && (
                            <p className="text-xs text-muted-foreground">of {fmt(row.invoiceAmount, row.currency)}</p>
                          )}
                        </td>

                        {/* Invoice */}
                        <td className="px-4 py-4">
                          {row.invoiceNumber ? (
                            <div>
                              <p className="text-sm font-medium text-foreground">{row.invoiceNumber}</p>
                              {row.invoiceDueDate && (
                                <p className="text-xs text-muted-foreground">Due {fmtDate(row.invoiceDueDate)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">No invoice</span>
                          )}
                        </td>

                        {/* Sync Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${syncBadge.cls}`}>
                            {syncBadge.label}
                          </span>
                        </td>

                        {/* Receipt Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${receiptBadge.cls}`}>
                            {receiptBadge.label}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.receiptCreatedAt)}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {(row.syncStatus === 'unmatched' || row.syncStatus === 'discrepancy') && (
                            <button
                              onClick={() => handleRetry(row.paymentIntentId)}
                              disabled={retryingId === row.paymentIntentId}
                              title="Retry sync"
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                retryState === 'success' ?'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : retryState === 'error' ?'bg-red-50 text-red-700 border-red-200' :'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/70 hover:text-foreground'
                              } disabled:opacity-60`}
                            >
                              {retryingId === row.paymentIntentId ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                              ) : retryState === 'success' ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : retryState === 'error' ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                                </svg>
                              )}
                              {retryState === 'success' ? 'Retried' : retryState === 'error' ? 'Failed' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-secondary/10">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Payment details */}
                              <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Stripe Payment</p>
                                <dl className="space-y-2">
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Payment Intent ID</dt>
                                    <dd className="text-xs font-mono text-foreground truncate max-w-[180px]" title={row.paymentIntentId}>{row.paymentIntentId}</dd>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Amount</dt>
                                    <dd className="text-xs font-semibold text-foreground">{fmt(row.amount, row.currency)}</dd>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Currency</dt>
                                    <dd className="text-xs text-foreground uppercase">{row.currency}</dd>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Received</dt>
                                    <dd className="text-xs text-foreground">{fmtDateTime(row.receiptCreatedAt)}</dd>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Customer</dt>
                                    <dd className="text-xs text-foreground">{row.customerName || '—'}</dd>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <dt className="text-xs text-muted-foreground">Email</dt>
                                    <dd className="text-xs text-foreground truncate max-w-[180px]">{row.customerEmail || '—'}</dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Invoice details */}
                              <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Matched Invoice</p>
                                {row.invoiceNumber ? (
                                  <dl className="space-y-2">
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-xs text-muted-foreground">Invoice #</dt>
                                      <dd className="text-xs font-semibold text-foreground">{row.invoiceNumber}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-xs text-muted-foreground">Invoice Amount</dt>
                                      <dd className="text-xs font-semibold text-foreground">{row.invoiceAmount ? fmt(row.invoiceAmount, row.currency) : '—'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-xs text-muted-foreground">Amount Paid</dt>
                                      <dd className="text-xs font-semibold text-emerald-700">{fmt(row.amount, row.currency)}</dd>
                                    </div>
                                    {row.invoiceAmount && row.invoiceAmount > row.amount && (
                                      <div className="flex justify-between gap-2">
                                        <dt className="text-xs text-muted-foreground">Balance Due</dt>
                                        <dd className="text-xs font-semibold text-amber-700">{fmt(row.invoiceAmount - row.amount, row.currency)}</dd>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-xs text-muted-foreground">Invoice Status</dt>
                                      <dd className="text-xs text-foreground capitalize">{row.invoiceStatus ?? '—'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-xs text-muted-foreground">Due Date</dt>
                                      <dd className="text-xs text-foreground">{fmtDate(row.invoiceDueDate)}</dd>
                                    </div>
                                    {row.caseId && (
                                      <div className="pt-2 border-t border-border">
                                        <a
                                          href={`/admin/cases/${row.caseId}`}
                                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                          </svg>
                                          View Case →
                                        </a>
                                      </div>
                                    )}
                                  </dl>
                                ) : (
                                  <p className="text-xs text-muted-foreground/60 italic">No invoice matched to this payment</p>
                                )}
                              </div>

                              {/* Sync / discrepancy */}
                              <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Sync Analysis</p>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${syncBadge.cls}`}>
                                    {syncBadge.label}
                                  </span>
                                </div>
                                {row.discrepancyNote ? (
                                  <div className={`rounded-lg p-3 text-xs ${row.syncStatus === 'discrepancy' ? 'bg-red-50 text-red-700 border border-red-200' : row.syncStatus === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                    {row.discrepancyNote}
                                  </div>
                                ) : (
                                  <p className="text-xs text-emerald-700">Payment and invoice amounts match. Invoice status is in sync.</p>
                                )}
                                {(row.syncStatus === 'unmatched' || row.syncStatus === 'discrepancy') && (
                                  <button
                                    onClick={() => handleRetry(row.paymentIntentId)}
                                    disabled={retryingId === row.paymentIntentId}
                                    className="mt-3 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                  >
                                    {retryingId === row.paymentIntentId ? (
                                      <>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                        </svg>
                                        Retrying…
                                      </>
                                    ) : 'Retry Sync'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-5 py-3 border-t border-border bg-secondary/10 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} payment records
              {(dateFrom || dateTo) && <span className="ml-1 text-primary font-medium">(date filtered)</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              Total confirmed: <span className="font-semibold text-foreground">{fmt(filtered.reduce((s, r) => s + r.amount, 0))}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Failed Payment Retry Log ────────────────────────────────────────── */}
      {Object.keys(retryResult).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-serif text-base text-foreground mb-3">Retry Log</h3>
          <div className="space-y-2">
            {Object.entries(retryResult).map(([piId, result]) => (
              <div key={piId} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs ${result === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {result === 'success' ? <polyline points="20 6 9 17 4 12"/> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                </svg>
                <code className="font-mono">{piId.slice(0, 24)}…</code>
                <span className="font-semibold">{result === 'success' ? 'Retry succeeded — invoice sync re-triggered' : 'Retry failed — check webhook configuration'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
