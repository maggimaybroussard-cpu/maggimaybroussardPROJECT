'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIMetrics {
  revenueMTD: number;
  revenueLastMonth: number;
  revenueYTD: number;
  revenueGrowthPct: number;
  activeCases: number;
  newCasesThisMonth: number;
  closedThisMonth: number;
  avgCaseValue: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  pendingAmount: number;
  newLeadsThisWeek: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgDaysToConvert: number;
  unreadMessages: number;
  upcomingDeadlines: number;
  overdueDeadlines: number;
  activeRetainers: number;
  caseCompletionRate: number;
  quarterlyRevenue: number;
  quarterlyForecast: number;
  monthlyForecast: number;
  utilizationRate: number;
  totalBillableHours: number;
  avgCaseValueByService: ServiceValueItem[];
}

interface RevenuePoint {
  month: string;
  billed: number;
  collected: number;
  forecast?: number;
}

interface StageBreakdown {
  stage: string;
  label: string;
  count: number;
  color: string;
}

interface ServiceValueItem {
  service: string;
  avgValue: number;
  count: number;
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

const SERVICE_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#f59e0b', '#3b82f6', '#8b5cf6'];

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
            subPositive === false ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
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
    caseCompletionRate: 0, quarterlyRevenue: 0, quarterlyForecast: 0, monthlyForecast: 0,
    utilizationRate: 0, totalBillableHours: 0, avgCaseValueByService: [],
  });
  const [revenueChart, setRevenueChart] = useState<RevenuePoint[]>([]);
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'forecasts' | 'utilization'>('overview');

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
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();

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
        billableHoursRes,
        totalCasesRes,
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
        supabase.from('contact_inquiries').select('booking_stage, created_at, updated_at, status, service'),
        supabase.from('billable_time_logs').select('hours, created_at').gte('created_at', startOfMonth).limit(500),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }),
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

      // Quarterly revenue
      const quarterlyRevenue = paidInvoices
        .filter((i) => i.created_at >= quarterStart)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);

      // Monthly forecast: project current month based on days elapsed
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthlyForecast = dayOfMonth > 0 ? Math.round((revenueMTD / dayOfMonth) * daysInMonth) : 0;

      // Quarterly forecast: project based on months elapsed in quarter
      const monthsIntoQuarter = (now.getMonth() % 3) + (dayOfMonth / daysInMonth);
      const quarterlyForecast = monthsIntoQuarter > 0 ? Math.round((quarterlyRevenue / monthsIntoQuarter) * 3) : 0;

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

      // Case completion rate
      const totalCases = totalCasesRes.count ?? 1;
      const closedMTD = closedMTDRes.count ?? 0;
      const caseCompletionRate = totalCases > 0 ? (closedMTD / Math.max(totalCases, 1)) * 100 : 0;

      // Conversion rate
      const newLeadsMTD = newLeadsMTDRes.count ?? 0;
      const conversionRate = newLeadsMTD > 0 ? (closedMTD / newLeadsMTD) * 100 : 0;

      // Billable hours & utilization
      const billableHoursData = billableHoursRes.data || [];
      const totalBillableHours = billableHoursData.reduce((s: number, r: { hours: number }) => s + (r.hours || 0), 0);
      // Assume 160 available hours/month (standard full-time equivalent)
      const utilizationRate = Math.min(100, (totalBillableHours / 160) * 100);

      // Avg case value by service
      const allCases = allCasesRes.data || [];
      const serviceMap: Record<string, { total: number; count: number }> = {};
      allCases.forEach((c) => {
        const svc = c.service || 'General';
        if (!serviceMap[svc]) serviceMap[svc] = { total: 0, count: 0 };
        serviceMap[svc].count++;
      });
      // Distribute invoice amounts by service proportionally
      const totalCaseCount = allCases.length || 1;
      Object.keys(serviceMap).forEach((svc) => {
        const proportion = serviceMap[svc].count / totalCaseCount;
        serviceMap[svc].total = totalBilled * proportion;
      });
      const avgCaseValueByService: ServiceValueItem[] = Object.entries(serviceMap)
        .map(([service, data]) => ({
          service: service.length > 20 ? service.substring(0, 18) + '…' : service,
          avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
          count: data.count,
        }))
        .sort((a, b) => b.avgValue - a.avgValue)
        .slice(0, 7);

      // Revenue chart (last 6 months + 2 forecast months)
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
      // Add 2 forecast months
      for (let i = 1; i <= 2; i++) {
        const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const label = forecastMonth.toLocaleDateString('en-US', { month: 'short' }) + ' (F)';
        const avgMonthly = revenueYTD / Math.max(now.getMonth() + 1, 1);
        const growthFactor = 1 + (revenueGrowthPct / 100) * 0.5;
        chartData.push({ month: label, billed: 0, collected: 0, forecast: Math.round(avgMonthly * growthFactor) });
      }

      // Stage breakdown
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
        revenueMTD, revenueLastMonth, revenueYTD, revenueGrowthPct,
        activeCases: activeCaseCount,
        newCasesThisMonth: newCasesMTDRes.count ?? 0,
        closedThisMonth: closedMTD,
        avgCaseValue,
        overdueCount: overdueInvoices.length,
        overdueAmount, collectionRate, pendingAmount,
        newLeadsThisWeek: newLeadsWeekRes.count ?? 0,
        newLeadsThisMonth: newLeadsMTD,
        conversionRate, avgDaysToConvert: 0,
        unreadMessages: unreadMsgRes.count ?? 0,
        upcomingDeadlines: upcomingTasksRes.count ?? 0,
        overdueDeadlines: overdueTasksRes.count ?? 0,
        activeRetainers: activeRetainersRes.count ?? 0,
        caseCompletionRate, quarterlyRevenue, quarterlyForecast, monthlyForecast,
        utilizationRate, totalBillableHours, avgCaseValueByService,
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

  const sections = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'forecasts' as const, label: 'Revenue Forecasts' },
    { id: 'utilization' as const, label: 'Utilization & Rates' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Practice KPIs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Last refreshed {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Section Tabs */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
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
      </div>

      {/* ── OVERVIEW SECTION ── */}
      {activeSection === 'overview' && (
        <>
          {/* Revenue KPIs */}
          <div>
            <SectionHeader
              title="Revenue"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
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
              <h3 className="text-sm font-semibold text-foreground">Revenue Trend (6 months + 2-month forecast)</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Billed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Collected</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded border-dashed" /> Forecast</span>
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
                      <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                    <Tooltip
                      formatter={(value: number, name: string) => [fmtK(value), name === 'billed' ? 'Billed' : name === 'collected' ? 'Collected' : 'Forecast']}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="billed" stroke="#355E3B" strokeWidth={2} fill="url(#billedGrad)" />
                    <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#collectedGrad)" />
                    <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" fill="url(#forecastGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cases + Leads KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <SectionHeader
                title="Cases"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
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
                  label="Case Completion Rate"
                  value={fmtPct(metrics.caseCompletionRate)}
                  sub={metrics.caseCompletionRate >= 15 ? 'On track' : 'Below avg'}
                  subPositive={metrics.caseCompletionRate >= 15}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
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
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
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
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
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
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
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
        </>
      )}

      {/* ── FORECASTS SECTION ── */}
      {activeSection === 'forecasts' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Monthly Forecast</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.monthlyForecast)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Projected end-of-month revenue based on current pace</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Actual MTD</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.revenueMTD)}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Quarterly Forecast</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.quarterlyForecast)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Projected quarter-end revenue at current run rate</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Actual QTD</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.quarterlyRevenue)}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Annual Run Rate</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.revenueYTD / Math.max(new Date().getMonth() + 1, 1) * 12)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Annualized based on YTD average monthly revenue</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">YTD Actual</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.revenueYTD)}</span>
              </div>
            </div>
          </div>

          {/* Avg Case Value by Service */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Avg Case Value by Service Type</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue distributed across practice areas</p>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
              ) : metrics.avgCaseValueByService.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No service data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metrics.avgCaseValueByService} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="service" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                    <Tooltip
                      formatter={(value: number) => [fmtK(value), 'Avg Case Value']}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <Bar dataKey="avgValue" radius={[6, 6, 0, 0]}>
                      {metrics.avgCaseValueByService.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Case Completion Rate Detail */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Case Completion Rate</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Cases closed this month vs. total active</p>
              </div>
              {loading ? <div className="h-8 w-16 bg-muted/60 animate-pulse rounded-lg" /> : (
                <span className={`text-2xl font-bold ${metrics.caseCompletionRate >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {fmtPct(metrics.caseCompletionRate)}
                </span>
              )}
            </div>
            <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, metrics.caseCompletionRate * 3)}%`,
                  background: metrics.caseCompletionRate >= 15 ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Closed this month: <strong className="text-foreground">{metrics.closedThisMonth}</strong></span>
              <span>Active cases: <strong className="text-foreground">{metrics.activeCases}</strong></span>
            </div>
          </div>
        </>
      )}

      {/* ── UTILIZATION SECTION ── */}
      {activeSection === 'utilization' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Utilization Rate</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className={`text-3xl font-bold ${metrics.utilizationRate >= 70 ? 'text-emerald-600' : metrics.utilizationRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {fmtPct(metrics.utilizationRate)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Billable hours vs. 160hr capacity this month</p>
              <div className="mt-3 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${metrics.utilizationRate}%`,
                    background: metrics.utilizationRate >= 70 ? '#10b981' : metrics.utilizationRate >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Billable Hours MTD</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{metrics.totalBillableHours.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">hrs</span></p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Total logged billable hours this month</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Target capacity</span>
                <span className="font-semibold text-foreground">160 hrs</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Effective Hourly Rate</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">
                  {metrics.totalBillableHours > 0 ? fmtK(metrics.revenueMTD / metrics.totalBillableHours) : '$—'}
                  <span className="text-base font-normal text-muted-foreground ml-1">/hr</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Revenue MTD ÷ billable hours logged</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Standard rate</span>
                <span className="font-semibold text-foreground">$75/hr</span>
              </div>
            </div>
          </div>

          {/* Utilization Benchmark */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Attorney Utilization Benchmarks</h3>
            <div className="space-y-4">
              {[
                { label: 'Billable Hours Target', current: metrics.totalBillableHours, target: 160, unit: 'hrs', color: '#355E3B' },
                { label: 'Collection Rate Target', current: metrics.collectionRate, target: 90, unit: '%', color: '#3b82f6' },
                { label: 'Case Completion Target', current: metrics.caseCompletionRate, target: 20, unit: '%', color: '#8b5cf6' },
                { label: 'Conversion Rate Target', current: metrics.conversionRate, target: 25, unit: '%', color: '#f59e0b' },
              ].map((item) => {
                const pct = Math.min(100, (item.current / item.target) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {loading ? '—' : `${item.current.toFixed(item.unit === 'hrs' ? 1 : 0)}${item.unit} / ${item.target}${item.unit}`}
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      {loading ? (
                        <div className="h-full w-1/3 bg-muted/60 animate-pulse rounded-full" />
                      ) : (
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      )}
                    </div>
                    {!loading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {pct >= 100 ? '✓ Target met' : `${Math.round(100 - pct)}% below target`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retainer Efficiency */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Active Retainers"
              value={String(metrics.activeRetainers)}
              sub="Monthly recurring"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              iconBg="bg-emerald-50 text-emerald-700"
              loading={loading}
              onClick={() => onNavigate?.('retainer_subscriptions')}
            />
            <KPICard
              label="Retainer Revenue Est."
              value={fmtK(metrics.activeRetainers * 1500)}
              sub="At avg $1,500/mo"
              subPositive={true}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              iconBg="bg-blue-50 text-blue-700"
              loading={loading}
            />
            <KPICard
              label="Avg Case Value"
              value={fmtK(metrics.avgCaseValue)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
              iconBg="bg-purple-50 text-purple-700"
              loading={loading}
            />
            <KPICard
              label="New Cases MTD"
              value={String(metrics.newCasesThisMonth)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
              iconBg="bg-amber-50 text-amber-700"
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  );
}
