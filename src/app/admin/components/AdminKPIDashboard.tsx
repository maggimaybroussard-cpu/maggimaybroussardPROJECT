'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIMetrics {
  // Revenue
  revenueMTD: number;
  revenueLastMonth: number;
  revenueYTD: number;
  revenueGrowthPct: number;
  // Cases
  activeCases: number;
  newCasesThisMonth: number;
  closedThisMonth: number;
  avgCaseValue: number;
  // Invoices
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  pendingAmount: number;
  // Leads
  newLeadsThisWeek: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgDaysToConvert: number;
  // Operations
  unreadMessages: number;
  upcomingDeadlines: number;
  overdueDeadlines: number;
  activeRetainers: number;
}

interface RevenuePoint {
  month: string;
  billed: number;
  collected: number;
}

interface StageBreakdown {
  stage: string;
  label: string;
  count: number;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function growthLabel(pct: number) {
  if (pct > 0) return `+${Math.round(pct)}% vs last month`;
  if (pct < 0) return `${Math.round(pct)}% vs last month`;
  return 'No change vs last month';
}

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Consultation',
  proposal_sent: 'Proposal',
  active_client: 'Active',
  retainer_signed: 'Retainer',
  closed: 'Closed',
};

const STAGE_COLORS: Record<string, string> = {
  inquiry: '#94a3b8',
  consultation_booked: '#3b82f6',
  proposal_sent: '#f59e0b',
  active_client: '#10b981',
  retainer_signed: '#8b5cf6',
  closed: '#6b7280',
};

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#c8e6d0'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  alert?: boolean;
  onClick?: () => void;
}

function KPICard({ label, value, sub, subPositive, icon, iconBg, loading, alert, onClick }: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className={`group bg-card border rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-sm w-full ${
        alert ? 'border-red-200 hover:border-red-300' : 'border-border hover:border-primary/30'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {sub && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            subPositive === true ? 'bg-emerald-50 text-emerald-700' :
            subPositive === false ? 'bg-red-50 text-red-700': 'bg-slate-100 text-slate-500'
          }`}>
            {sub}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg mt-1" />
      ) : (
        <p className={`text-2xl font-bold tracking-tight ${alert ? 'text-red-700' : 'text-foreground'}`}>{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AdminKPIDashboardProps {
  onNavigate?: (tab: string) => void;
}

export default function AdminKPIDashboard({ onNavigate }: AdminKPIDashboardProps) {
  const [metrics, setMetrics] = useState<KPIMetrics>({
    revenueMTD: 0, revenueLastMonth: 0, revenueYTD: 0, revenueGrowthPct: 0,
    activeCases: 0, newCasesThisMonth: 0, closedThisMonth: 0, avgCaseValue: 0,
    overdueCount: 0, overdueAmount: 0, collectionRate: 0, pendingAmount: 0,
    newLeadsThisWeek: 0, newLeadsThisMonth: 0, conversionRate: 0, avgDaysToConvert: 0,
    unreadMessages: 0, upcomingDeadlines: 0, overdueDeadlines: 0, activeRetainers: 0,
  });
  const [revenueChart, setRevenueChart] = useState<RevenuePoint[]>([]);
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStr = now.toISOString().split('T')[0];
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        invoicesAllRes,
        activeCasesRes,
        newCasesMTDRes,
        closedMTDRes,
        newLeadsWeekRes,
        newLeadsMTDRes,
        unreadMsgRes,
        upcomingTasksRes,
        overdueTasksRes,
        activeRetainersRes,
        allCasesRes,
      ] = await Promise.all([
        supabase.from('client_invoices').select('amount, amount_paid, status, created_at, inquiry_id'),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .in('booking_stage', ['active_client', 'consultation_booked', 'proposal_sent', 'retainer_signed']),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .eq('booking_stage', 'closed').gte('updated_at', startOfMonth),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        supabase.from('portal_messages').select('id', { count: 'exact', head: true })
          .eq('sender_role', 'client').eq('read_by_admin', false),
        supabase.from('admin_tasks').select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done').gte('due_date', todayStr).lte('due_date', sevenDaysOut),
        supabase.from('admin_tasks').select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done').lt('due_date', todayStr),
        supabase.from('retainer_subscriptions').select('id', { count: 'exact', head: true })
          .in('status', ['active', 'trialing']),
        supabase.from('contact_inquiries').select('booking_stage, created_at, updated_at, status'),
      ]);

      const allInvoices = invoicesAllRes.data || [];

      // Revenue calculations
      const paidInvoices = allInvoices.filter((i) => i.status === 'paid');
      const revenueMTD = paidInvoices
        .filter((i) => i.created_at >= startOfMonth)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueLastMonth = paidInvoices
        .filter((i) => i.created_at >= startOfLastMonth && i.created_at <= endOfLastMonth)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueYTD = paidInvoices
        .filter((i) => i.created_at >= startOfYear)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueGrowthPct = revenueLastMonth > 0
        ? ((revenueMTD - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

      // Invoice metrics
      const overdueInvoices = allInvoices.filter((i) => i.status === 'overdue');
      const overdueAmount = overdueInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0);
      const pendingInvoices = allInvoices.filter((i) => ['sent', 'pending'].includes(i.status));
      const pendingAmount = pendingInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0);
      const totalBilled = allInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);
      const totalCollected = allInvoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

      // Avg case value
      const activeCaseCount = activeCasesRes.count ?? 0;
      const avgCaseValue = activeCaseCount > 0 ? totalBilled / activeCaseCount : 0;

      // Conversion rate (closed / total leads this month)
      const newLeadsMTD = newLeadsMTDRes.count ?? 0;
      const closedMTD = closedMTDRes.count ?? 0;
      const conversionRate = newLeadsMTD > 0 ? (closedMTD / newLeadsMTD) * 100 : 0;

      // Revenue chart (last 6 months)
      const chartData: RevenuePoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
        const monthInvoices = allInvoices.filter((inv) => {
          const d = new Date(inv.created_at);
          return d >= monthStart && d <= monthEnd;
        });
        const billed = monthInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0);
        const collected = monthInvoices.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + (inv.amount_paid ?? inv.amount ?? 0), 0);
        chartData.push({ month: monthLabel, billed, collected });
      }

      // Stage breakdown
      const allCases = allCasesRes.data || [];
      const stageCounts: Record<string, number> = {};
      allCases.forEach((c) => {
        const stage = c.booking_stage || 'inquiry';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
      const breakdown: StageBreakdown[] = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        label: STAGE_LABELS[stage] || stage,
        count,
        color: STAGE_COLORS[stage] || '#94a3b8',
      })).sort((a, b) => b.count - a.count);

      setMetrics({
        revenueMTD,
        revenueLastMonth,
        revenueYTD,
        revenueGrowthPct,
        activeCases: activeCaseCount,
        newCasesThisMonth: newCasesMTDRes.count ?? 0,
        closedThisMonth: closedMTD,
        avgCaseValue,
        overdueCount: overdueInvoices.length,
        overdueAmount,
        collectionRate,
        pendingAmount,
        newLeadsThisWeek: newLeadsWeekRes.count ?? 0,
        newLeadsThisMonth: newLeadsMTD,
        conversionRate,
        avgDaysToConvert: 0,
        unreadMessages: unreadMsgRes.count ?? 0,
        upcomingDeadlines: upcomingTasksRes.count ?? 0,
        overdueDeadlines: overdueTasksRes.count ?? 0,
        activeRetainers: activeRetainersRes.count ?? 0,
      });
      setRevenueChart(chartData);
      setStageBreakdown(breakdown);
      setLastRefreshed(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Practice KPIs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Last refreshed {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Revenue KPIs */}
      <div>
        <SectionHeader
          title="Revenue"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Revenue MTD"
            value={fmtK(metrics.revenueMTD)}
            sub={growthLabel(metrics.revenueGrowthPct)}
            subPositive={metrics.revenueGrowthPct >= 0}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            iconBg="bg-emerald-50 text-emerald-700"
            loading={loading}
          />
          <KPICard
            label="Revenue YTD"
            value={fmtK(metrics.revenueYTD)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            iconBg="bg-blue-50 text-blue-700"
            loading={loading}
          />
          <KPICard
            label="Collection Rate"
            value={fmtPct(metrics.collectionRate)}
            sub={metrics.collectionRate >= 80 ? 'Healthy' : metrics.collectionRate >= 60 ? 'Moderate' : 'Needs attention'}
            subPositive={metrics.collectionRate >= 80}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
            iconBg="bg-purple-50 text-purple-700"
            loading={loading}
          />
          <KPICard
            label="Pending Invoices"
            value={fmtK(metrics.pendingAmount)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
            iconBg="bg-amber-50 text-amber-700"
            loading={loading}
            onClick={() => onNavigate?.('invoices')}
          />
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Revenue Trend (6 months)</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Billed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Collected</span>
          </div>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#355E3B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmtK(value), name === 'billed' ? 'Billed' : 'Collected']}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="billed" stroke="#355E3B" strokeWidth={2} fill="url(#billedGrad)" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#collectedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cases + Leads KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases */}
        <div>
          <SectionHeader
            title="Cases"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              label="Active Cases"
              value={String(metrics.activeCases)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              iconBg="bg-emerald-50 text-emerald-700"
              loading={loading}
              onClick={() => onNavigate?.('cases')}
            />
            <KPICard
              label="New This Month"
              value={String(metrics.newCasesThisMonth)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
              iconBg="bg-blue-50 text-blue-700"
              loading={loading}
            />
            <KPICard
              label="Avg Case Value"
              value={fmtK(metrics.avgCaseValue)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              iconBg="bg-purple-50 text-purple-700"
              loading={loading}
            />
            <KPICard
              label="Active Retainers"
              value={String(metrics.activeRetainers)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              iconBg="bg-amber-50 text-amber-700"
              loading={loading}
              onClick={() => onNavigate?.('retainer_subscriptions')}
            />
          </div>
        </div>

        {/* Stage Breakdown */}
        <div>
          <SectionHeader
            title="Pipeline Breakdown"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            }
          />
          <div className="bg-card border border-border rounded-2xl p-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted/40 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : stageBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No case data</p>
            ) : (
              <div className="space-y-2.5">
                {stageBreakdown.map((item) => {
                  const total = stageBreakdown.reduce((s, i) => s + i.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                          <span className="text-xs font-medium text-foreground">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{item.count}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts + Operations KPIs */}
      <div>
        <SectionHeader
          title="Alerts & Operations"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Overdue Invoices"
            value={String(metrics.overdueCount)}
            sub={metrics.overdueCount > 0 ? fmtK(metrics.overdueAmount) + ' owed' : undefined}
            subPositive={false}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            iconBg={metrics.overdueCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}
            loading={loading}
            alert={metrics.overdueCount > 0}
            onClick={() => onNavigate?.('invoices')}
          />
          <KPICard
            label="Unread Messages"
            value={String(metrics.unreadMessages)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            iconBg={metrics.unreadMessages > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}
            loading={loading}
            alert={metrics.unreadMessages > 5}
            onClick={() => onNavigate?.('messages')}
          />
          <KPICard
            label="Upcoming Deadlines"
            value={String(metrics.upcomingDeadlines)}
            sub="Next 7 days"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            iconBg="bg-amber-50 text-amber-700"
            loading={loading}
            onClick={() => onNavigate?.('tasks')}
          />
          <KPICard
            label="Overdue Tasks"
            value={String(metrics.overdueDeadlines)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            iconBg={metrics.overdueDeadlines > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}
            loading={loading}
            alert={metrics.overdueDeadlines > 0}
            onClick={() => onNavigate?.('tasks')}
          />
        </div>
      </div>

      {/* Leads KPIs */}
      <div>
        <SectionHeader
          title="Lead Pipeline"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="New Leads (Week)"
            value={String(metrics.newLeadsThisWeek)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
            iconBg="bg-blue-50 text-blue-700"
            loading={loading}
            onClick={() => onNavigate?.('inquiries')}
          />
          <KPICard
            label="New Leads (Month)"
            value={String(metrics.newLeadsThisMonth)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            iconBg="bg-violet-50 text-violet-700"
            loading={loading}
            onClick={() => onNavigate?.('inquiries')}
          />
          <KPICard
            label="Conversion Rate"
            value={fmtPct(metrics.conversionRate)}
            sub={metrics.conversionRate >= 20 ? 'Strong' : metrics.conversionRate >= 10 ? 'Average' : 'Low'}
            subPositive={metrics.conversionRate >= 20}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
            iconBg="bg-emerald-50 text-emerald-700"
            loading={loading}
          />
          <KPICard
            label="Closed This Month"
            value={String(metrics.closedThisMonth)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
            iconBg="bg-slate-100 text-slate-600"
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
