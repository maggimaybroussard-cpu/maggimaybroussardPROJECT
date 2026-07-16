'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string;
  created_at: string;
  updated_at: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  customer_email: string;
  created_at: string;
}

interface Invoice {
  id: string;
  amount: number;
  amount_paid: number;
  status: string;
  inquiry_id: string | null;
  created_at: string;
}

interface StageCount {
  stage: string;
  label: string;
  count: number;
  color: string;
}

interface ServiceRevenue {
  service: string;
  revenue: number;
  caseCount: number;
  avgRevenue: number;
}

interface TurnaroundRow {
  service: string;
  avgDays: number;
  minDays: number;
  maxDays: number;
  count: number;
}

interface RetentionMonth {
  month: string;
  newClients: number;
  returningClients: number;
  retentionRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));
}

const STAGE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  inquiry:              { label: 'Inquiry',              color: '#6b7280', order: 0 },
  consultation_booked:  { label: 'Consultation Booked',  color: '#C8965A', order: 1 },
  proposal_sent:        { label: 'Proposal Sent',        color: '#8b5cf6', order: 2 },
  active_client:        { label: 'Active Client',        color: '#355E3B', order: 3 },
  completed:            { label: 'Completed',            color: '#0ea5e9', order: 4 },
  closed:               { label: 'Closed',               color: '#dc2626', order: 5 },
};

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#C8965A', '#d97706', '#8b5cf6', '#0ea5e9', '#ec4899'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, accent = false, trend,
}: { label: string; value: string; sub?: string; accent?: boolean; trend?: { value: number; label: string } }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {trend.value >= 0
              ? <><polyline points="18 15 12 9 6 15"/></>
              : <><polyline points="6 9 12 15 18 9"/></>}
          </svg>
          {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="font-serif text-lg text-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {badge && (
        <span className="text-xs font-semibold text-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border flex-shrink-0 ml-3">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PracticeInsightsDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '6m' | '1y' | 'all'>('6m');

  // Raw data
  const [cases, setCases] = useState<CaseInquiry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Derived
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [serviceRevenue, setServiceRevenue] = useState<ServiceRevenue[]>([]);
  const [turnaroundData, setTurnaroundData] = useState<TurnaroundRow[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionMonth[]>([]);

  const getDateFilter = useCallback(() => {
    const now = new Date();
    if (dateRange === '30d') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString();
    if (dateRange === '90d') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString();
    if (dateRange === '6m') return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    if (dateRange === '1y') return new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
    return null;
  }, [dateRange]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateFilter = getDateFilter();

      let casesQuery = supabase
        .from('contact_inquiries')
        .select('id,name,email,service,status,booking_stage,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (dateFilter) casesQuery = casesQuery.gte('created_at', dateFilter);

      let paymentsQuery = supabase
        .from('payments')
        .select('id,amount,currency,payment_status,payment_type,customer_email,created_at')
        .in('payment_status', ['succeeded', 'paid']);
      if (dateFilter) paymentsQuery = paymentsQuery.gte('created_at', dateFilter);

      let invoicesQuery = supabase
        .from('client_invoices')
        .select('id,amount,amount_paid,status,inquiry_id,created_at');
      if (dateFilter) invoicesQuery = invoicesQuery.gte('created_at', dateFilter);

      const [casesRes, paymentsRes, invoicesRes] = await Promise.all([
        casesQuery,
        paymentsQuery,
        invoicesQuery,
      ]);

      const rawCases: CaseInquiry[] = casesRes.data ?? [];
      const rawPayments: Payment[] = paymentsRes.data ?? [];
      const rawInvoices: Invoice[] = invoicesRes.data ?? [];

      setCases(rawCases);
      setPayments(rawPayments);
      setInvoices(rawInvoices);

      // ── 1. Cases by Stage ──────────────────────────────────────────────────
      const stageMap: Record<string, number> = {};
      rawCases.forEach((c) => {
        const stage = c.booking_stage || 'inquiry';
        stageMap[stage] = (stageMap[stage] ?? 0) + 1;
      });
      const stages: StageCount[] = Object.entries(STAGE_CONFIG)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, cfg]) => ({
          stage: key,
          label: cfg.label,
          count: stageMap[key] ?? 0,
          color: cfg.color,
        }));
      setStageCounts(stages);

      // ── 2. Revenue by Service Type ─────────────────────────────────────────
      // Map invoices to their case's service
      const invoiceByInquiry: Record<string, number> = {};
      rawInvoices.forEach((inv) => {
        if (inv.inquiry_id && (inv.status === 'paid')) {
          invoiceByInquiry[inv.inquiry_id] = (invoiceByInquiry[inv.inquiry_id] ?? 0) + Number(inv.amount_paid || inv.amount);
        }
      });

      // Also map payments by customer email → service via cases
      const emailToService: Record<string, string> = {};
      rawCases.forEach((c) => { emailToService[c.email.toLowerCase()] = c.service; });

      const serviceRevenueMap: Record<string, { revenue: number; caseIds: Set<string> }> = {};

      // Revenue from paid invoices linked to cases
      rawCases.forEach((c) => {
        const rev = invoiceByInquiry[c.id] ?? 0;
        const svc = c.service || 'Other';
        if (!serviceRevenueMap[svc]) serviceRevenueMap[svc] = { revenue: 0, caseIds: new Set() };
        serviceRevenueMap[svc].revenue += rev;
        serviceRevenueMap[svc].caseIds.add(c.id);
      });

      // Revenue from payments matched by email
      rawPayments.forEach((p) => {
        const svc = emailToService[p.customer_email?.toLowerCase()] || p.payment_type?.replace(/_/g, ' ') || 'Other';
        if (!serviceRevenueMap[svc]) serviceRevenueMap[svc] = { revenue: 0, caseIds: new Set() };
        serviceRevenueMap[svc].revenue += Number(p.amount);
      });

      const svcRevenue: ServiceRevenue[] = Object.entries(serviceRevenueMap)
        .map(([service, data]) => ({
          service,
          revenue: data.revenue,
          caseCount: data.caseIds.size,
          avgRevenue: data.caseIds.size > 0 ? Math.round(data.revenue / data.caseIds.size) : 0,
        }))
        .filter((s) => s.revenue > 0 || s.caseCount > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setServiceRevenue(svcRevenue);

      // ── 3. Average Turnaround Time ─────────────────────────────────────────
      const completedCases = rawCases.filter(
        (c) => c.booking_stage === 'completed' || c.booking_stage === 'closed' || c.status === 'closed'
      );
      const turnaroundByService: Record<string, number[]> = {};
      completedCases.forEach((c) => {
        const days = daysBetween(c.created_at, c.updated_at);
        if (days > 0 && days < 1000) {
          const svc = c.service || 'Other';
          if (!turnaroundByService[svc]) turnaroundByService[svc] = [];
          turnaroundByService[svc].push(days);
        }
      });

      const turnaround: TurnaroundRow[] = Object.entries(turnaroundByService)
        .map(([service, days]) => ({
          service,
          avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
          minDays: Math.min(...days),
          maxDays: Math.max(...days),
          count: days.length,
        }))
        .sort((a, b) => b.count - a.count);
      setTurnaroundData(turnaround);

      // ── 4. Client Retention Metrics ────────────────────────────────────────
      // Track unique client emails per month, identify returning clients
      const monthsToShow = dateRange === '30d' ? 1 : dateRange === '90d' ? 3 : dateRange === '6m' ? 6 : dateRange === '1y' ? 12 : 12;
      const now = new Date();
      const monthKeys: string[] = [];
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      }

      // Build set of all emails seen before each month (for "returning" detection)
      const allCasesForRetention = rawCases.slice().sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const seenEmailsBefore: Record<string, Set<string>> = {};
      const monthEmailMap: Record<string, Set<string>> = {};

      monthKeys.forEach((mk) => { monthEmailMap[mk] = new Set(); });

      allCasesForRetention.forEach((c) => {
        const mk = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthEmailMap[mk]) monthEmailMap[mk].add(c.email.toLowerCase());
      });

      // Build cumulative seen set
      const cumulativeSeen = new Set<string>();
      const retention: RetentionMonth[] = monthKeys.map((mk) => {
        const emailsThisMonth = monthEmailMap[mk] ?? new Set<string>();
        let returning = 0;
        let newC = 0;
        emailsThisMonth.forEach((email) => {
          if (cumulativeSeen.has(email)) returning++;
          else newC++;
        });
        emailsThisMonth.forEach((email) => cumulativeSeen.add(email));
        const total = newC + returning;
        const retentionRate = total > 0 ? Math.round((returning / total) * 100) : 0;
        return { month: mk, newClients: newC, returningClients: returning, retentionRate };
      });
      setRetentionData(retention);

    } catch (e) {
      setError('Failed to load practice insights. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [supabase, getDateFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────
  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.booking_stage === 'active_client').length;
  const completedCases = cases.filter((c) => c.booking_stage === 'completed').length;
  const conversionRate = totalCases > 0 ? Math.round((activeCases + completedCases) / totalCases * 100) : 0;

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0)
    + invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid || i.amount), 0);

  const avgTurnaround = turnaroundData.length > 0
    ? Math.round(turnaroundData.reduce((s, r) => s + r.avgDays * r.count, 0) / turnaroundData.reduce((s, r) => s + r.count, 0))
    : 0;

  const overallRetentionRate = retentionData.length > 0
    ? Math.round(retentionData.reduce((s, r) => s + r.retentionRate, 0) / retentionData.filter((r) => r.newClients + r.returningClients > 0).length || 0)
    : 0;

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
            <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse h-72" />
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

      {/* ── Header + Date Range Filter ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Practice Insights</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Custom reports on cases, revenue, turnaround, and client retention</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/40 border border-border rounded-xl p-1">
          {(['30d', '90d', '6m', '1y', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === r
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'All Time' : r}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Cases"
          value={totalCases.toString()}
          sub={`${activeCases} active · ${completedCases} completed`}
          accent
        />
        <KPICard
          label="Total Revenue"
          value={fmt(totalRevenue)}
          sub={`${serviceRevenue.length} service type${serviceRevenue.length !== 1 ? 's' : ''}`}
        />
        <KPICard
          label="Avg. Turnaround"
          value={avgTurnaround > 0 ? `${avgTurnaround}d` : '—'}
          sub={turnaroundData.length > 0 ? `across ${turnaroundData.reduce((s, r) => s + r.count, 0)} closed cases` : 'No closed cases yet'}
        />
        <KPICard
          label="Client Retention"
          value={overallRetentionRate > 0 ? `${overallRetentionRate}%` : '—'}
          sub="returning clients rate"
        />
      </div>

      {/* ── Row 1: Cases by Stage + Revenue by Service ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Cases by Stage */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            title="Cases by Stage"
            subtitle="Distribution of all cases across pipeline stages"
            badge={`${totalCases} total`}
          />
          {totalCases === 0 ? (
            <EmptyState message="No cases found for this period" />
          ) : (
            <>
              {/* Horizontal bar chart */}
              <div className="space-y-3 mb-6">
                {stageCounts.filter((s) => s.count > 0).map((stage) => {
                  const maxCount = Math.max(...stageCounts.map((s) => s.count), 1);
                  const barWidth = Math.max(4, Math.round((stage.count / maxCount) * 100));
                  const pct = totalCases > 0 ? Math.round((stage.count / totalCases) * 100) : 0;
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                          <span className="text-sm text-foreground font-medium">{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{pct}%</span>
                          <span className="font-semibold text-foreground w-6 text-right">{stage.count}</span>
                        </div>
                      </div>
                      <div className="h-6 bg-secondary/40 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-700 flex items-center pl-2.5"
                          style={{ width: `${barWidth}%`, background: stage.color }}
                        >
                          {barWidth > 15 && (
                            <span className="text-[10px] text-white font-semibold">{stage.count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pie chart */}
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={stageCounts.filter((s) => s.count > 0)}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {stageCounts.filter((s) => s.count > 0).map((stage, i) => (
                      <Cell key={i} fill={stage.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} case${value !== 1 ? 's' : ''}`, name]}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Revenue by Service Type */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            title="Revenue by Service Type"
            subtitle="Collected revenue and case volume per service"
            badge={serviceRevenue.length > 0 ? fmt(serviceRevenue.reduce((s, r) => s + r.revenue, 0)) : '$0'}
          />
          {serviceRevenue.length === 0 ? (
            <EmptyState message="No revenue data for this period" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceRevenue} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="service"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'Revenue']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {serviceRevenue.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Service table */}
              <div className="mt-4 pt-4 border-t border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Service</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Cases</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Revenue</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Avg/Case</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRevenue.map((row, i) => (
                      <tr key={row.service} className="border-b border-border/50 last:border-0">
                        <td className="py-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-foreground font-medium truncate max-w-[120px]">{row.service}</span>
                        </td>
                        <td className="py-2 text-right text-muted-foreground">{row.caseCount}</td>
                        <td className="py-2 text-right font-semibold text-foreground">{fmt(row.revenue)}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.avgRevenue > 0 ? fmt(row.avgRevenue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Turnaround Time + Client Retention ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Average Turnaround Time */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            title="Average Turnaround Time"
            subtitle="Days from case creation to completion, by service type"
            badge={avgTurnaround > 0 ? `${avgTurnaround}d avg` : 'No data'}
          />
          {turnaroundData.length === 0 ? (
            <EmptyState message="No completed cases to measure turnaround" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={turnaroundData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="service"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 10) + '…' : v}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}d`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} day${value !== 1 ? 's' : ''}`,
                      name === 'avgDays' ? 'Avg' : name === 'minDays' ? 'Min' : 'Max',
                    ]}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                    formatter={(v) => v === 'avgDays' ? 'Avg Days' : v === 'minDays' ? 'Min Days' : 'Max Days'}
                  />
                  <Bar dataKey="minDays" name="minDays" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgDays" name="avgDays" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxDays" name="maxDays" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Turnaround table */}
              <div className="mt-4 pt-4 border-t border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Service</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Cases</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Min</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Avg</th>
                      <th className="text-right pb-2 text-muted-foreground font-semibold uppercase tracking-widest">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnaroundData.map((row) => (
                      <tr key={row.service} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-foreground font-medium truncate max-w-[120px]">{row.service}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.count}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.minDays}d</td>
                        <td className="py-2 text-right font-semibold text-foreground">{row.avgDays}d</td>
                        <td className="py-2 text-right text-muted-foreground">{row.maxDays}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Client Retention Metrics */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            title="Client Retention Metrics"
            subtitle="New vs. returning clients and monthly retention rate"
            badge={overallRetentionRate > 0 ? `${overallRetentionRate}% avg retention` : 'No data'}
          />
          {retentionData.every((r) => r.newClients + r.returningClients === 0) ? (
            <EmptyState message="No client data for this period" />
          ) : (
            <>
              {/* Stacked bar: new vs returning */}
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={retentionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [value, name === 'newClients' ? 'New Clients' : 'Returning Clients']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(v) => v === 'newClients' ? 'New Clients' : 'Returning Clients'}
                  />
                  <Bar dataKey="newClients" name="newClients" stackId="a" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returningClients" name="returningClients" stackId="a" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Retention rate line */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-widest">Retention Rate %</p>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={retentionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C8965A" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#C8965A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Retention Rate']}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="retentionRate" stroke="#C8965A" strokeWidth={2} fill="url(#retentionGrad)" dot={{ fill: '#C8965A', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Retention summary stats */}
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {retentionData.reduce((s, r) => s + r.newClients, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">New Clients</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {retentionData.reduce((s, r) => s + r.returningClients, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Returning</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-primary">{overallRetentionRate}%</p>
                  <p className="text-xs text-muted-foreground">Avg Rate</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Conversion Funnel ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <SectionHeader
          title="Case Pipeline Funnel"
          subtitle="How cases progress from initial inquiry through to completion"
          badge={`${conversionRate}% conversion`}
        />
        {totalCases === 0 ? (
          <EmptyState message="No cases found for this period" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stageCounts.map((stage, i) => {
              const pct = totalCases > 0 ? Math.round((stage.count / totalCases) * 100) : 0;
              const isLast = i === stageCounts.length - 1;
              return (
                <div key={stage.stage} className="relative">
                  <div
                    className="rounded-xl p-4 text-center border"
                    style={{ background: `${stage.color}12`, borderColor: `${stage.color}30` }}
                  >
                    <p className="text-2xl font-semibold" style={{ color: stage.color }}>{stage.count}</p>
                    <p className="text-xs font-medium text-foreground mt-1 leading-tight">{stage.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
                  </div>
                  {!isLast && (
                    <div className="hidden lg:flex absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-3 h-3">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
