'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Funnel, Cell, PieChart, Pie, AreaChart, Area,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStep {
  step: string;
  users: number;
  dropOff: number;
}

interface TrafficSource {
  source: string;
  sessions: number;
  percentage: number;
}

interface ServiceInterest {
  service: string;
  views: number;
  inquiries: number;
  conversionRate: number;
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
  serviceInterest: ServiceInterest[];
  topPages: { page: string; title: string; pageViews: number; avgTimeOnPage: number; bounceRate: number }[];
  dailyUsers: { date: string; users: number; sessions: number }[];
}

interface SupabaseMetrics {
  totalInquiries: number;
  inquiriesToCases: number;
  inquiriesToAppointments: number;
  inquiriesToPayments: number;
  revenueByService: { service: string; revenue: number; count: number }[];
  leadSources: { source: string; count: number; converted: number }[];
  pipelineStages: { stage: string; count: number; avgDaysInStage: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND_GREEN = '#355E3B';
const PALETTE = ['#355E3B', '#4a7c52', '#6b9e74', '#8fbf97', '#b3d9ba', '#d6edd9'];
const ALERT_RED = '#dc2626';
const ALERT_AMBER = '#d97706';

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-foreground" style={accent ? { color: accent } : {}}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Bottleneck Alert ─────────────────────────────────────────────────────────

function BottleneckAlerts({ funnel, pipeline }: { funnel: FunnelStep[]; pipeline: SupabaseMetrics['pipelineStages'] }) {
  const alerts: { level: 'critical' | 'warning'; message: string; detail: string }[] = [];

  // Funnel drop-off alerts
  funnel.forEach((step, i) => {
    if (i === 0) return;
    if (step.dropOff > 60) {
      alerts.push({
        level: 'critical',
        message: `High drop-off at "${step.step}"`,
        detail: `${step.dropOff}% of users leave at this stage — investigate UX or messaging`,
      });
    } else if (step.dropOff > 45) {
      alerts.push({
        level: 'warning',
        message: `Elevated drop-off at "${step.step}"`,
        detail: `${step.dropOff}% drop-off — consider A/B testing this step`,
      });
    }
  });

  // Pipeline stage stagnation
  pipeline.forEach((stage) => {
    if (stage.avgDaysInStage > 14) {
      alerts.push({
        level: 'critical',
        message: `Cases stalled in "${stage.stage}"`,
        detail: `Average ${stage.avgDaysInStage} days in this stage (${stage.count} cases) — follow-up needed`,
      });
    } else if (stage.avgDaysInStage > 7) {
      alerts.push({
        level: 'warning',
        message: `Slow movement in "${stage.stage}"`,
        detail: `Average ${stage.avgDaysInStage} days (${stage.count} cases) — review workflow`,
      });
    }
  });

  if (alerts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#dcfce7' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">No bottlenecks detected</p>
          <p className="text-xs text-muted-foreground">Pipeline is flowing smoothly across all stages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="bg-card border rounded-xl p-4 flex items-start gap-3"
          style={{ borderColor: alert.level === 'critical' ? '#fca5a5' : '#fcd34d' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: alert.level === 'critical' ? '#fee2e2' : '#fef3c7' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={alert.level === 'critical' ? ALERT_RED : ALERT_AMBER} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{alert.message}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
          </div>
          <span
            className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: alert.level === 'critical' ? '#fee2e2' : '#fef3c7',
              color: alert.level === 'critical' ? ALERT_RED : ALERT_AMBER,
            }}
          >
            {alert.level}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Conversion Funnel ────────────────────────────────────────────────────────

function ConversionFunnelSection({ funnel, supabase }: { funnel: FunnelStep[]; supabase: SupabaseMetrics }) {
  const inquiryToCaseRate = pct(supabase.inquiriesToCases, supabase.totalInquiries);
  const inquiryToApptRate = pct(supabase.inquiriesToAppointments, supabase.totalInquiries);
  const inquiryToPayRate = pct(supabase.inquiriesToPayments, supabase.totalInquiries);

  return (
    <div className="space-y-6">
      {/* Lexi conversion KPIs */}
      <div>
        <SectionHeader title="Inquiry Conversion Rates" subtitle="From website contact form to downstream actions in Lexi" />
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Inquiries → Cases"
            value={`${inquiryToCaseRate}%`}
            sub={`${supabase.inquiriesToCases} of ${supabase.totalInquiries} inquiries`}
            accent={inquiryToCaseRate < 20 ? ALERT_AMBER : BRAND_GREEN}
          />
          <MetricCard
            label="Inquiries → Appointments"
            value={`${inquiryToApptRate}%`}
            sub={`${supabase.inquiriesToAppointments} of ${supabase.totalInquiries} inquiries`}
            accent={inquiryToApptRate < 15 ? ALERT_AMBER : BRAND_GREEN}
          />
          <MetricCard
            label="Inquiries → Payments"
            value={`${inquiryToPayRate}%`}
            sub={`${supabase.inquiriesToPayments} of ${supabase.totalInquiries} inquiries`}
            accent={inquiryToPayRate < 10 ? ALERT_AMBER : BRAND_GREEN}
          />
        </div>
      </div>

      {/* GA4 website funnel */}
      <div>
        <SectionHeader title="Website Conversion Funnel" subtitle="GA4 user journey from site visit to booking confirmation" />
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="space-y-2">
            {funnel.map((step, i) => {
              const widthPct = funnel[0].users > 0 ? (step.users / funnel[0].users) * 100 : 0;
              return (
                <div key={step.step} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{step.step}</span>
                  <div className="flex-1 bg-secondary/40 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${widthPct}%`, background: PALETTE[Math.min(i, PALETTE.length - 1)] }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-foreground">
                      {fmt(step.users)} users
                    </span>
                  </div>
                  {i > 0 && (
                    <span
                      className="text-xs font-semibold w-16 text-right shrink-0"
                      style={{ color: step.dropOff > 50 ? ALERT_RED : step.dropOff > 35 ? ALERT_AMBER : BRAND_GREEN }}
                    >
                      -{step.dropOff}%
                    </span>
                  )}
                  {i === 0 && <span className="w-16 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue by Service ───────────────────────────────────────────────────────

function RevenueByServiceSection({ data }: { data: SupabaseMetrics['revenueByService'] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const chartData = data.map((d) => ({ ...d, revenueK: +(d.revenue / 1000).toFixed(1) }));

  return (
    <div>
      <SectionHeader title="Revenue by Service Type" subtitle="Collected payments broken down by service category" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="service" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}k`} />
              <Tooltip
                formatter={(v: number) => [`$${(v * 1000).toLocaleString()}`, 'Revenue']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="revenueK" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          {data.map((d, i) => (
            <div key={d.service} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="text-xs text-foreground flex-1 truncate">{d.service}</span>
              <span className="text-xs font-semibold text-foreground">${d.revenue.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground w-10 text-right">{pct(d.revenue, total)}%</span>
            </div>
          ))}
          <div className="pt-2 border-t border-border flex justify-between">
            <span className="text-xs font-semibold text-foreground">Total</span>
            <span className="text-xs font-bold text-foreground">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Source Performance ──────────────────────────────────────────────────

function LeadSourceSection({ sources, ga4Sources }: { sources: SupabaseMetrics['leadSources']; ga4Sources: TrafficSource[] }) {
  return (
    <div>
      <SectionHeader title="Lead Source Performance" subtitle="Traffic channels and their inquiry conversion rates" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GA4 traffic sources */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GA4 Traffic Sources</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={ga4Sources} dataKey="sessions" nameKey="source" cx="50%" cy="50%" outerRadius={75} label={({ source, percentage }) => `${source} ${percentage}%`} labelLine={false}>
                {ga4Sources.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [v, 'Sessions']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lexi lead source conversion */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Inquiry Conversion by Source</p>
          <div className="space-y-3">
            {sources.map((s) => {
              const rate = pct(s.converted, s.count);
              return (
                <div key={s.source} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium capitalize">{s.source || 'Direct'}</span>
                    <span className="text-muted-foreground">{s.converted}/{s.count} converted ({rate}%)</span>
                  </div>
                  <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${rate}%`, background: rate > 30 ? BRAND_GREEN : rate > 15 ? ALERT_AMBER : ALERT_RED }}
                    />
                  </div>
                </div>
              );
            })}
            {sources.length === 0 && (
              <p className="text-xs text-muted-foreground">No lead source data available yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function GA4ConversionDashboard() {
  const [ga4, setGa4] = useState<GA4Data | null>(null);
  const [supabase, setSupabase] = useState<SupabaseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'funnel' | 'revenue' | 'sources' | 'bottlenecks'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch GA4 data
      const ga4Res = await fetch('/api/admin/ga4');
      const ga4Data: GA4Data = await ga4Res.json();
      setGa4(ga4Data);

      // Fetch Supabase metrics
      const sbRes = await fetch('/api/admin/ga4-conversion-metrics');
      if (sbRes.ok) {
        const sbData: SupabaseMetrics = await sbRes.json();
        setSupabase(sbData);
      } else {
        // Use demo Supabase metrics
        setSupabase(getDemoSupabaseMetrics());
      }
    } catch {
      setError('Failed to load analytics data');
      setGa4(null);
      setSupabase(getDemoSupabaseMetrics());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const ga4Data = ga4!;
  const sbData = supabase!;

  const overallConversionRate = pct(
    ga4Data.conversionFunnel[ga4Data.conversionFunnel.length - 1]?.users ?? 0,
    ga4Data.conversionFunnel[0]?.users ?? 1
  );

  const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'funnel', label: 'Conversion Funnel' },
    { id: 'revenue', label: 'Revenue by Service' },
    { id: 'sources', label: 'Lead Sources' },
    { id: 'bottlenecks', label: 'Bottleneck Alerts' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {ga4Data.demo && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span><strong>Demo mode</strong> — Configure <code>GA4_PROPERTY_ID</code> and <code>GA4_SERVICE_ACCOUNT_KEY</code> in your environment to see live data.</span>
        </div>
      )}

      {/* Top KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Users (30d)" value={fmt(ga4Data.summary.totalUsers)} sub={`${fmt(ga4Data.summary.newUsers)} new`} />
        <MetricCard label="Overall Conversion" value={`${overallConversionRate}%`} sub="Visit → Booking" accent={overallConversionRate < 5 ? ALERT_AMBER : BRAND_GREEN} />
        <MetricCard label="Avg Session" value={fmtDuration(ga4Data.summary.avgSessionDuration)} sub={`${Math.round(ga4Data.summary.bounceRate * 100)}% bounce rate`} />
        <MetricCard label="Total Inquiries" value={String(sbData.totalInquiries)} sub={`${sbData.inquiriesToCases} became cases`} />
      </div>

      {/* Section nav */}
      <div className="flex gap-1 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === s.id
                ? 'text-white' :'bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
            style={activeSection === s.id ? { background: BRAND_GREEN } : {}}
          >
            {s.label}
            {s.id === 'bottlenecks' && (() => {
              const alertCount = [
                ...ga4Data.conversionFunnel.filter((s, i) => i > 0 && s.dropOff > 45),
                ...sbData.pipelineStages.filter((s) => s.avgDaysInStage > 7),
              ].length;
              return alertCount > 0 ? (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {alertCount}
                </span>
              ) : null;
            })()}
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Section content */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Quick conversion summary */}
          <div>
            <SectionHeader title="Conversion Summary" subtitle="End-to-end pipeline from website visit to payment" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Inquiries → Cases" value={`${pct(sbData.inquiriesToCases, sbData.totalInquiries)}%`} sub={`${sbData.inquiriesToCases}/${sbData.totalInquiries}`} accent={BRAND_GREEN} />
              <MetricCard label="Inquiries → Appts" value={`${pct(sbData.inquiriesToAppointments, sbData.totalInquiries)}%`} sub={`${sbData.inquiriesToAppointments}/${sbData.totalInquiries}`} accent={BRAND_GREEN} />
              <MetricCard label="Inquiries → Paid" value={`${pct(sbData.inquiriesToPayments, sbData.totalInquiries)}%`} sub={`${sbData.inquiriesToPayments}/${sbData.totalInquiries}`} accent={BRAND_GREEN} />
              <MetricCard label="Top Revenue Source" value={sbData.revenueByService[0]?.service ?? '—'} sub={`$${(sbData.revenueByService[0]?.revenue ?? 0).toLocaleString()}`} />
            </div>
          </div>

          {/* Daily trend */}
          <div>
            <SectionHeader title="30-Day Traffic Trend" subtitle="Daily users and sessions from GA4" />
            <div className="bg-card border border-border rounded-xl p-4">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={ga4Data.dailyUsers} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND_GREEN} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="users" stroke={BRAND_GREEN} strokeWidth={2} fill="url(#usersGrad)" name="Users" />
                  <Area type="monotone" dataKey="sessions" stroke={PALETTE[2]} strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Sessions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottleneck preview */}
          <div>
            <SectionHeader title="Pipeline Alerts" subtitle="Active bottlenecks requiring attention" />
            <BottleneckAlerts funnel={ga4Data.conversionFunnel} pipeline={sbData.pipelineStages} />
          </div>
        </div>
      )}

      {activeSection === 'funnel' && (
        <ConversionFunnelSection funnel={ga4Data.conversionFunnel} supabase={sbData} />
      )}

      {activeSection === 'revenue' && (
        <RevenueByServiceSection data={sbData.revenueByService} />
      )}

      {activeSection === 'sources' && (
        <LeadSourceSection sources={sbData.leadSources} ga4Sources={ga4Data.trafficSources} />
      )}

      {activeSection === 'bottlenecks' && (
        <div>
          <SectionHeader title="Pipeline Bottleneck Alerts" subtitle="Automated detection of conversion drop-offs and stalled cases" />
          <BottleneckAlerts funnel={ga4Data.conversionFunnel} pipeline={sbData.pipelineStages} />

          {/* Stage breakdown table */}
          <div className="mt-6">
            <SectionHeader title="Pipeline Stage Breakdown" />
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Cases</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Avg Days</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sbData.pipelineStages.map((stage, i) => (
                    <tr key={stage.stage} className={i % 2 === 0 ? 'bg-card' : 'bg-secondary/10'}>
                      <td className="px-4 py-2.5 font-medium text-foreground capitalize">{stage.stage.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5 text-right text-foreground">{stage.count}</td>
                      <td className="px-4 py-2.5 text-right text-foreground">{stage.avgDaysInStage}d</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            background: stage.avgDaysInStage > 14 ? '#fee2e2' : stage.avgDaysInStage > 7 ? '#fef3c7' : '#dcfce7',
                            color: stage.avgDaysInStage > 14 ? ALERT_RED : stage.avgDaysInStage > 7 ? ALERT_AMBER : BRAND_GREEN,
                          }}
                        >
                          {stage.avgDaysInStage > 14 ? 'Critical' : stage.avgDaysInStage > 7 ? 'Slow' : 'Healthy'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Demo Supabase Metrics ────────────────────────────────────────────────────

function getDemoSupabaseMetrics(): SupabaseMetrics {
  return {
    totalInquiries: 148,
    inquiriesToCases: 62,
    inquiriesToAppointments: 41,
    inquiriesToPayments: 29,
    revenueByService: [
      { service: 'Litigation Support', revenue: 28400, count: 14 },
      { service: 'Contract Review', revenue: 19200, count: 22 },
      { service: 'Legal Research', revenue: 12600, count: 18 },
      { service: 'Document Drafting', revenue: 9800, count: 16 },
      { service: 'Case Management', revenue: 7400, count: 9 },
      { service: 'Deposition Prep', revenue: 4200, count: 6 },
    ],
    leadSources: [
      { source: 'organic', count: 54, converted: 22 },
      { source: 'referral', count: 38, converted: 18 },
      { source: 'direct', count: 31, converted: 14 },
      { source: 'social', count: 16, converted: 5 },
      { source: 'email', count: 9, converted: 3 },
    ],
    pipelineStages: [
      { stage: 'inquiry', count: 24, avgDaysInStage: 2 },
      { stage: 'consultation', count: 18, avgDaysInStage: 5 },
      { stage: 'proposal', count: 12, avgDaysInStage: 9 },
      { stage: 'active', count: 31, avgDaysInStage: 3 },
      { stage: 'pending_payment', count: 8, avgDaysInStage: 16 },
      { stage: 'closed', count: 55, avgDaysInStage: 1 },
    ],
  };
}
