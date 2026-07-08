'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  inquiry_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[] | null;
  notes: string | null;
  created_at: string;
  client_name?: string;
  client_email?: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceSummary {
  totalBilled: number;
  totalCollected: number;
  totalOverdue: number;
  totalPending: number;
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  sent: { label: 'Sent', pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-gray-100 text-gray-400 border-gray-200', dot: 'bg-gray-300' },
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, dotColor, loading }: {
  label: string; value: string; sub?: string; dotColor: string; loading: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-muted/60 animate-pulse rounded-lg" />
      ) : (
        <p className="text-xl font-bold text-foreground">{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onExpand, expanded }: {
  invoice: Invoice;
  onExpand: () => void;
  expanded: boolean;
}) {
  const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG['draft'];
  const balance = Math.max(0, invoice.amount - (invoice.amount_paid ?? 0));
  const daysUntil = invoice.due_date ? getDaysUntil(invoice.due_date) : null;
  const isOverdue = invoice.status === 'overdue' || (daysUntil !== null && daysUntil < 0 && invoice.status !== 'paid');

  return (
    <>
      <tr
        className={`border-b border-border/60 last:border-0 cursor-pointer transition-colors ${
          expanded ? 'bg-primary/5' : 'hover:bg-muted/30'
        } ${isOverdue ? 'bg-red-50/30' : ''}`}
        onClick={onExpand}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`text-muted-foreground/50 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-foreground">{invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(invoice.invoice_date)}</p>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 hidden sm:table-cell">
          <p className="text-sm text-foreground">{invoice.client_name || '—'}</p>
          <p className="text-xs text-muted-foreground">{invoice.client_email || ''}</p>
        </td>
        <td className="px-5 py-3.5">
          <p className="text-sm font-semibold text-foreground">{fmt(invoice.amount, invoice.currency)}</p>
          {balance > 0 && invoice.status !== 'paid' && (
            <p className="text-xs text-muted-foreground mt-0.5">{fmt(balance)} remaining</p>
          )}
        </td>
        <td className="px-5 py-3.5 hidden md:table-cell">
          {invoice.due_date ? (
            <div>
              <p className="text-sm text-foreground">{fmtDate(invoice.due_date)}</p>
              {daysUntil !== null && invoice.status !== 'paid' && (
                <p className={`text-xs mt-0.5 font-medium ${
                  daysUntil < 0 ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-muted-foreground'
                }`}>
                  {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
                </p>
              )}
            </div>
          ) : <span className="text-sm text-muted-foreground">—</span>}
        </td>
        <td className="px-5 py-3.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </td>
        <td className="px-5 py-3.5">
          {invoice.inquiry_id && (
            <Link
              href={`/admin/cases/${invoice.inquiry_id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View Case
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </Link>
          )}
        </td>
      </tr>

      {/* Expanded Row */}
      {expanded && (
        <tr className="bg-primary/5 border-b border-border/60">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Line Items */}
              {invoice.line_items && invoice.line_items.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Line Items</p>
                  <div className="bg-white border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Description</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Qty</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Unit</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.line_items.map((item, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2 text-foreground">{item.description}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{fmt(item.unit_price, invoice.currency)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-foreground">{fmt(item.total, invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Payment Summary</p>
                <div className="bg-white border border-border rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice Total</span>
                    <span className="font-semibold text-foreground">{fmt(invoice.amount, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-semibold text-emerald-700">{fmt(invoice.amount_paid ?? 0, invoice.currency)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="font-semibold text-foreground">Balance Due</span>
                    <span className={`font-bold ${Math.max(0, invoice.amount - (invoice.amount_paid ?? 0)) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {fmt(Math.max(0, invoice.amount - (invoice.amount_paid ?? 0)), invoice.currency)}
                    </span>
                  </div>
                  {invoice.notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{invoice.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminClientInvoicePortal() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary>({
    totalBilled: 0, totalCollected: 0, totalOverdue: 0, totalPending: 0,
    overdueCount: 0, pendingCount: 0, paidCount: 0,
  });
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'due_date'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: invoiceData, error: invErr } = await supabase
        .from('client_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invErr) throw invErr;

      const rawInvoices: Invoice[] = invoiceData || [];

      // Enrich with client info from contact_inquiries
      const inquiryIds = [...new Set(rawInvoices.map((i) => i.inquiry_id).filter(Boolean))];
      let clientMap: Record<string, { name: string; email: string }> = {};

      if (inquiryIds.length > 0) {
        const { data: inquiries } = await supabase
          .from('contact_inquiries')
          .select('id, name, email')
          .in('id', inquiryIds as string[]);

        if (inquiries) {
          clientMap = Object.fromEntries(inquiries.map((i) => [i.id, { name: i.name, email: i.email }]));
        }
      }

      const enriched = rawInvoices.map((inv) => ({
        ...inv,
        client_name: inv.inquiry_id ? clientMap[inv.inquiry_id]?.name : undefined,
        client_email: inv.inquiry_id ? clientMap[inv.inquiry_id]?.email : undefined,
      }));

      setInvoices(enriched);

      // Summary
      const totalBilled = enriched.reduce((s, i) => s + (i.amount ?? 0), 0);
      const totalCollected = enriched.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
      const overdueInvs = enriched.filter((i) => i.status === 'overdue');
      const pendingInvs = enriched.filter((i) => ['sent', 'pending'].includes(i.status));
      const paidInvs = enriched.filter((i) => i.status === 'paid');

      setSummary({
        totalBilled,
        totalCollected,
        totalOverdue: overdueInvs.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0),
        totalPending: pendingInvs.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0),
        overdueCount: overdueInvs.length,
        pendingCount: pendingInvs.length,
        paidCount: paidInvs.length,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtering & Sorting ───────────────────────────────────────────────────

  const filtered = invoices
    .filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(q) ||
          (inv.client_name || '').toLowerCase().includes(q) ||
          (inv.client_email || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let valA: number, valB: number;
      if (sortBy === 'amount') { valA = a.amount; valB = b.amount; }
      else if (sortBy === 'due_date') { valA = a.due_date ? new Date(a.due_date).getTime() : 0; valB = b.due_date ? new Date(b.due_date).getTime() : 0; }
      else { valA = new Date(a.created_at).getTime(); valB = new Date(b.created_at).getTime(); }
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`inline ml-1 ${sortBy === col ? 'text-primary' : 'text-muted-foreground/40'}`}>
      {sortBy === col && sortDir === 'asc'
        ? <><polyline points="18 15 12 9 6 15"/></>
        : <><polyline points="6 9 12 15 18 9"/></>}
    </svg>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </Link>
            <AppLogo className="h-7 w-auto" />
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-sm font-semibold text-foreground">Client Invoice Portal</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Billed" value={loading ? '—' : fmt(summary.totalBilled)} dotColor="bg-blue-500" loading={loading} />
          <SummaryCard label="Total Collected" value={loading ? '—' : fmt(summary.totalCollected)} dotColor="bg-emerald-500" loading={loading}
            sub={loading ? undefined : `${summary.paidCount} paid`} />
          <SummaryCard label="Overdue" value={loading ? '—' : fmt(summary.totalOverdue)} dotColor="bg-red-500" loading={loading}
            sub={loading ? undefined : `${summary.overdueCount} invoice${summary.overdueCount !== 1 ? 's' : ''}`} />
          <SummaryCard label="Pending" value={loading ? '—' : fmt(summary.totalPending)} dotColor="bg-amber-500" loading={loading}
            sub={loading ? undefined : `${summary.pendingCount} invoice${summary.pendingCount !== 1 ? 's' : ''}`} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by invoice # or client…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'pending', label: 'Pending' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'draft', label: 'Draft' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === opt.value
                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
                {opt.value !== 'all' && (
                  <span className="ml-1 text-muted-foreground/60">
                    ({invoices.filter((i) => i.status === opt.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' && ` · ${STATUS_CONFIG[statusFilter]?.label || statusFilter}`}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort:</span>
              <button onClick={() => handleSort('date')} className={`hover:text-foreground transition-colors ${sortBy === 'date' ? 'text-foreground font-medium' : ''}`}>
                Date <SortIcon col="date" />
              </button>
              <button onClick={() => handleSort('amount')} className={`hover:text-foreground transition-colors ${sortBy === 'amount' ? 'text-foreground font-medium' : ''}`}>
                Amount <SortIcon col="amount" />
              </button>
              <button onClick={() => handleSort('due_date')} className={`hover:text-foreground transition-colors ${sortBy === 'due_date' ? 'text-foreground font-medium' : ''}`}>
                Due Date <SortIcon col="due_date" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">No invoices found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Client</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Due Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      expanded={expandedId === inv.id}
                      onExpand={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>Showing {filtered.length} of {invoices.length} invoices</span>
              <span>Total shown: {fmt(filtered.reduce((s, i) => s + i.amount, 0))}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
