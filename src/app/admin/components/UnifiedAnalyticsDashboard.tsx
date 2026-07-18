'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GA4Summary {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  bounceRate: number;
  pageViews: number;
  avgSessionDuration: number;
}

interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
}

interface TopPage {
  page: string;
  title: string;
  pageViews: number;
  bounceRate: number;
}

interface DailyUser {
  date: string;
  users: number;
  sessions: number;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  created_at: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  transactions: number;
}

interface Inquiry {
  id: string;
  status: string;
  service: string;
  created_at: string;
}

type DateRange = '7d' | '30d' | '90d';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9'];
const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function getMonthKey(d: string) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent = false, icon }: { label: string; value: string; sub?: string; accent?: boolean; icon?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UnifiedAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [ga4Data, setGa4Data] = useState<{ summary: GA4Summary; trafficSources: TrafficSource[]; topPages: TopPage[]; dailyUsers: DailyUser[] } | null>(null);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'revenue' | 'leads'>('overview');

  const fetchGA4 = useCallback(async () => {
    setGa4Loading(true);
    try {
      const res = await fetch('/api/admin/ga4');
      if (res.ok) {
        const data = await res.json();
        setGa4Data(data);
      }
    } catch {
      // silently fail
    } finally {
      setGa4Loading(false);
    }
  }, []);

  const fetchDBData = useCallback(async () => {
    setDbLoading(true);
    try {
      const supabase = createClient();
      const cutoff = new Date();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      cutoff.setDate(cutoff.getDate() - days);

      const [paymentsRes, inquiriesRes] = await Promise.all([
        supabase
          .from('client_payments')
          .select('id, amount, currency, payment_status, payment_type, created_at')
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_inquiries')
          .select('id, status, service, created_at')
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false }),
      ]);

      setPayments((paymentsRes.data ?? []) as Payment[]);
      setInquiries((inquiriesRes.data ?? []) as Inquiry[]);
    } catch {
      // silently fail
    } finally {
      setDbLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchGA4(); }, [fetchGA4]);
  useEffect(() => { fetchDBData(); }, [fetchDBData]);

  // ── Computed metrics ──────────────────────────────────────────────────────────
  const totalRevenue = payments.filter(p => p.payment_status === 'paid' || p.payment_status === 'succeeded').reduce((sum, p) => sum + (p.amount / 100), 0);
  const totalLeads = inquiries.length;
  const convertedLeads = inquiries.filter(i => i.status === 'converted' || i.status === 'booked').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  // Monthly revenue chart
  const monthlyRevenue: MonthlyRevenue[] = Object.entries(
    payments
      .filter(p => p.payment_status === 'paid' || p.payment_status === 'succeeded')
      .reduce((acc, p) => {
        const key = getMonthKey(p.created_at);
        if (!acc[key]) acc[key] = { revenue: 0, transactions: 0 };
        acc[key].revenue += p.amount / 100;
        acc[key].transactions += 1;
        return acc;
      }, {} as Record<string, { revenue: number; transactions: number }>)
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ month: formatMonthLabel(key), ...val }));

  // Lead funnel
  const leadFunnel = [
    { step: 'Total Inquiries', count: totalLeads },
    { step: 'Qualified', count: inquiries.filter(i => i.status !== 'spam' && i.status !== 'closed').length },
    { step: 'Booked', count: inquiries.filter(i => i.status === 'booked' || i.status === 'converted').length },
    { step: 'Converted', count: convertedLeads },
  ];

  // Service breakdown
  const serviceBreakdown = Object.entries(
    inquiries.reduce((acc, i) => {
      const s = i.service || 'Other';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([service, count]) => ({ service, count }));

  const isLoading = ga4Loading || dbLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-serif text-foreground">Unified Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue · Leads · Traffic · Conversions — Mixpanel + GA4</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary/40 rounded-xl p-0.5">
            {DATE_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateRange === opt.value ? 'bg-white dark:bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { fetchGA4(); fetchDBData(); }}
            disabled={isLoading}
            className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            <span className={isLoading ? 'animate-spin inline-block' : ''}>↻</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/30 rounded-xl p-1 w-fit">
        {(['overview', 'traffic', 'revenue', 'leads'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Revenue" value={fmt(totalRevenue)} sub={`Last ${dateRange === '7d' ? '7' : dateRange === '30d' ? '30' : '90'} days`} accent icon="💰" />
            <KPICard label="Total Leads" value={fmtShort(totalLeads)} sub={`${convertedLeads} converted`} icon="📋" />
            <KPICard label="Conversion Rate" value={`${conversionRate}%`} sub="Leads → Clients" icon="📈" />
            <KPICard label="GA4 Sessions" value={ga4Data ? fmtShort(ga4Data.summary.sessions) : '—'} sub={ga4Data ? `${fmtShort(ga4Data.summary.totalUsers)} users` : 'Loading…'} icon="👥" />
          </div>

          {/* Revenue trend */}
          {monthlyRevenue.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#355E3B" fill="#355E3B22" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lead funnel */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-4">Lead Funnel</h3>
            <div className="space-y-3">
              {leadFunnel.map((step, i) => {
                const pct = leadFunnel[0].count > 0 ? (step.count / leadFunnel[0].count) * 100 : 0;
                return (
                  <div key={step.step} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{step.step}</span>
                    <div className="flex-1 h-6 bg-secondary/40 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i] }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-10 text-right">{step.count}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Traffic Tab */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          {ga4Loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ga4Data ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <KPICard label="Total Users" value={fmtShort(ga4Data.summary.totalUsers)} sub="GA4" icon="👥" />
                <KPICard label="Sessions" value={fmtShort(ga4Data.summary.sessions)} icon="🔗" />
                <KPICard label="Bounce Rate" value={`${ga4Data.summary.bounceRate?.toFixed(1) ?? '—'}%`} icon="↩️" />
              </div>

              {/* Traffic Sources */}
              {ga4Data.trafficSources?.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-serif text-base text-foreground mb-4">Top Traffic Sources</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={ga4Data.trafficSources} dataKey="sessions" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                          {ga4Data.trafficSources.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Sessions']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {ga4Data.trafficSources.map((src, i) => (
                        <div key={src.source} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-sm text-foreground flex-1 truncate">{src.source}</span>
                          <span className="text-sm font-medium text-foreground">{src.sessions.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">{src.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Users */}
              {ga4Data.dailyUsers?.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-serif text-base text-foreground mb-4">Daily Users</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={ga4Data.dailyUsers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="users" stroke="#355E3B" strokeWidth={2} dot={false} name="Users" />
                      <Line type="monotone" dataKey="sessions" stroke="#6b9e7a" strokeWidth={2} dot={false} name="Sessions" />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Pages */}
              {ga4Data.topPages?.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-serif text-base text-foreground mb-4">Top Pages</h3>
                  <div className="space-y-2">
                    {ga4Data.topPages.slice(0, 8).map((page, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{page.title || page.page}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{page.page}</p>
                        </div>
                        <span className="text-sm font-medium text-foreground">{page.pageViews.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm">GA4 data unavailable</p>
              <p className="text-xs mt-1">Check your GA4 API configuration</p>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="Total Revenue" value={fmt(totalRevenue)} accent icon="💰" />
            <KPICard label="Transactions" value={payments.filter(p => p.payment_status === 'paid' || p.payment_status === 'succeeded').length.toString()} icon="💳" />
            <KPICard label="Avg Transaction" value={payments.filter(p => p.payment_status === 'paid' || p.payment_status === 'succeeded').length > 0 ? fmt(totalRevenue / payments.filter(p => p.payment_status === 'paid' || p.payment_status === 'succeeded').length) : '$0'} icon="📊" />
          </div>

          {monthlyRevenue.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-4">Monthly Revenue</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="revenue" fill="#355E3B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Leads" value={totalLeads.toString()} icon="📋" />
            <KPICard label="Converted" value={convertedLeads.toString()} accent icon="✅" />
            <KPICard label="Conversion Rate" value={`${conversionRate}%`} icon="📈" />
            <KPICard label="New (Unread)" value={inquiries.filter(i => i.status === 'new').length.toString()} icon="🔔" />
          </div>

          {serviceBreakdown.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-4">Leads by Service</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#355E3B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
