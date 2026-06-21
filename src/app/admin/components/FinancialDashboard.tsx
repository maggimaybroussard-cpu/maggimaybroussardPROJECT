'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueMetrics {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  avgInvoiceValue: number;
  collectionRate: number;
  outstandingBalance: number;
}

interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface PendingInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  due_date: string;
  created_at: string;
  client_name: string;
  client_email: string;
  days_overdue: number;
}

interface CasePipelineStage {
  stage: string;
  label: string;
  count: number;
  revenue: number;
  color: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoiced: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtShort(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#c8e6d0', '#1a3d22', '#2d5c3a'];
const ACCENT = '#355E3B';

const PIPELINE_STAGES: CasePipelineStage[] = [
  { stage: 'inquiry', label: 'Inquiry', count: 0, revenue: 0, color: '#3b82f6' },
  { stage: 'consultation_booked', label: 'Consultation', count: 0, revenue: 0, color: '#8b5cf6' },
  { stage: 'proposal_sent', label: 'Proposal Sent', count: 0, revenue: 0, color: '#f59e0b' },
  { stage: 'active_client', label: 'Active Client', count: 0, revenue: 0, color: '#355E3B' },
  { stage: 'completed', label: 'Completed', count: 0, revenue: 0, color: '#10b981' },
  { stage: 'closed', label: 'Closed', count: 0, revenue: 0, color: '#6b7280' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  trend,
  trendUp,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${accent ? 'bg-primary text-white border-primary' : 'bg-card border-border'}`}>
      <p className={`text-xs uppercase tracking-widest font-semibold ${accent ? 'text-white/70' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-foreground'}`}>{value}</p>
      {sub && <p className={`text-xs ${accent ? 'text-white/60' : 'text-muted-foreground'}`}>{sub}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trendUp ? 'text-emerald-500' : 'text-red-400'}`}>
          <span>{trendUp ? '↑' : '↓'}</span>
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancialDashboard() {
  const supabase = createClient();

  const [metrics, setMetrics] = useState<RevenueMetrics>({
    totalRevenue: 0,
    thisMonthRevenue: 0,
    lastMonthRevenue: 0,
    avgInvoiceValue: 0,
    collectionRate: 0,
    outstandingBalance: 0,
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBreakdown[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [pipeline, setPipeline] = useState<CasePipelineStage[]>(PIPELINE_STAGES);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'overdue' | 'due_soon'>('all');
  const [liveFlash, setLiveFlash] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // ── Payments ──────────────────────────────────────────────────────────
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, currency, payment_type, payment_status, created_at')
        .eq('payment_status', 'succeeded');

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      let totalRevenue = 0;
      let thisMonthRevenue = 0;
      let lastMonthRevenue = 0;
      const methodMap: Record<string, { amount: number; count: number }> = {};

      for (const p of payments ?? []) {
        const amt = p.amount ?? 0;
        totalRevenue += amt;
        const d = new Date(p.created_at);
        if (d >= thisMonthStart) thisMonthRevenue += amt;
        if (d >= lastMonthStart && d <= lastMonthEnd) lastMonthRevenue += amt;

        const method = p.payment_type ?? 'card';
        if (!methodMap[method]) methodMap[method] = { amount: 0, count: 0 };
        methodMap[method].amount += amt;
        methodMap[method].count += 1;
      }

      const totalMethodAmt = Object.values(methodMap).reduce((s, v) => s + v.amount, 0) || 1;
      const methodLabels: Record<string, string> = {
        card: 'Credit / Debit Card',
        ach: 'ACH Bank Transfer',
        ach_or_card: 'Card / ACH',
        payment_plan: 'Payment Plan',
        cash_app: 'Cash App',
        venmo: 'Venmo',
        zelle: 'Zelle',
        paypal: 'PayPal',
        google_pay: 'Google Pay',
        apple_pay: 'Apple Pay',
      };
      const methodBreakdown: PaymentMethodBreakdown[] = Object.entries(methodMap)
        .map(([method, v]) => ({
          method: methodLabels[method] ?? method,
          amount: v.amount,
          count: v.count,
          percentage: Math.round((v.amount / totalMethodAmt) * 100),
        }))
        .sort((a, b) => b.amount - a.amount);

      setPaymentMethods(methodBreakdown);

      // ── Monthly Revenue (last 6 months) ───────────────────────────────────
      const monthlyMap: Record<string, { revenue: number; invoiced: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyMap[key] = { revenue: 0, invoiced: 0 };
      }
      for (const p of payments ?? []) {
        const d = new Date(p.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyMap[key]) monthlyMap[key].revenue += p.amount ?? 0;
      }

      // ── Invoices ──────────────────────────────────────────────────────────
      const { data: invoices } = await supabase
        .from('client_invoices')
        .select(`
          id, invoice_number, amount, amount_paid, currency, status, due_date, created_at,
          contact_inquiries ( name, email )
        `)
        .in('status', ['sent', 'overdue', 'partial', 'draft']);

      let totalInvoiced = 0;
      let totalPaid = 0;
      let outstandingBalance = 0;
      const pending: PendingInvoice[] = [];

      for (const inv of invoices ?? []) {
        const amt = inv.amount ?? 0;
        const paid = inv.amount_paid ?? 0;
        totalInvoiced += amt;
        totalPaid += paid;
        outstandingBalance += amt - paid;

        const daysLeft = daysUntil(inv.due_date);
        pending.push({
          id: inv.id,
          invoice_number: inv.invoice_number ?? '—',
          amount: amt,
          amount_paid: paid,
          currency: inv.currency ?? 'usd',
          status: inv.status,
          due_date: inv.due_date,
          created_at: inv.created_at,
          client_name: (inv.contact_inquiries as { name: string; email: string } | null)?.name ?? 'Unknown',
          client_email: (inv.contact_inquiries as { name: string; email: string } | null)?.email ?? '',
          days_overdue: daysLeft < 0 ? Math.abs(daysLeft) : 0,
        });

        const d = new Date(inv.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyMap[key]) monthlyMap[key].invoiced += amt;
      }

      pending.sort((a, b) => a.days_overdue > 0 ? -1 : b.days_overdue > 0 ? 1 : daysUntil(a.due_date) - daysUntil(b.due_date));
      setPendingInvoices(pending);

      const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
      const avgInvoiceValue = (invoices?.length ?? 0) > 0 ? Math.round(totalInvoiced / (invoices?.length ?? 1)) : 0;

      setMetrics({
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        avgInvoiceValue,
        collectionRate,
        outstandingBalance,
      });

      setMonthlyRevenue(
        Object.entries(monthlyMap).map(([month, v]) => ({ month, revenue: v.revenue, invoiced: v.invoiced }))
      );

      // ── Case Pipeline ─────────────────────────────────────────────────────
      const { data: cases } = await supabase
        .from('contact_inquiries')
        .select('booking_stage, id');

      const stageCount: Record<string, number> = {};
      for (const c of cases ?? []) {
        const s = c.booking_stage ?? 'inquiry';
        stageCount[s] = (stageCount[s] ?? 0) + 1;
      }

      setPipeline(
        PIPELINE_STAGES.map((s) => ({ ...s, count: stageCount[s.stage] ?? 0 }))
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const invoiceChannel = supabase
      .channel('financial-dashboard-invoices-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_invoices' },
        (payload) => {
          const newRow = payload.new as { status?: string; invoice_number?: string };
          const oldRow = payload.old as { status?: string };
          if (payload.eventType === 'INSERT') {
            setLiveFlash(`New invoice posted: ${newRow.invoice_number ?? ''}`);
          } else if (payload.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
            if (newRow.status === 'paid') {
              setLiveFlash(`Invoice ${newRow.invoice_number ?? ''} marked as paid`);
            } else if (newRow.status === 'overdue') {
              setLiveFlash(`Invoice ${newRow.invoice_number ?? ''} is now overdue`);
            } else {
              setLiveFlash(`Invoice ${newRow.invoice_number ?? ''} updated to ${newRow.status}`);
            }
          }
          loadData();
        }
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel('financial-dashboard-payments-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        () => {
          setLiveFlash('New payment received');
          loadData();
        }
      )
      .subscribe();

    const caseStageChannel = supabase
      .channel('financial-dashboard-cases-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_inquiries' },
        (payload) => {
          const newRow = payload.new as { booking_stage?: string; name?: string };
          const oldRow = payload.old as { booking_stage?: string };
          if (newRow.booking_stage !== oldRow?.booking_stage) {
            const stageLabels: Record<string, string> = {
              inquiry: 'Inquiry', consultation_booked: 'Consultation Booked',
              proposal_sent: 'Proposal Sent', active_client: 'Active Client',
              completed: 'Completed', closed: 'Closed',
            };
            setLiveFlash(`Case stage advanced: ${newRow.name ?? 'Client'} → ${stageLabels[newRow.booking_stage ?? ''] ?? newRow.booking_stage}`);
            loadData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invoiceChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(caseStageChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear flash message
  useEffect(() => {
    if (!liveFlash) return;
    const t = setTimeout(() => setLiveFlash(null), 5000);
    return () => clearTimeout(t);
  }, [liveFlash]);

  const filteredInvoices = pendingInvoices.filter((inv) => {
    if (invoiceFilter === 'overdue') return inv.days_overdue > 0;
    if (invoiceFilter === 'due_soon') return inv.days_overdue === 0 && daysUntil(inv.due_date) <= 7;
    return true;
  });

  const monthTrend = metrics.lastMonthRevenue > 0
    ? `${Math.abs(Math.round(((metrics.thisMonthRevenue - metrics.lastMonthRevenue) / metrics.lastMonthRevenue) * 100))}% vs last month`
    : undefined;
  const monthTrendUp = metrics.thisMonthRevenue >= metrics.lastMonthRevenue;

  const totalPipelineCount = pipeline.reduce((s, p) => s + p.count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading financial data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* ── Live Update Banner ── */}
      {liveFlash && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{liveFlash}</span>
          <button onClick={() => setLiveFlash(null)} className="ml-auto text-emerald-500 hover:text-emerald-700 text-xs">✕</button>
        </div>
      )}

      {/* ── Key Financial Metrics ── */}
      <section>
        <SectionHeader title="Key Financial Metrics" subtitle="Revenue collected, outstanding balance, and collection performance" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Total Revenue"
            value={fmtShort(metrics.totalRevenue)}
            sub="All time collected"
            accent
          />
          <MetricCard
            label="This Month"
            value={fmtShort(metrics.thisMonthRevenue)}
            sub="Revenue collected"
            trend={monthTrend}
            trendUp={monthTrendUp}
          />
          <MetricCard
            label="Last Month"
            value={fmtShort(metrics.lastMonthRevenue)}
            sub="Revenue collected"
          />
          <MetricCard
            label="Outstanding"
            value={fmtShort(metrics.outstandingBalance)}
            sub="Unpaid invoices"
            trend={metrics.outstandingBalance > 0 ? `${pendingInvoices.length} open invoices` : undefined}
            trendUp={false}
          />
          <MetricCard
            label="Avg Invoice"
            value={fmtShort(metrics.avgInvoiceValue)}
            sub="Per invoice issued"
          />
          <MetricCard
            label="Collection Rate"
            value={`${metrics.collectionRate}%`}
            sub="Paid vs invoiced"
            trend={metrics.collectionRate >= 80 ? 'On track' : 'Below target'}
            trendUp={metrics.collectionRate >= 80}
          />
        </div>
      </section>

      {/* ── Revenue Trend + Payment Method Breakdown ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <SectionHeader title="Revenue Trend" subtitle="Monthly collected revenue vs. invoiced — last 6 months" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyRevenue} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtShort(v)} />
              <Tooltip
                formatter={(value: number, name: string) => [fmtShort(value), name === 'revenue' ? 'Collected' : 'Invoiced']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend formatter={(v) => v === 'revenue' ? 'Collected' : 'Invoiced'} wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="invoiced" fill="#d1fae5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader title="Payment Methods" subtitle="Revenue by payment channel" />
          {paymentMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-muted-foreground">No payment data yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={38}
                    paddingAngle={2}
                  >
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [fmtShort(value), 'Revenue']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {paymentMethods.slice(0, 5).map((m, i) => (
                  <div key={m.method} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-foreground truncate">{m.method}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-foreground">{fmtShort(m.amount)}</span>
                      <span className="text-xs text-muted-foreground w-8 text-right">{m.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Case Pipeline Status ── */}
      <section>
        <SectionHeader title="Case Pipeline Status" subtitle={`${totalPipelineCount} total cases across all stages`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pipeline.map((stage) => {
            const pct = totalPipelineCount > 0 ? Math.round((stage.count / totalPipelineCount) * 100) : 0;
            return (
              <div key={stage.stage} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{stage.label}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: stage.color }}
                  />
                </div>
                <p className="text-3xl font-bold text-foreground">{stage.count}</p>
                <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: stage.color }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{pct}% of pipeline</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pending Invoices ── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <SectionHeader
            title="Pending Invoices"
            subtitle={`${pendingInvoices.filter((i) => i.days_overdue > 0).length} overdue · ${pendingInvoices.filter((i) => i.days_overdue === 0 && daysUntil(i.due_date) <= 7).length} due within 7 days`}
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(['all', 'overdue', 'due_soon'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setInvoiceFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  invoiceFilter === f
                    ? 'bg-primary text-white' :'bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : 'Due Soon'}
              </button>
            ))}
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <p className="text-sm text-muted-foreground">No invoices match this filter</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoice</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Amount</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Paid</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Balance</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Due Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInvoices.map((inv) => {
                    const balance = inv.amount - inv.amount_paid;
                    const dLeft = daysUntil(inv.due_date);
                    const isOverdue = inv.days_overdue > 0;
                    const isDueSoon = !isOverdue && dLeft <= 7;
                    return (
                      <tr key={inv.id} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-foreground">{inv.invoice_number}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground text-sm">{inv.client_name}</p>
                          <p className="text-xs text-muted-foreground">{inv.client_email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-foreground">{fmt(inv.amount, inv.currency)}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{fmt(inv.amount_paid, inv.currency)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-foreground">{fmt(balance, inv.currency)}</td>
                        <td className="px-5 py-3.5 text-sm text-foreground">{fmtDate(inv.due_date)}</td>
                        <td className="px-5 py-3.5">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              {inv.days_overdue}d overdue
                            </span>
                          ) : isDueSoon ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Due in {dLeft}d
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              {inv.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Summary footer */}
            <div className="border-t border-border px-5 py-3 bg-secondary/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} shown</p>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Outstanding</p>
                  <p className="text-sm font-bold text-foreground">{fmtShort(metrics.outstandingBalance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Collection Rate</p>
                  <p className="text-sm font-bold text-foreground">{metrics.collectionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
