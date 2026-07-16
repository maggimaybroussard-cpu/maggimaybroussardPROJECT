'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  created_at: string;
}

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface RetainerTimeLog {
  id: string;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  logged_at: string;
}

interface RetainerHoursRow {
  subscriptionId: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  allocatedHours: number;
  consumedHours: number;
  remainingHours: number;
  utilizationPct: number;
  status: string;
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
  color: string;
}

type DateRange = '30d' | '90d' | '6m' | '1y' | 'all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysDiff(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getDateRangeStart(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'all': return null;
  }
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba'];
const STATUS_PALETTE: Record<string, string> = {
  succeeded: '#355E3B',
  paid: '#355E3B',
  pending: '#C8965A',
  requires_payment_method: '#C8965A',
  overdue: '#dc2626',
  cancelled: '#6b7280',
  failed: '#dc2626',
  refunded: '#6b7280',
};

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, accent = false,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportingDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('6m');
  const [clientSearch, setClientSearch] = useState('');
  const [exportingPayments, setExportingPayments] = useState(false);
  const [exportingInvoices, setExportingInvoices] = useState(false);

  // Raw data
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [retainerRows, setRetainerRows] = useState<RetainerHoursRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsRes, invoicesRes, subsRes, logsRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id,amount,currency,payment_status,payment_type,customer_name,customer_email,created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('client_invoices')
          .select('id,invoice_number,invoice_date,due_date,amount,amount_paid,currency,status,created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('retainer_subscriptions')
          .select('id,customer_name,customer_email,plan_name,amount,currency,status,metadata')
          .in('status', ['active', 'trialing']),
        supabase
          .from('retainer_time_logs')
          .select('id,retainer_subscription_id,hours,description,work_date,logged_at'),
      ]);

      const rawPayments: Payment[] = paymentsRes.data ?? [];
      const rawInvoices: Invoice[] = invoicesRes.data ?? [];
      const rawSubs: RetainerSubscription[] = subsRes.data ?? [];
      const rawLogs: RetainerTimeLog[] = logsRes.data ?? [];

      setPayments(rawPayments);
      setInvoices(rawInvoices);

      // ── Retainer hours ──────────────────────────────────────────────────────
      const logsBySubId: Record<string, number> = {};
      rawLogs.forEach((l) => {
        logsBySubId[l.retainer_subscription_id] = (logsBySubId[l.retainer_subscription_id] ?? 0) + Number(l.hours);
      });

      const rows: RetainerHoursRow[] = rawSubs.map((sub) => {
        const allocated = Number((sub.metadata as Record<string, unknown>)?.allocated_hours ?? 0) || 10;
        const consumed = logsBySubId[sub.id] ?? 0;
        const remaining = Math.max(0, allocated - consumed);
        const pct = allocated > 0 ? Math.min(100, Math.round((consumed / allocated) * 100)) : 0;
        return {
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          customerEmail: sub.customer_email,
          planName: sub.plan_name,
          allocatedHours: allocated,
          consumedHours: consumed,
          remainingHours: remaining,
          utilizationPct: pct,
          status: sub.status,
        };
      });
      setRetainerRows(rows);

    } catch (e) {
      setError('Failed to load reporting data. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const rangeStart = useMemo(() => getDateRangeStart(dateRange), [dateRange]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const inRange = rangeStart ? new Date(p.created_at) >= rangeStart : true;
      const matchesClient = clientSearch
        ? p.customer_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          p.customer_email.toLowerCase().includes(clientSearch.toLowerCase())
        : true;
      return inRange && matchesClient;
    });
  }, [payments, rangeStart, clientSearch]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const inRange = rangeStart ? new Date(inv.created_at) >= rangeStart : true;
      return inRange;
    });
  }, [invoices, rangeStart]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────
  const totalRevenue = filteredPayments
    .filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0);

  const totalOutstanding = filteredInvoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((s, inv) => s + (Number(inv.amount) - Number(inv.amount_paid)), 0);

  const totalInvoiced = filteredInvoices.reduce((s, inv) => s + Number(inv.amount), 0);

  const totalHoursConsumed = retainerRows.reduce((s, r) => s + r.consumedHours, 0);
  const totalHoursAllocated = retainerRows.reduce((s, r) => s + r.allocatedHours, 0);

  // ── Chart data ────────────────────────────────────────────────────────────
  const agingBuckets = useMemo((): AgingBucket[] => {
    const outstanding = filteredInvoices.filter((inv) => inv.status === 'pending' || inv.status === 'overdue');
    const buckets: AgingBucket[] = [
      { label: 'Current (0–30d)', count: 0, amount: 0, color: '#355E3B' },
      { label: '31–60 days', count: 0, amount: 0, color: '#C8965A' },
      { label: '61–90 days', count: 0, amount: 0, color: '#d97706' },
      { label: '90+ days', count: 0, amount: 0, color: '#dc2626' },
    ];
    outstanding.forEach((inv) => {
      const age = daysDiff(inv.due_date);
      const outstanding_amt = inv.amount - inv.amount_paid;
      if (age <= 30) { buckets[0].count++; buckets[0].amount += outstanding_amt; }
      else if (age <= 60) { buckets[1].count++; buckets[1].amount += outstanding_amt; }
      else if (age <= 90) { buckets[2].count++; buckets[2].amount += outstanding_amt; }
      else { buckets[3].count++; buckets[3].amount += outstanding_amt; }
    });
    return buckets;
  }, [filteredInvoices]);

  const paymentStatusData = useMemo(() => {
    const statusMap: Record<string, { count: number; amount: number }> = {};
    filteredPayments.forEach((p) => {
      const key = p.payment_status;
      if (!statusMap[key]) statusMap[key] = { count: 0, amount: 0 };
      statusMap[key].count++;
      statusMap[key].amount += Number(p.amount);
    });
    return Object.entries(statusMap).map(([name, v]) => ({ name, value: v.count, amount: v.amount }));
  }, [filteredPayments]);

  const revenueByMonth = useMemo(() => {
    const monthCount = dateRange === '30d' ? 1 : dateRange === '90d' ? 3 : dateRange === '1y' ? 12 : 6;
    const monthMap: Record<string, { revenue: number; invoiced: number }> = {};
    const now = new Date();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMap[key] = { revenue: 0, invoiced: 0 };
    }
    filteredPayments.forEach((p) => {
      if (p.payment_status === 'succeeded' || p.payment_status === 'paid') {
        const key = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthMap[key]) monthMap[key].revenue += Number(p.amount);
      }
    });
    filteredInvoices.forEach((inv) => {
      const key = new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (monthMap[key]) monthMap[key].invoiced += Number(inv.amount);
    });
    return Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));
  }, [filteredPayments, filteredInvoices, dateRange]);

  // Top clients by revenue
  const topClients = useMemo(() => {
    const clientMap: Record<string, { name: string; revenue: number; txns: number }> = {};
    filteredPayments
      .filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid')
      .forEach((p) => {
        const key = p.customer_email;
        if (!clientMap[key]) clientMap[key] = { name: p.customer_name, revenue: 0, txns: 0 };
        clientMap[key].revenue += Number(p.amount);
        clientMap[key].txns++;
      });
    return Object.values(clientMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filteredPayments]);

  // ── Export handlers ───────────────────────────────────────────────────────
  function handleExportPayments() {
    setExportingPayments(true);
    try {
      exportCSV(
        `payments-export-${new Date().toISOString().split('T')[0]}.csv`,
        ['Date', 'Client', 'Email', 'Type', 'Amount', 'Currency', 'Status'],
        filteredPayments.map((p) => [
          fmtDate(p.created_at),
          p.customer_name,
          p.customer_email,
          p.payment_type,
          String(p.amount),
          p.currency.toUpperCase(),
          p.payment_status,
        ])
      );
    } finally {
      setExportingPayments(false);
    }
  }

  function handleExportInvoices() {
    setExportingInvoices(true);
    try {
      exportCSV(
        `invoices-export-${new Date().toISOString().split('T')[0]}.csv`,
        ['Invoice #', 'Date', 'Due Date', 'Amount', 'Amount Paid', 'Balance', 'Currency', 'Status'],
        filteredInvoices.map((inv) => [
          inv.invoice_number,
          fmtDate(inv.invoice_date),
          fmtDate(inv.due_date),
          String(inv.amount),
          String(inv.amount_paid),
          String(Number(inv.amount) - Number(inv.amount_paid)),
          inv.currency.toUpperCase(),
          inv.status,
        ])
      );
    } finally {
      setExportingInvoices(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="w-24 h-3 bg-muted/50 rounded mb-3" />
              <div className="w-32 h-8 bg-muted/60 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {error}
        <button onClick={fetchAll} className="ml-auto underline text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Filters & Export Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-1 bg-secondary/40 border border-border rounded-xl p-1">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Client search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Filter by client…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          {clientSearch && (
            <button onClick={() => setClientSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportPayments}
            disabled={exportingPayments || filteredPayments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Payments
          </button>
          <button
            onClick={handleExportInvoices}
            disabled={exportingInvoices || filteredInvoices.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Invoices
          </button>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Revenue Collected"
          value={fmt(totalRevenue)}
          sub={`${filteredPayments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length} payments`}
          accent
        />
        <KPICard
          label="Total Invoiced"
          value={fmt(totalInvoiced)}
          sub={`${filteredInvoices.length} invoices issued`}
        />
        <KPICard
          label="Outstanding Balance"
          value={fmt(totalOutstanding)}
          sub={`${filteredInvoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length} open invoices`}
        />
        <KPICard
          label="Retainer Hours Used"
          value={`${totalHoursConsumed.toFixed(1)} / ${totalHoursAllocated}h`}
          sub={`${retainerRows.length} active retainer${retainerRows.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ── Revenue by Month + Payment Status ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Revenue vs. Invoiced</h3>
          <p className="text-xs text-muted-foreground mb-5">Collected payments compared to invoiced amounts</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value), name === 'revenue' ? 'Collected' : 'Invoiced']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} formatter={(v) => v === 'revenue' ? 'Collected' : 'Invoiced'} />
              <Bar dataKey="revenue" name="revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="invoiced" name="invoiced" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment status pie */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Payment Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Breakdown by transaction status</p>
          {paymentStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No payment data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={38}
                    paddingAngle={2}
                  >
                    {paymentStatusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_PALETTE[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props) => [
                      `${value} txn${value !== 1 ? 's' : ''} · ${fmt((props.payload as { amount: number }).amount)}`,
                      name,
                    ]}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-col gap-2">
                {paymentStatusData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_PALETTE[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-foreground capitalize">{entry.name.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{entry.value}</span>
                      <span className="text-foreground font-medium">{fmt(entry.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top Clients by Revenue ────────────────────────────────────────────── */}
      {topClients.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Top Clients by Revenue</h3>
              <p className="text-xs text-muted-foreground">Highest-value clients in the selected period</p>
            </div>
            <span className="text-xs font-semibold text-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border">
              {topClients.length} clients
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip
                formatter={(value: number) => [fmt(value), 'Revenue']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: 'var(--muted-foreground)', formatter: (v: number) => fmt(v) }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Invoice Aging + Retainer Hours ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Invoice aging */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Outstanding Invoice Aging</h3>
              <p className="text-xs text-muted-foreground">Unpaid invoices grouped by days past due</p>
            </div>
            <span className="text-xs font-semibold text-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border">
              {fmt(totalOutstanding)} total
            </span>
          </div>
          {agingBuckets.every((b) => b.count === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span className="text-sm">No outstanding invoices</span>
            </div>
          ) : (
            <div className="space-y-4">
              {agingBuckets.map((bucket) => {
                const maxAmt = Math.max(...agingBuckets.map((b) => b.amount), 1);
                const barWidth = bucket.amount > 0 ? Math.max(4, Math.round((bucket.amount / maxAmt) * 100)) : 0;
                return (
                  <div key={bucket.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground font-medium">{bucket.label}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{bucket.count} inv.</span>
                        <span className="font-semibold text-foreground">{fmt(bucket.amount)}</span>
                      </div>
                    </div>
                    <div className="h-7 bg-secondary/40 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
                        style={{ width: `${barWidth}%`, background: bucket.color }}
                      >
                        {barWidth > 18 && (
                          <span className="text-xs text-white font-medium">{barWidth}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outstanding invoices table */}
          {filteredInvoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length > 0 && (
            <div className="mt-6 pt-5 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Open Invoices</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Invoice</th>
                      <th className="text-left pb-2 text-muted-foreground font-semibold uppercase tracking-widest hidden sm:table-cell">Due</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Balance</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices
                      .filter((i) => i.status === 'pending' || i.status === 'overdue')
                      .slice(0, 8)
                      .map((inv) => {
                        const age = daysDiff(inv.due_date);
                        const balance = Number(inv.amount) - Number(inv.amount_paid);
                        return (
                          <tr key={inv.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 text-foreground font-medium">{inv.invoice_number}</td>
                            <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{fmtDate(inv.due_date)}</td>
                            <td className="py-2.5 text-right font-semibold text-foreground">{fmt(balance)}</td>
                            <td className="py-2.5 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                inv.status === 'overdue' || age > 30 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {inv.status === 'overdue' ? 'Overdue' : age > 0 ? `${age}d` : 'Current'}
                              </span>
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

        {/* Retainer hours */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Retainer Hours</h3>
              <p className="text-xs text-muted-foreground">Consumed vs. available per active retainer</p>
            </div>
            <span className="text-xs font-semibold text-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border">
              {retainerRows.length} active
            </span>
          </div>

          {retainerRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-sm">No active retainers</span>
            </div>
          ) : (
            <div className="space-y-5">
              {retainerRows.map((row) => {
                const dangerZone = row.utilizationPct >= 80;
                const barColor = row.utilizationPct >= 90 ? '#dc2626' : row.utilizationPct >= 70 ? '#C8965A' : '#355E3B';
                return (
                  <div key={row.subscriptionId}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{row.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{row.planName}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-sm font-semibold ${dangerZone ? 'text-red-600' : 'text-foreground'}`}>
                          {row.consumedHours.toFixed(1)}h / {row.allocatedHours}h
                        </p>
                        <p className="text-xs text-muted-foreground">{row.remainingHours.toFixed(1)}h left</p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${row.utilizationPct}%`, background: barColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{row.utilizationPct}% utilized</span>
                      {dangerZone && (
                        <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          Low hours
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary totals */}
          {retainerRows.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{totalHoursAllocated}h</p>
                <p className="text-xs text-muted-foreground">Allocated</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{totalHoursConsumed.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Consumed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-primary">{(totalHoursAllocated - totalHoursConsumed).toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Payments Table ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg text-foreground mb-1">Recent Payments</h3>
            <p className="text-xs text-muted-foreground">Latest transactions across all payment types</p>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-full border border-border">
            {filteredPayments.length} total
          </span>
        </div>
        {filteredPayments.length === 0 ? (
          <div className="px-6 pb-8 text-center text-muted-foreground text-sm">No payment records found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                  <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.slice(0, 15).map((p, i) => (
                  <tr key={p.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground">{p.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{p.customer_email}</p>
                    </td>
                    <td className="px-6 py-3.5 hidden sm:table-cell text-muted-foreground capitalize">
                      {p.payment_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-3.5 hidden md:table-cell text-muted-foreground">
                      {fmtDate(p.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-foreground">
                      {fmt(Number(p.amount), p.currency)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize"
                        style={{
                          background: `${STATUS_PALETTE[p.payment_status] ?? '#6b7280'}18`,
                          color: STATUS_PALETTE[p.payment_status] ?? '#6b7280',
                          borderColor: `${STATUS_PALETTE[p.payment_status] ?? '#6b7280'}40`,
                        }}
                      >
                        {p.payment_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
