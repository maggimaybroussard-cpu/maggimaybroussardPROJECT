'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
}

interface FunnelStep {
  step: string;
  users: number;
  dropOff: number;
}

interface GA4Data {
  demo: boolean;
  summary: {
    totalUsers: number;
    newUsers: number;
    sessions: number;
    avgSessionDuration: number;
    bounceRate: number;
    pageViews: number;
  };
  trafficSources: TrafficSource[];
  conversionFunnel: FunnelStep[];
  serviceInterest: { service: string; views: number; inquiries: number; conversionRate: number }[];
  topPages: { page: string; title: string; pageViews: number; avgTimeOnPage: number; bounceRate: number }[];
  dailyUsers: { date: string; users: number; sessions: number }[];
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  customer_name: string;
  created_at: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  transactions: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9'];
const ACCENT = '#355E3B';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtShort(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function getDateCutoff(range: DateRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now;
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-serif text-lg text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

// ─── Lead Sources Chart ───────────────────────────────────────────────────────

function LeadSourcesChart({ data, sourceFilter, onSourceFilter }: {
  data: TrafficSource[];
  sourceFilter: string;
  onSourceFilter: (s: string) => void;
}) {
  const filtered = sourceFilter === 'all' ? data : data.filter((d) => d.source === sourceFilter);

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <SectionHeader
          title="Lead Sources"
          description="Traffic acquisition channels driving visitors to your site"
        />
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilter(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 shrink-0"
        >
          <option value="all">All Sources</option>
          {data.map((d) => (
            <option key={d.source} value={d.source}>{d.source}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="sessions"
              nameKey="source"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={2}
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), 'Sessions']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-col gap-2.5">
          {filtered.map((item, i) => (
            <div key={item.source} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-sm text-foreground truncate">{item.source}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <span className="text-sm font-medium text-foreground w-12 text-right">{item.sessions.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Conversion Funnel ────────────────────────────────────────────────────────

function ConversionFunnelChart({ data }: { data: FunnelStep[] }) {
  const maxUsers = data[0]?.users || 1;
  const overallRate = data.length > 1
    ? ((data[data.length - 1].users / data[0].users) * 100).toFixed(1)
    : '—';

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <SectionHeader
        title="Conversion Funnel"
        description="User journey from site visit to confirmed booking"
      />

      <div className="flex flex-col gap-3">
        {data.map((step, i) => {
          const width = Math.round((step.users / maxUsers) * 100);
          const alpha = Math.round(255 * (0.35 + 0.65 * (width / 100))).toString(16).padStart(2, '0');
          return (
            <div key={step.step}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-foreground font-medium">{step.step}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{step.users.toLocaleString()}</span>
                  {step.dropOff > 0 && (
                    <span className="text-xs text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded-full">−{step.dropOff}%</span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-secondary/40 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
                  style={{ width: `${width}%`, background: `${ACCENT}${alpha}` }}
                >
                  {width > 20 && (
                    <span className="text-xs text-white font-medium">{width}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Overall conversion rate</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">{overallRate}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Biggest drop-off</p>
          <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
            {data.slice(1).sort((a, b) => b.dropOff - a.dropOff)[0]?.step ?? '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Trends Chart ─────────────────────────────────────────────────────

function RevenueTrendsChart({ data, dateRange, onDateRange }: {
  data: MonthlyRevenue[];
  dateRange: DateRange;
  onDateRange: (r: DateRange) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <SectionHeader
          title="Revenue Trends"
          description="Monthly revenue collected via Stripe payments"
        />
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 shrink-0">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDateRange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                dateRange === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          No revenue data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${fmtShort(v)}`}
            />
            <Tooltip
              formatter={(value: number) => [fmt(value), 'Revenue']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: ACCENT }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Revenue by Payment Type ──────────────────────────────────────────────────

function RevenueByTypeChart({ data, typeFilter, onTypeFilter }: {
  data: { type: string; amount: number; count: number }[];
  typeFilter: string;
  onTypeFilter: (t: string) => void;
}) {
  const filtered = typeFilter === 'all' ? data : data.filter((d) => d.type === typeFilter);

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <SectionHeader
          title="Revenue by Payment Type"
          description="Breakdown of collected revenue by service category"
        />
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 shrink-0"
        >
          <option value="all">All Types</option>
          {data.map((d) => (
            <option key={d.type} value={d.type}>{d.type}</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={filtered} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={36}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={44}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${fmtShort(v)}`}
          />
          <Tooltip
            formatter={(value: number) => [fmt(value), 'Revenue']}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="amount" name="Revenue" radius={[6, 6, 0, 0]}>
            {filtered.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Daily Traffic vs Revenue ─────────────────────────────────────────────────

function TrafficVsRevenueChart({ gaDaily, revenueByDay }: {
  gaDaily: { date: string; users: number; sessions: number }[];
  revenueByDay: { date: string; revenue: number }[];
}) {
  const merged = gaDaily.map((g) => {
    const rev = revenueByDay.find((r) => r.date === g.date);
    return { date: g.date.slice(5), users: g.users, revenue: rev?.revenue ?? 0 };
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <SectionHeader
        title="Traffic vs Revenue"
        description="Daily site visitors alongside revenue collected — last 30 days"
      />
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={merged} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${fmtShort(v)}`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
            formatter={(value: number, name: string) =>
              name === 'Revenue' ? [fmt(value), name] : [value.toLocaleString(), name]
            }
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          <Line yAxisId="left" type="monotone" dataKey="users" name="Users" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={ACCENT} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GrowthAnalyticsDashboard() {
  const supabase = createClient();

  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ga4Res, paymentsRes] = await Promise.all([
        fetch('/api/admin/ga4').then((r) => r.json()),
        supabase
          .from('payments')
          .select('id,amount,currency,payment_status,payment_type,customer_name,created_at')
          .eq('payment_status', 'succeeded')
          .order('created_at', { ascending: true }),
      ]);

      setGa4Data(ga4Res);
      setPayments(paymentsRes.data ?? []);
    } catch (err) {
      setError('Failed to load analytics data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived: filtered payments ─────────────────────────────────────────────
  const filteredPayments = payments.filter((p) => {
    const cutoff = getDateCutoff(dateRange);
    if (!cutoff) return true;
    return new Date(p.created_at) >= cutoff;
  });

  // ── Monthly revenue ────────────────────────────────────────────────────────
  const monthlyRevenue: MonthlyRevenue[] = (() => {
    const map: Record<string, { revenue: number; transactions: number }> = {};
    filteredPayments.forEach((p) => {
      const key = getMonthKey(p.created_at);
      if (!map[key]) map[key] = { revenue: 0, transactions: 0 };
      map[key].revenue += p.amount / 100;
      map[key].transactions += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ month: formatMonthLabel(key), ...val }));
  })();

  // ── Revenue by type ────────────────────────────────────────────────────────
  const revenueByType = (() => {
    const map: Record<string, { amount: number; count: number }> = {};
    filteredPayments.forEach((p) => {
      const type = p.payment_type
        ? p.payment_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Other';
      if (!map[type]) map[type] = { amount: 0, count: 0 };
      map[type].amount += p.amount / 100;
      map[type].count += 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([type, val]) => ({ type, ...val }));
  })();

  // ── Revenue by day (for overlay chart) ────────────────────────────────────
  const revenueByDay = (() => {
    const map: Record<string, number> = {};
    filteredPayments.forEach((p) => {
      const date = p.created_at.split('T')[0];
      map[date] = (map[date] ?? 0) + p.amount / 100;
    });
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue }));
  })();

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalRevenue = filteredPayments.reduce((s, p) => s + p.amount / 100, 0);
  const totalTransactions = filteredPayments.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const overallConversionRate = ga4Data
    ? ((ga4Data.conversionFunnel[ga4Data.conversionFunnel.length - 1]?.users ?? 0) /
        (ga4Data.conversionFunnel[0]?.users || 1) * 100).toFixed(1)
    : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Demo banner */}
      {ga4Data?.demo && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>GA4 is showing <strong>demo data</strong>. Configure <code className="text-xs bg-amber-100 px-1 rounded">GA4_PROPERTY_ID</code> and <code className="text-xs bg-amber-100 px-1 rounded">GA4_SERVICE_ACCOUNT_KEY</code> to see live data.</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-2xl">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Revenue Period:</span>
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Revenue"
          value={fmt(totalRevenue)}
          sub={`${totalTransactions} transactions`}
          accent
        />
        <KPICard
          label="Avg. Order Value"
          value={fmt(avgOrderValue)}
          sub="Per successful payment"
        />
        <KPICard
          label="Site Visitors"
          value={ga4Data ? fmtShort(ga4Data.summary.totalUsers) : '—'}
          sub="Last 30 days (GA4)"
        />
        <KPICard
          label="Booking Conversion"
          value={`${overallConversionRate}%`}
          sub="Visit → confirmed booking"
        />
      </div>

      {/* Lead Sources + Conversion Funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {ga4Data && (
          <LeadSourcesChart
            data={ga4Data.trafficSources}
            sourceFilter={sourceFilter}
            onSourceFilter={setSourceFilter}
          />
        )}
        {ga4Data && (
          <ConversionFunnelChart data={ga4Data.conversionFunnel} />
        )}
      </div>

      {/* Revenue Trends */}
      <RevenueTrendsChart
        data={monthlyRevenue}
        dateRange={dateRange}
        onDateRange={setDateRange}
      />

      {/* Revenue by Type + Traffic vs Revenue */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RevenueByTypeChart
          data={revenueByType}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
        />
        {ga4Data && (
          <TrafficVsRevenueChart
            gaDaily={ga4Data.dailyUsers}
            revenueByDay={revenueByDay}
          />
        )}
      </div>

      {/* Top pages table */}
      {ga4Data && ga4Data.topPages.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader
            title="Top Pages by Traffic"
            description="Most visited pages driving lead generation"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Page</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Views</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Avg. Time</th>
                  <th className="text-right py-2 pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {ga4Data.topPages.map((page) => (
                  <tr key={page.page} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium text-foreground">{page.title}</p>
                        <p className="text-xs text-muted-foreground">{page.page}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">{page.pageViews.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {Math.floor(page.avgTimeOnPage / 60)}m {Math.floor(page.avgTimeOnPage % 60)}s
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        page.bounceRate > 0.5
                          ? 'bg-red-50 text-red-600'
                          : page.bounceRate > 0.35
                          ? 'bg-amber-50 text-amber-700' :'bg-emerald-50 text-emerald-700'
                      }`}>
                        {(page.bounceRate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
