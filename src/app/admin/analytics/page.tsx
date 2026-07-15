'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import Link from 'next/link';
import ClientAcquisitionDashboard from '@/app/admin/components/ClientAcquisitionDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  booking_stage: string | null;
  lead_source: string | null;
  created_at: string;
}

interface CalendlyBooking {
  id: string;
  status: string;
  created_at: string;
}

interface ConsultationBooking {
  id: string;
  status: string;
  booking_date: string;
  created_at: string;
}

interface GA4Summary {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  pageViews: number;
}

interface GA4Data {
  demo: boolean;
  summary: GA4Summary;
  trafficSources: { source: string; sessions: number; percentage: number }[];
  conversionFunnel: { step: string; users: number; dropOff: number }[];
  topPages: { page: string; title: string; pageViews: number; avgTimeOnPage: number; bounceRate: number }[];
  dailyUsers: { date: string; users: number; sessions: number }[];
}

interface ConversionMetrics {
  totalInquiries: number;
  inquiriesToCases: number;
  inquiriesToAppointments: number;
  inquiriesToPayments: number;
  leadSources: { source: string; count: number; converted: number }[];
  pipelineStages: { stage: string; count: number; avgDaysInStage: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#355E3B';
const GOLD = '#8B6020';
const PALETTE = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#8B6020', '#C8965A', '#afd9ba'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 10) / 10;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color = 'default', trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: 'default' | 'green' | 'gold' | 'red';
  trend?: { value: number; label: string };
}) {
  const bg = color === 'green' ? 'bg-emerald-50 border-emerald-200' : color === 'gold' ? 'bg-amber-50 border-amber-200' : color === 'red' ? 'bg-red-50 border-red-200' : 'bg-card border-border';
  const iconBg = color === 'green' ? 'bg-emerald-100 text-emerald-700' : color === 'gold' ? 'bg-amber-100 text-amber-700' : color === 'red' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary';
  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-3 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-semibold text-foreground leading-none">{value}</p>
      <div className="flex items-center justify-between gap-2">
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${trend.value > 0 ? 'bg-emerald-100 text-emerald-700' : trend.value < 0 ? 'bg-red-100 text-red-600' : 'bg-secondary text-muted-foreground'}`}>
            {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const supabase = createClient();

  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [calendlyBookings, setCalendlyBookings] = useState<CalendlyBooking[]>([]);
  const [consultationBookings, setConsultationBookings] = useState<ConsultationBooking[]>([]);
  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [convMetrics, setConvMetrics] = useState<ConversionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'bookings' | 'ga4' | 'acquisition'>('overview');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - range);
      const sinceISO = since.toISOString();

      const [inqRes, calRes, conRes, ga4Res, convRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, booking_stage, lead_source, created_at')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false }),
        supabase
          .from('calendly_bookings')
          .select('id, status, created_at')
          .gte('created_at', sinceISO),
        supabase
          .from('consultation_bookings')
          .select('id, status, booking_date, created_at')
          .gte('created_at', sinceISO),
        fetch('/api/admin/ga4').then((r) => r.json()),
        fetch('/api/admin/ga4-conversion-metrics').then((r) => r.json()),
      ]);

      setInquiries((inqRes.data as ContactInquiry[]) ?? []);
      setCalendlyBookings((calRes.data as CalendlyBooking[]) ?? []);
      setConsultationBookings((conRes.data as ConsultationBooking[]) ?? []);
      setGa4Data(ga4Res);
      setConvMetrics(convRes);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived Metrics ──────────────────────────────────────────────────────────

  const totalSubmissions = inquiries.length;
  const newInquiries = inquiries.filter((i) => !i.booking_stage || i.booking_stage === 'inquiry').length;
  const convertedInquiries = inquiries.filter((i) => i.booking_stage && i.booking_stage !== 'inquiry').length;
  const submissionConversionRate = pct(convertedInquiries, totalSubmissions);

  const confirmedCalendly = calendlyBookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const confirmedConsultations = consultationBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length;
  const totalBookings = calendlyBookings.length + consultationBookings.length;
  const confirmedBookings = confirmedCalendly + confirmedConsultations;
  const bookingConversionRate = pct(confirmedBookings, totalBookings);

  // Daily submissions trend
  const dailySubmissions: { date: string; submissions: number; converted: number }[] = (() => {
    const map: Record<string, { submissions: number; converted: number }> = {};
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map[key] = { submissions: 0, converted: 0 };
    }
    inquiries.forEach((inq) => {
      const key = new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[key]) {
        map[key].submissions += 1;
        if (inq.booking_stage && inq.booking_stage !== 'inquiry') map[key].converted += 1;
      }
    });
    return Object.entries(map).map(([date, v]) => ({ date, ...v }));
  })();

  // Service breakdown
  const serviceMap: Record<string, number> = {};
  inquiries.forEach((inq) => {
    const svc = inq.service || 'General';
    serviceMap[svc] = (serviceMap[svc] ?? 0) + 1;
  });
  const serviceData = Object.entries(serviceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Stage funnel
  const stageFunnel = [
    { stage: 'Submitted', count: totalSubmissions },
    { stage: 'Consultation', count: inquiries.filter((i) => ['consultation', 'proposal', 'active', 'closed', 'pending_payment'].includes(i.booking_stage ?? '')).length },
    { stage: 'Proposal', count: inquiries.filter((i) => ['proposal', 'active', 'closed', 'pending_payment'].includes(i.booking_stage ?? '')).length },
    { stage: 'Active Client', count: inquiries.filter((i) => ['active', 'closed'].includes(i.booking_stage ?? '')).length },
  ];

  // Booking trend
  const bookingTrend: { date: string; calendly: number; consultation: number }[] = (() => {
    const map: Record<string, { calendly: number; consultation: number }> = {};
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map[key] = { calendly: 0, consultation: 0 };
    }
    calendlyBookings.forEach((b) => {
      const key = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[key]) map[key].calendly += 1;
    });
    consultationBookings.forEach((b) => {
      const key = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[key]) map[key].consultation += 1;
    });
    return Object.entries(map).map(([date, v]) => ({ date, ...v }));
  })();

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-32 h-6 bg-muted/40 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5">
                <div className="w-20 h-3 bg-muted/40 rounded animate-pulse mb-4" />
                <div className="w-16 h-8 bg-muted/60 rounded animate-pulse mb-2" />
                <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="w-full h-52 bg-muted/30 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8 flex items-center justify-center">
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm max-w-md text-center">
          <p className="font-semibold mb-1">Failed to load analytics</p>
          <p className="text-xs opacity-80">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'submissions' as const, label: 'Form Submissions' },
    { key: 'bookings' as const, label: 'Booking Conversion' },
    { key: 'acquisition' as const, label: 'Client Acquisition' },
    { key: 'ga4' as const, label: 'GA4 Performance' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Admin
            </Link>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
            {ga4Data?.demo && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Demo Data</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Live'}
            </div>
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${range === r ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
              >
                {r}d
              </button>
            ))}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Top KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Form Submissions"
            value={String(totalSubmissions)}
            sub={`${range}-day window`}
            color="default"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />
          <KpiCard
            label="Submission Conversion"
            value={`${submissionConversionRate}%`}
            sub={`${convertedInquiries} of ${totalSubmissions} progressed`}
            color={submissionConversionRate >= 30 ? 'green' : submissionConversionRate >= 15 ? 'gold' : 'red'}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
              </svg>
            }
          />
          <KpiCard
            label="Booking Conversion"
            value={`${bookingConversionRate}%`}
            sub={`${confirmedBookings} confirmed of ${totalBookings}`}
            color={bookingConversionRate >= 60 ? 'green' : bookingConversionRate >= 40 ? 'gold' : 'red'}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
          />
          <KpiCard
            label="GA4 Site Visitors"
            value={ga4Data ? fmtNum(ga4Data.summary.totalUsers) : '—'}
            sub={ga4Data ? `${fmtNum(ga4Data.summary.sessions)} sessions` : 'Loading…'}
            color="default"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            }
          />
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 bg-secondary/30 rounded-2xl p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Submission + Booking trend */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Form Submissions Over Time" subtitle={`Daily contact form submissions — last ${range} days`} />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailySubmissions} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(range / 7)} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="submissions" name="Submissions" stroke={BRAND} strokeWidth={2} fill="url(#subGrad)" dot={false} />
                  <Area type="monotone" dataKey="converted" name="Converted" stroke={GOLD} strokeWidth={2} fill="url(#convGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stage funnel + Service breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Lead Stage Funnel" subtitle="Contact form submissions through pipeline stages" />
                <div className="space-y-3">
                  {stageFunnel.map((item, i) => {
                    const widthPct = stageFunnel[0].count > 0 ? (item.count / stageFunnel[0].count) * 100 : 0;
                    return (
                      <div key={item.stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{item.stage}</span>
                        <div className="flex-1 bg-secondary/40 rounded-full h-5 relative overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${widthPct}%`, background: PALETTE[i] }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-foreground">
                            {item.count}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground w-10 text-right flex-shrink-0">
                          {widthPct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Submissions by Service" subtitle="Which services are generating the most inquiries" />
                {serviceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {serviceData.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No submissions in range</div>
                )}
              </div>
            </div>

            {/* GA4 quick stats */}
            {ga4Data && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="GA4 Performance Snapshot" subtitle={ga4Data.demo ? 'Demo data — connect GA4 for live metrics' : 'Live Google Analytics data'} />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total Users', value: fmtNum(ga4Data.summary.totalUsers) },
                    { label: 'New Users', value: fmtNum(ga4Data.summary.newUsers) },
                    { label: 'Sessions', value: fmtNum(ga4Data.summary.sessions) },
                    { label: 'Page Views', value: fmtNum(ga4Data.summary.pageViews) },
                    { label: 'Avg Duration', value: fmtDuration(ga4Data.summary.avgSessionDuration) },
                    { label: 'Bounce Rate', value: `${(ga4Data.summary.bounceRate * 100).toFixed(1)}%` },
                  ].map((m) => (
                    <div key={m.label} className="bg-secondary/30 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                      <p className="text-lg font-bold text-foreground">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Submissions Tab ── */}
        {activeTab === 'submissions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Submissions" value={String(totalSubmissions)} sub={`Last ${range} days`} color="default"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
              />
              <KpiCard label="New (Unprocessed)" value={String(newInquiries)} sub="Still at inquiry stage" color="gold"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
              />
              <KpiCard label="Converted" value={String(convertedInquiries)} sub="Progressed past inquiry" color="green"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              />
              <KpiCard label="Conversion Rate" value={`${submissionConversionRate}%`} sub="Submissions → active" color={submissionConversionRate >= 30 ? 'green' : 'gold'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
              />
            </div>

            {/* Trend chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Daily Submission Trend" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailySubmissions} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(range / 7)} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="submissions" name="Submissions" fill={BRAND} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pipeline stages from API */}
            {convMetrics && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Pipeline Stage Breakdown" subtitle="All-time contact inquiry pipeline from Supabase" />
                <div className="space-y-3">
                  {convMetrics.pipelineStages.map((stage, i) => {
                    const maxCount = Math.max(...convMetrics.pipelineStages.map((s) => s.count), 1);
                    return (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 flex-shrink-0 capitalize">{stage.stage.replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-secondary/40 rounded-full h-5 relative overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(stage.count / maxCount) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-foreground">{stage.count}</span>
                        </div>
                        <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">avg {stage.avgDaysInStage}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent submissions table */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Recent Submissions" subtitle="Latest contact form entries" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Name</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Service</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Stage</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.slice(0, 15).map((inq) => (
                      <tr key={inq.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="py-2 pr-4 font-medium text-foreground">{inq.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{inq.service || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inq.booking_stage === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            inq.booking_stage === 'inquiry' || !inq.booking_stage ? 'bg-secondary text-muted-foreground' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inq.booking_stage?.replace(/_/g, ' ') || 'inquiry'}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      </tr>
                    ))}
                    {inquiries.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No submissions in this period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Bookings Tab ── */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Bookings" value={String(totalBookings)} sub={`Last ${range} days`} color="default"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              />
              <KpiCard label="Confirmed" value={String(confirmedBookings)} sub="Active + confirmed" color="green"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              />
              <KpiCard label="Booking Conv. Rate" value={`${bookingConversionRate}%`} sub="Confirmed / total" color={bookingConversionRate >= 60 ? 'green' : bookingConversionRate >= 40 ? 'gold' : 'red'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
              />
              <KpiCard label="Calendly Bookings" value={String(calendlyBookings.length)} sub={`${confirmedCalendly} confirmed`} color="default"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
              />
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Booking Volume Over Time" subtitle="Calendly vs. portal consultation bookings" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bookingTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(range / 7)} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="calendly" name="Calendly" fill={BRAND} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="consultation" name="Portal Consultation" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion funnel from GA4 */}
            {ga4Data && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Website Booking Funnel" subtitle="GA4 user journey from site visit to booking confirmation" />
                <div className="space-y-3">
                  {ga4Data.conversionFunnel.map((step, i) => {
                    const widthPct = ga4Data.conversionFunnel[0].users > 0 ? (step.users / ga4Data.conversionFunnel[0].users) * 100 : 0;
                    return (
                      <div key={step.step} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{step.step}</span>
                        <div className="flex-1 bg-secondary/40 rounded-full h-6 relative overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${widthPct}%`, background: PALETTE[Math.min(i, PALETTE.length - 1)] }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-foreground">{fmtNum(step.users)} users</span>
                        </div>
                        {i > 0 && (
                          <span className="text-xs font-semibold w-14 text-right flex-shrink-0" style={{ color: step.dropOff > 50 ? '#dc2626' : step.dropOff > 35 ? '#d97706' : BRAND }}>
                            -{step.dropOff}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GA4 Tab ── */}
        {activeTab === 'ga4' && ga4Data && (
          <div className="space-y-6">
            {ga4Data.demo && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Demo Data Active</p>
                  <p className="text-xs text-amber-700 mt-0.5">Add <code className="bg-amber-100 px-1 rounded">GA4_PROPERTY_ID</code> and <code className="bg-amber-100 px-1 rounded">GA4_SERVICE_ACCOUNT_KEY</code> to your environment to connect live GA4 data.</p>
                </div>
              </div>
            )}

            {/* Summary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Users', value: fmtNum(ga4Data.summary.totalUsers) },
                { label: 'New Users', value: fmtNum(ga4Data.summary.newUsers) },
                { label: 'Sessions', value: fmtNum(ga4Data.summary.sessions) },
                { label: 'Page Views', value: fmtNum(ga4Data.summary.pageViews) },
                { label: 'Avg Duration', value: fmtDuration(ga4Data.summary.avgSessionDuration) },
                { label: 'Bounce Rate', value: `${(ga4Data.summary.bounceRate * 100).toFixed(1)}%` },
              ].map((m) => (
                <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="text-xl font-bold text-foreground">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Daily users chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Daily Users & Sessions" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={ga4Data.dailyUsers} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="users" name="Users" stroke={BRAND} strokeWidth={2} fill="url(#usersGrad)" dot={false} />
                  <Area type="monotone" dataKey="sessions" name="Sessions" stroke={GOLD} strokeWidth={2} fill="url(#sessGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Traffic sources + Top pages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Traffic Sources" />
                <div className="space-y-2">
                  {ga4Data.trafficSources.map((src, i) => (
                    <div key={src.source} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{src.source}</span>
                      <div className="flex-1 bg-secondary/40 rounded-full h-4 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${src.percentage}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right flex-shrink-0">{src.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <SectionTitle title="Top Pages" />
                <div className="space-y-2">
                  {ga4Data.topPages.slice(0, 6).map((page) => (
                    <div key={page.page} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{page.title}</p>
                        <p className="text-[10px] text-muted-foreground">{page.page}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                        <span>{fmtNum(page.pageViews)} views</span>
                        <span>{fmtDuration(page.avgTimeOnPage)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Client Acquisition Tab ── */}
        {activeTab === 'acquisition' && (
          <ClientAcquisitionDashboard />
        )}

      </div>
    </div>
  );
}
