'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  description: string | null;
  customer_name: string;
  customer_email: string;
  created_at: string;
  updated_at: string;
}

interface Invoice {
  id: string;
  inquiry_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[];
  notes: string | null;
  created_at: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Booking {
  id: string;
  name: string;
  email: string;
  event_type?: string;
  start_time: string;
  end_time?: string;
  status: string;
  created_at: string;
}

interface ClientRecord {
  email: string;
  name: string;
  payments: Payment[];
  invoices: Invoice[];
  upcomingBookings: Booking[];
  totalPaid: number;
  outstandingBalance: number;
  lastActivity: string;
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

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPaymentTypeLabel(type: string) {
  if (type === 'consultation_deposit') return 'Consultation Deposit';
  if (type === 'retainer') return 'Retainer Agreement';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: string) {
  if (status === 'succeeded' || status === 'paid')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'pending' || status === 'active')
    return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'failed' || status === 'overdue' || status === 'canceled')
    return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function statusLabel(status: string) {
  if (status === 'succeeded') return 'Paid';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  if (status === 'active') return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
        })
        .join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingHistoryDashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'payments' | 'invoices' | 'timeline' | 'clients'>('payments');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [paymentsRes, invoicesRes, bookingsRes] = await Promise.all([
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('client_invoices').select('*').order('created_at', { ascending: false }),
        supabase
          .from('calendly_bookings')
          .select('id,name,email,event_type,start_time,end_time,status,created_at')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(50),
      ]);
      setPayments(paymentsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setBookings(bookingsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadReceipt = async (payment: Payment) => {
    if (payment.payment_status !== 'succeeded') return;
    setDownloadingId(payment.id);
    setDownloadError(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentIntentId: payment.payment_intent_id,
          customerName: payment.customer_name,
          customerEmail: payment.customer_email,
          paymentType: payment.payment_type,
          amount: Number(payment.amount),
          currency: payment.currency,
          createdAt: payment.created_at,
          returnPdf: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to generate receipt.');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${payment.payment_intent_id.slice(-8).toUpperCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (data?.pdfBase64) {
          const byteChars = atob(data.pdfBase64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt-${payment.payment_intent_id.slice(-8).toUpperCase()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          throw new Error('Receipt PDF not available.');
        }
      }
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download receipt.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const succeededPayments = payments.filter((p) => p.payment_status === 'succeeded');
  const totalRevenue = succeededPayments.reduce((s, p) => s + Number(p.amount), 0);
  const pendingInvoicesBalance = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((s, inv) => s + (Number(inv.amount) - Number(inv.amount_paid)), 0);
  const overdueInvoices = invoices.filter((inv) => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return false;
    return new Date(inv.due_date) < new Date();
  });

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    const matchSearch =
      !search ||
      p.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      p.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      p.payment_intent_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.payment_status === statusFilter;
    const matchType = typeFilter === 'all' || p.payment_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchSearch =
      !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Client-grouped view
  const clientMap: Record<string, ClientRecord> = {};
  payments.forEach((p) => {
    const key = p.customer_email;
    if (!clientMap[key]) {
      clientMap[key] = {
        email: p.customer_email,
        name: p.customer_name,
        payments: [],
        invoices: [],
        upcomingBookings: [],
        totalPaid: 0,
        outstandingBalance: 0,
        lastActivity: p.created_at,
      };
    }
    clientMap[key].payments.push(p);
    if (p.payment_status === 'succeeded') clientMap[key].totalPaid += Number(p.amount);
    if (new Date(p.created_at) > new Date(clientMap[key].lastActivity))
      clientMap[key].lastActivity = p.created_at;
  });
  invoices.forEach((inv) => {
    const matchedClient = Object.values(clientMap).find((c) =>
      c.payments.some((p) => p.payment_intent_id && inv.inquiry_id)
    );
    if (matchedClient) {
      matchedClient.invoices.push(inv);
      if (inv.status !== 'paid' && inv.status !== 'cancelled') {
        matchedClient.outstandingBalance += Number(inv.amount) - Number(inv.amount_paid);
      }
    }
  });
  bookings.forEach((b) => {
    const key = b.email;
    if (clientMap[key]) {
      clientMap[key].upcomingBookings.push(b);
    }
  });
  const clientRecords = Object.values(clientMap).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
  const filteredClients = clientRecords.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  // Upcoming timeline — merge bookings + overdue invoices
  const upcomingItems: Array<{
    type: 'booking' | 'invoice_due';
    date: string;
    label: string;
    sub: string;
    daysUntil: number;
    status: string;
    id: string;
  }> = [
    ...bookings.map((b) => ({
      type: 'booking' as const,
      date: b.start_time,
      label: b.event_type || 'Consultation',
      sub: `${b.name} · ${b.email}`,
      daysUntil: getDaysUntil(b.start_time),
      status: b.status,
      id: b.id,
    })),
    ...invoices
      .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
      .map((inv) => ({
        type: 'invoice_due' as const,
        date: inv.due_date,
        label: `Invoice ${inv.invoice_number} Due`,
        sub: `${fmt(Number(inv.amount) - Number(inv.amount_paid), inv.currency)} outstanding`,
        daysUntil: getDaysUntil(inv.due_date),
        status: inv.status,
        id: inv.id,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const paymentTypes = Array.from(new Set(payments.map((p) => p.payment_type)));

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Revenue</p>
          <p className="text-2xl font-semibold text-foreground">{fmt(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{succeededPayments.length} confirmed</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#C8965A', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Outstanding</p>
          <p className="text-2xl font-semibold text-foreground">{fmt(pendingInvoicesBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length} open invoices</p>
        </div>
        <div className={`rounded-2xl p-5 relative overflow-hidden border ${overdueInvoices.length > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Overdue</p>
          <p className={`text-2xl font-semibold ${overdueInvoices.length > 0 ? 'text-red-700' : 'text-foreground'}`}>
            {overdueInvoices.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overdueInvoices.length > 0 ? fmt(overdueInvoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0)) : 'All current'}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Upcoming</p>
          <p className="text-2xl font-semibold text-foreground">{bookings.length}</p>
          <p className="text-xs text-muted-foreground mt-1">scheduled services</p>
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 overflow-x-auto">
        {(
          [
            { id: 'payments', label: 'Payment Records' },
            { id: 'invoices', label: `Invoices${invoices.length > 0 ? ` (${invoices.length})` : ''}` },
            { id: 'timeline', label: `Service Timeline${upcomingItems.length > 0 ? ` (${upcomingItems.length})` : ''}` },
            { id: 'clients', label: `By Client${clientRecords.length > 0 ? ` (${clientRecords.length})` : ''}` },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
              activeView === v.id
                ? 'bg-card text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Search + Filters ── */}
      {(activeView === 'payments' || activeView === 'invoices' || activeView === 'clients') && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={activeView === 'clients' ? 'Search by name or email…' : 'Search by name, email, or ID…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Statuses</option>
            {activeView === 'payments' ? (
              <>
                <option value="succeeded">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </>
            ) : (
              <>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>
          {activeView === 'payments' && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Types</option>
              {paymentTypes.map((t) => (
                <option key={t} value={t}>
                  {getPaymentTypeLabel(t)}
                </option>
              ))}
            </select>
          )}
          {activeView === 'payments' && filteredPayments.length > 0 && (
            <>
              <button
                onClick={() =>
                  exportToCSV(
                    filteredPayments.map((p) => ({
                      Date: fmtDate(p.created_at),
                      Client: p.customer_name,
                      Email: p.customer_email,
                      Type: getPaymentTypeLabel(p.payment_type),
                      Amount: Number(p.amount),
                      Currency: p.currency.toUpperCase(),
                      Status: statusLabel(p.payment_status),
                      'Payment ID': p.payment_intent_id,
                    })),
                    'billing-history.csv'
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => {
                  const rows = filteredPayments.map(p => `<tr>
                    <td>${fmtDate(p.created_at)}</td>
                    <td>${p.customer_name}</td>
                    <td>${p.customer_email}</td>
                    <td>${getPaymentTypeLabel(p.payment_type)}</td>
                    <td style="text-align:right">${fmt(Number(p.amount), p.currency)}</td>
                    <td>${statusLabel(p.payment_status)}</td>
                    <td style="font-size:10px;color:#888">${p.payment_intent_id}</td>
                  </tr>`).join('');
                  const totalFiltered = filteredPayments.filter(p => p.payment_status === 'succeeded').reduce((s, p) => s + Number(p.amount), 0);
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment History Report</title>
                  <style>
                    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
                    h1 { font-size: 24px; margin-bottom: 4px; }
                    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
                    .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
                    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
                    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
                    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
                    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
                    tr:nth-child(even) td { background: #fafafa; }
                    .footer { margin-top: 24px; font-size: 11px; color: #999; }
                  </style></head><body>
                  <h1>Payment History Report</h1>
                  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  <div class="kpis">
                    <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${fmt(totalRevenue)}</div></div>
                    <div class="kpi"><div class="kpi-label">Filtered Total</div><div class="kpi-value">${fmt(totalFiltered)}</div></div>
                    <div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-value">${filteredPayments.length}</div></div>
                    <div class="kpi"><div class="kpi-label">Overdue Invoices</div><div class="kpi-value">${overdueInvoices.length}</div></div>
                  </div>
                  <table>
                    <thead><tr><th>Date</th><th>Client</th><th>Email</th><th>Type</th><th>Amount</th><th>Status</th><th>Payment ID</th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                  <div class="footer">Broussard Legal Services</div>
                  </body></html>`;
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(html);
                  win.document.close();
                  win.focus();
                  setTimeout(() => { win.print(); }, 500);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                PDF
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {downloadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {downloadError}
        </div>
      )}

      {/* ── PAYMENT RECORDS VIEW ── */}
      {activeView === 'payments' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">All Payment Records</h2>
              <p className="text-xs text-muted-foreground font-light mt-0.5">
                {filteredPayments.length} transaction{filteredPayments.length !== 1 ? 's' : ''}
                {statusFilter !== 'all' || typeFilter !== 'all' || search ? ' (filtered)' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-light">Filtered total</p>
              <p className="text-base font-semibold" style={{ color: '#355E3B' }}>
                {fmt(filteredPayments.filter((p) => p.payment_status === 'succeeded').reduce((s, p) => s + Number(p.amount), 0))}
              </p>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground font-light">No payments match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                    <th className="text-center px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment, i) => (
                    <tr key={payment.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{payment.customer_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{payment.customer_email}</p>
                        <p className="text-xs text-muted-foreground/50 font-mono mt-0.5">#{payment.payment_intent_id.slice(-8).toUpperCase()}</p>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-foreground">{getPaymentTypeLabel(payment.payment_type)}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{fmtDate(payment.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-foreground">{fmt(Number(payment.amount), payment.currency)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadge(payment.payment_status)}`}>
                          {statusLabel(payment.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {payment.payment_status === 'succeeded' ? (
                          <button
                            onClick={() => handleDownloadReceipt(payment)}
                            disabled={downloadingId === payment.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingId === payment.id ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            )}
                            PDF
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── INVOICES VIEW ── */}
      {activeView === 'invoices' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground">All Invoices</h2>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' || search ? ' (filtered)' : ''}
            </p>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground font-light">No invoices match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice #</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Issued</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Due</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Balance</th>
                    <th className="text-center px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, i) => {
                    const balance = Number(invoice.amount) - Number(invoice.amount_paid);
                    const isOverdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date(invoice.due_date) < new Date();
                    return (
                      <tr key={invoice.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground font-mono">{invoice.invoice_number}</p>
                          {invoice.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{invoice.notes}</p>}
                          {invoice.line_items?.[0]?.description && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[180px]">{invoice.line_items[0].description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{fmtDate(invoice.invoice_date)}</span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            {fmtDate(invoice.due_date)}
                            {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-foreground">{fmt(Number(invoice.amount), invoice.currency)}</span>
                        </td>
                        <td className="px-6 py-4 text-right hidden sm:table-cell">
                          {invoice.status === 'paid' ? (
                            <span className="text-sm text-emerald-600 font-medium">Paid in full</span>
                          ) : balance > 0 ? (
                            <span className="text-sm text-red-600 font-medium">{fmt(balance, invoice.currency)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadge(invoice.status)}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SERVICE TIMELINE VIEW ── */}
      {activeView === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Upcoming Service Timeline</h2>
            <p className="text-xs text-muted-foreground font-light">Scheduled consultations and pending invoice due dates</p>
          </div>

          {upcomingItems.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground font-light">No upcoming services or pending invoices.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/60 hidden sm:block" />

              <div className="space-y-3">
                {upcomingItems.map((item) => {
                  const isOverdue = item.daysUntil < 0;
                  const isToday = item.daysUntil === 0;
                  const isSoon = item.daysUntil > 0 && item.daysUntil <= 3;

                  return (
                    <div key={`${item.type}-${item.id}`} className="flex gap-4 sm:gap-6">
                      {/* Timeline dot */}
                      <div className="hidden sm:flex flex-col items-center shrink-0">
                        <div
                          className={`w-[14px] h-[14px] rounded-full border-2 mt-4 shrink-0 ${
                            item.type === 'booking' ?'border-primary bg-primary/20'
                              : isOverdue
                              ? 'border-red-500 bg-red-100'
                              : isSoon
                              ? 'border-amber-500 bg-amber-100' :'border-border bg-card'
                          }`}
                        />
                      </div>

                      {/* Card */}
                      <div
                        className={`flex-1 bg-card border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          isOverdue ? 'border-red-200' : isSoon || isToday ? 'border-amber-200' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              item.type === 'booking' ? 'bg-primary/8' : isOverdue ? 'bg-red-50' : 'bg-amber-50'
                            }`}
                          >
                            {item.type === 'booking' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isOverdue ? 'text-red-500' : 'text-amber-600'}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{item.label}</p>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${
                                  item.type === 'booking' ?'bg-primary/8 text-primary border-primary/20'
                                    : isOverdue
                                    ? 'bg-red-50 text-red-700 border-red-200' :'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {item.type === 'booking' ? 'Consultation' : 'Invoice Due'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-light mt-0.5">{item.sub}</p>
                            <p className="text-xs text-muted-foreground font-light mt-0.5">{fmtDateTime(item.date)}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {isOverdue ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                              {Math.abs(item.daysUntil)}d overdue
                            </span>
                          ) : isToday ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                              Today
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                                isSoon ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-secondary/40 border-border text-muted-foreground'
                              }`}
                            >
                              in {item.daysUntil}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BY CLIENT VIEW ── */}
      {activeView === 'clients' && (
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <p className="text-sm text-muted-foreground font-light">No clients match your search.</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isExpanded = expandedClient === client.email;
              return (
                <div key={client.email} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Client row */}
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : client.email)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.08)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground font-light truncate">{client.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground font-light">Total Paid</p>
                        <p className="text-sm font-semibold" style={{ color: '#355E3B' }}>{fmt(client.totalPaid)}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground font-light">Payments</p>
                        <p className="text-sm font-semibold text-foreground">{client.payments.length}</p>
                      </div>
                      {client.upcomingBookings.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs font-semibold">
                          {client.upcomingBookings.length} upcoming
                        </span>
                      )}
                      {client.outstandingBalance > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                          {fmt(client.outstandingBalance)} due
                        </span>
                      )}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/60 px-6 py-5 space-y-5 bg-secondary/10">
                      {/* Payments */}
                      {client.payments.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Payment Records</p>
                          <div className="space-y-2">
                            {client.payments.map((p) => (
                              <div key={p.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${p.payment_status === 'succeeded' ? 'bg-emerald-100' : p.payment_status === 'pending' ? 'bg-amber-50' : 'bg-red-50'}`}>
                                    {p.payment_status === 'succeeded' ? (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12" /></svg>
                                    ) : (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-foreground">{getPaymentTypeLabel(p.payment_type)}</p>
                                    <p className="text-xs text-muted-foreground font-light">{fmtDate(p.created_at)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-semibold text-foreground">{fmt(Number(p.amount), p.currency)}</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${statusBadge(p.payment_status)}`}>
                                    {statusLabel(p.payment_status)}
                                  </span>
                                  {p.payment_status === 'succeeded' && (
                                    <button
                                      onClick={() => handleDownloadReceipt(p)}
                                      disabled={downloadingId === p.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60"
                                    >
                                      {downloadingId === p.id ? (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                      ) : (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                      )}
                                      PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upcoming bookings */}
                      {client.upcomingBookings.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Upcoming Services</p>
                          <div className="space-y-2">
                            {client.upcomingBookings.map((b) => (
                              <div key={b.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/8">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">{b.event_type || 'Consultation'}</p>
                                    <p className="text-xs text-muted-foreground font-light">{fmtDateTime(b.start_time)}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${statusBadge(b.status)}`}>
                                  {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
