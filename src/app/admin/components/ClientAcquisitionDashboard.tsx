'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStage {
  label: string;
  count: number;
  pct: number;
  dropOff: number;
  color: string;
  icon: string;
}

interface SourceRow {
  source: string;
  inquiries: number;
  bookings: number;
  clients: number;
  convRate: number;
  color: string;
}

interface DailyPoint {
  date: string;
  inquiries: number;
  bookings: number;
  clients: number;
}

interface ServiceRow {
  service: string;
  inquiries: number;
  bookings: number;
  convRate: number;
}

interface KPIs {
  totalInquiries: number;
  totalBookings: number;
  totalClients: number;
  inquiryToBooking: number;
  bookingToClient: number;
  overallConversion: number;
  avgTimeToConvert: number;
  topSource: string;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#355E3B';
const PALETTE = ['#355E3B', '#4a7c52', '#6b9e74', '#8fbf97', '#b3d9ba', '#8B6020', '#C8965A'];
const RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

const SOURCE_COLORS: Record<string, string> = {
  organic: '#355E3B',
  google: '#4a7c52',
  referral: '#6b9e74',
  direct: '#8B6020',
  social: '#C8965A',
  email: '#8fbf97',
  calendly: '#b3d9ba',
};

function getCutoff(range: DateRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
  return d.toISOString();
}

function pctStr(n: number) {
  return `${n.toFixed(1)}%`;
}

function getSourceColor(source: string, idx: number): string {
  const key = source.toLowerCase();
  for (const k of Object.keys(SOURCE_COLORS)) {
    if (key.includes(k)) return SOURCE_COLORS[k];
  }
  return PALETTE[idx % PALETTE.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = 'default', badge,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'default' | 'green' | 'gold' | 'red';
  badge?: string;
}) {
  const bg =
    color === 'green' ? 'bg-emerald-50 border-emerald-200' :
    color === 'gold' ? 'bg-amber-50 border-amber-200' :
    color === 'red'? 'bg-red-50 border-red-200' : 'bg-card border-border';
  const valColor =
    color === 'green' ? 'text-emerald-700' :
    color === 'gold' ? 'text-amber-700' :
    color === 'red'? 'text-red-600' : 'text-foreground';
  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-2 ${bg}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold leading-tight">{label}</p>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className={`text-3xl font-semibold leading-none ${valColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
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

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientAcquisitionDashboard() {
  const supabase = createClient();
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<'funnel' | 'sources' | 'trend' | 'services'>('funnel');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const cutoff = getCutoff(range);

      const [inqRes, bookRes, clientRes, calRes] = await Promise.all([
        (() => {
          let q = supabase
            .from('contact_inquiries')
            .select('id, service, booking_stage, lead_source, created_at');
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
        (() => {
          let q = supabase
            .from('consultation_bookings')
            .select('id, status, source, created_at, booking_date');
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
        (() => {
          let q = supabase
            .from('contact_inquiries')
            .select('id, lead_source, created_at')
            .in('booking_stage', ['active', 'closed', 'active_client']);
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
        (() => {
          let q = supabase
            .from('calendly_bookings')
            .select('id, status, created_at');
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
      ]);

      const inquiries = inqRes.data ?? [];
      const bookings = bookRes.data ?? [];
      const clients = clientRes.data ?? [];
      const calendlyBookings = calRes.data ?? [];

      const totalInquiries = inquiries.length;
      const totalBookings = bookings.length + calendlyBookings.length;
      const totalClients = clients.length;

      const inquiryToBooking = totalInquiries > 0 ? (totalBookings / totalInquiries) * 100 : 0;
      const bookingToClient = totalBookings > 0 ? (totalClients / totalBookings) * 100 : 0;
      const overallConversion = totalInquiries > 0 ? (totalClients / totalInquiries) * 100 : 0;

      // Avg time to convert (days from inquiry to active)
      let avgTimeToConvert = 0;
      if (clients.length > 0) {
        const times = clients
          .map((c: { created_at: string }) => {
            const inq = inquiries.find((i: { id: string }) => i.id === c.id);
            if (!inq) return null;
            return (new Date(c.created_at).getTime() - new Date(inq.created_at).getTime()) / (1000 * 60 * 60 * 24);
          })
          .filter((t): t is number => t !== null && t >= 0);
        avgTimeToConvert = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      }

      // Top source
      const srcCount: Record<string, number> = {};
      inquiries.forEach((i: { lead_source: string | null }) => {
        const s = i.lead_source ?? 'Direct';
        srcCount[s] = (srcCount[s] ?? 0) + 1;
      });
      const topSource = Object.entries(srcCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

      setKpis({ totalInquiries, totalBookings, totalClients, inquiryToBooking, bookingToClient, overallConversion, avgTimeToConvert, topSource });

      // ── Funnel stages ──────────────────────────────────────────────────────
      const consultationStage = inquiries.filter((i: { booking_stage: string | null }) =>
        ['consultation', 'proposal', 'active', 'closed', 'pending_payment', 'active_client'].includes(i.booking_stage ?? '')
      ).length;
      const proposalStage = inquiries.filter((i: { booking_stage: string | null }) =>
        ['proposal', 'active', 'closed', 'pending_payment'].includes(i.booking_stage ?? '')
      ).length;

      const stages: FunnelStage[] = [
        {
          label: 'Form Submissions',
          count: totalInquiries,
          pct: 100,
          dropOff: 0,
          color: PALETTE[0],
          icon: '📥',
        },
        {
          label: 'Consultations Booked',
          count: totalBookings,
          pct: totalInquiries > 0 ? (totalBookings / totalInquiries) * 100 : 0,
          dropOff: totalInquiries > 0 ? ((totalInquiries - totalBookings) / totalInquiries) * 100 : 0,
          color: PALETTE[1],
          icon: '📅',
        },
        {
          label: 'Consultation Held',
          count: consultationStage,
          pct: totalInquiries > 0 ? (consultationStage / totalInquiries) * 100 : 0,
          dropOff: totalBookings > 0 ? ((totalBookings - consultationStage) / totalBookings) * 100 : 0,
          color: PALETTE[2],
          icon: '🤝',
        },
        {
          label: 'Proposal / Retainer',
          count: proposalStage,
          pct: totalInquiries > 0 ? (proposalStage / totalInquiries) * 100 : 0,
          dropOff: consultationStage > 0 ? ((consultationStage - proposalStage) / consultationStage) * 100 : 0,
          color: PALETTE[3],
          icon: '📋',
        },
        {
          label: 'Active Clients',
          count: totalClients,
          pct: totalInquiries > 0 ? (totalClients / totalInquiries) * 100 : 0,
          dropOff: proposalStage > 0 ? ((proposalStage - totalClients) / proposalStage) * 100 : 0,
          color: PALETTE[4],
          icon: '✅',
        },
      ];
      setFunnelStages(stages);

      // ── Source attribution ─────────────────────────────────────────────────
      const srcMap: Record<string, { inquiries: number; bookings: number; clients: number }> = {};

      inquiries.forEach((i: { lead_source: string | null }) => {
        const src = i.lead_source ?? 'Direct';
        if (!srcMap[src]) srcMap[src] = { inquiries: 0, bookings: 0, clients: 0 };
        srcMap[src].inquiries++;
      });

      bookings.forEach((b: { source: string | null }) => {
        const src = b.source ?? 'Direct';
        if (!srcMap[src]) srcMap[src] = { inquiries: 0, bookings: 0, clients: 0 };
        srcMap[src].bookings++;
      });

      clients.forEach((c: { lead_source: string | null }) => {
        const src = c.lead_source ?? 'Direct';
        if (!srcMap[src]) srcMap[src] = { inquiries: 0, bookings: 0, clients: 0 };
        srcMap[src].clients++;
      });

      const rows: SourceRow[] = Object.entries(srcMap)
        .map(([source, d], idx) => ({
          source,
          inquiries: d.inquiries,
          bookings: d.bookings,
          clients: d.clients,
          convRate: d.inquiries > 0 ? (d.clients / d.inquiries) * 100 : 0,
          color: getSourceColor(source, idx),
        }))
        .sort((a, b) => b.inquiries - a.inquiries)
        .slice(0, 8);
      setSourceRows(rows);

      // ── Daily trend (last 14 days) ─────────────────────────────────────────
      const days = range === '7d' ? 7 : 14;
      const dailyPoints: DailyPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dayInq = inquiries.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        const dayBook = bookings.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length +
          calendlyBookings.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        const dayClients = clients.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        dailyPoints.push({ date: label, inquiries: dayInq, bookings: dayBook, clients: dayClients });
      }
      setDailyData(dailyPoints);

      // ── Service breakdown ──────────────────────────────────────────────────
      const svcMap: Record<string, { inquiries: number; bookings: number }> = {};
      inquiries.forEach((i: { service: string | null; booking_stage: string | null }) => {
        const svc = i.service ?? 'General';
        if (!svcMap[svc]) svcMap[svc] = { inquiries: 0, bookings: 0 };
        svcMap[svc].inquiries++;
        if (['consultation', 'proposal', 'active', 'closed', 'active_client'].includes(i.booking_stage ?? '')) {
          svcMap[svc].bookings++;
        }
      });
      const svcRows: ServiceRow[] = Object.entries(svcMap)
        .map(([service, d]) => ({
          service: service.length > 22 ? service.slice(0, 20) + '…' : service,
          inquiries: d.inquiries,
          bookings: d.bookings,
          convRate: d.inquiries > 0 ? (d.bookings / d.inquiries) * 100 : 0,
        }))
        .sort((a, b) => b.inquiries - a.inquiries)
        .slice(0, 7);
      setServiceRows(svcRows);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('ClientAcquisitionDashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Real-time polling every 60s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { fetchData(); }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-28" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 h-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6 h-56" />
          <div className="bg-card border border-border rounded-2xl p-6 h-56" />
        </div>
      </div>
    );
  }

  const convColor = (v: number, good: number, warn: number) =>
    v >= good ? 'green' : v >= warn ? 'gold' : 'red';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">Client Acquisition Funnel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time booking funnels, form submissions, and source attribution
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveDot />
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  range === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Form Submissions"
            value={String(kpis.totalInquiries)}
            sub={`Last ${range === 'all' ? 'all time' : range}`}
            badge="Inquiries"
          />
          <KpiCard
            label="Consultations Booked"
            value={String(kpis.totalBookings)}
            sub={`${pctStr(kpis.inquiryToBooking)} of inquiries`}
            color={convColor(kpis.inquiryToBooking, 40, 20)}
          />
          <KpiCard
            label="Active Clients"
            value={String(kpis.totalClients)}
            sub={`${pctStr(kpis.overallConversion)} overall conversion`}
            color={convColor(kpis.overallConversion, 20, 10)}
          />
          <KpiCard
            label="Booking → Client Rate"
            value={pctStr(kpis.bookingToClient)}
            sub={`Top source: ${kpis.topSource}`}
            color={convColor(kpis.bookingToClient, 50, 25)}
          />
        </div>
      )}

      {/* ── Conversion Rate Summary Bar ── */}
      {kpis && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle title="Conversion Rate Summary" subtitle="End-to-end acquisition pipeline rates" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Inquiry → Booking',
                value: kpis.inquiryToBooking,
                good: 40, warn: 20,
                desc: `${kpis.totalBookings} bookings from ${kpis.totalInquiries} inquiries`,
              },
              {
                label: 'Booking → Client',
                value: kpis.bookingToClient,
                good: 50, warn: 25,
                desc: `${kpis.totalClients} clients from ${kpis.totalBookings} bookings`,
              },
              {
                label: 'Overall Conversion',
                value: kpis.overallConversion,
                good: 20, warn: 10,
                desc: `${kpis.totalClients} clients from ${kpis.totalInquiries} inquiries`,
              },
            ].map((m) => {
              const color = m.value >= m.good ? '#355E3B' : m.value >= m.warn ? '#d97706' : '#dc2626';
              const bgColor = m.value >= m.good ? '#f0fdf4' : m.value >= m.warn ? '#fffbeb' : '#fef2f2';
              const borderColor = m.value >= m.good ? '#bbf7d0' : m.value >= m.warn ? '#fde68a' : '#fecaca';
              return (
                <div
                  key={m.label}
                  className="rounded-xl p-4 border"
                  style={{ background: bgColor, borderColor }}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{m.label}</p>
                  <p className="text-3xl font-bold mb-1" style={{ color }}>{pctStr(m.value)}</p>
                  <div className="w-full bg-white/60 rounded-full h-1.5 mb-2">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(m.value, 100)}%`, background: color }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── View Tabs ── */}
      <div className="flex items-center gap-1 bg-secondary/30 rounded-2xl p-1 overflow-x-auto">
        {([
          { key: 'funnel', label: 'Booking Funnel' },
          { key: 'sources', label: 'Source Attribution' },
          { key: 'trend', label: 'Acquisition Trend' },
          { key: 'services', label: 'By Service' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeView === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Booking Funnel View ── */}
      {activeView === 'funnel' && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <SectionTitle title="Booking Funnel Stages" subtitle="Step-by-step drop-off from inquiry to active client" />
          <div className="space-y-4">
            {funnelStages.map((stage, i) => {
              const barWidth = stage.pct;
              const dropOffColor = stage.dropOff > 60 ? '#dc2626' : stage.dropOff > 35 ? '#d97706' : '#355E3B';
              return (
                <div key={stage.label} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-44 flex-shrink-0">
                    <span className="text-base">{stage.icon}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{stage.label}</span>
                  </div>
                  <div className="flex-1 bg-secondary/40 rounded-full h-7 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barWidth}%`, background: stage.color }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-foreground">
                      {stage.count.toLocaleString()} &nbsp;
                      <span className="text-muted-foreground font-normal">({pctStr(stage.pct)})</span>
                    </span>
                  </div>
                  {i > 0 && stage.dropOff > 0 ? (
                    <div className="w-20 text-right flex-shrink-0">
                      <span className="text-xs font-semibold" style={{ color: dropOffColor }}>
                        ↓ {pctStr(stage.dropOff)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">drop-off</p>
                    </div>
                  ) : (
                    <div className="w-20" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Funnel summary */}
          {kpis && (
            <div className="mt-6 pt-5 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Inquiry → Booking', value: pctStr(kpis.inquiryToBooking) },
                { label: 'Booking → Client', value: pctStr(kpis.bookingToClient) },
                { label: 'Overall Rate', value: pctStr(kpis.overallConversion) },
                { label: 'Avg Days to Convert', value: kpis.avgTimeToConvert > 0 ? `${kpis.avgTimeToConvert.toFixed(1)}d` : '—' },
              ].map((m) => (
                <div key={m.label} className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="text-xl font-bold text-foreground">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Source Attribution View ── */}
      {activeView === 'sources' && (
        <div className="space-y-6">
          {/* Source bar chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle title="Inquiries by Source" subtitle="Where your leads are coming from" />
            {sourceRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="source" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inquiries" name="Inquiries" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bookings" name="Bookings" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clients" name="Clients" fill={PALETTE[5]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No source data available</div>
            )}
          </div>

          {/* Source attribution table */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle title="Source Conversion Rates" subtitle="Conversion performance by acquisition channel" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Source</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Inquiries</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Bookings</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Clients</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((row) => {
                    const rateColor = row.convRate >= 20 ? '#355E3B' : row.convRate >= 10 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={row.source} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
                            <span className="font-medium text-foreground">{row.source}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.inquiries}</td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.bookings}</td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.clients}</td>
                        <td className="py-2.5 text-right">
                          <span className="font-semibold" style={{ color: rateColor }}>{pctStr(row.convRate)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {sourceRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No source data in this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Source pie */}
          {sourceRows.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <SectionTitle title="Source Distribution" subtitle="Share of total inquiries by channel" />
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sourceRows}
                      dataKey="inquiries"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ source, percent }) =>
                        `${String(source).slice(0, 10)} ${(Number(percent) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                      fontSize={10}
                    >
                      {sourceRows.map((row, i) => (
                        <Cell key={i} fill={row.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {sourceRows.map((row) => (
                    <div key={row.source} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span className="text-xs text-muted-foreground">{row.source}</span>
                      <span className="text-xs font-semibold text-foreground ml-auto">{row.inquiries}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Acquisition Trend View ── */}
      {activeView === 'trend' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle
              title="Daily Acquisition Trend"
              subtitle="Inquiries, bookings, and new clients over time"
            />
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bookGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE[2]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={PALETTE[2]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cliGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE[5]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={PALETTE[5]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="inquiries" name="Inquiries" stroke={PALETTE[0]} strokeWidth={2} fill="url(#inqGrad)" dot={false} />
                <Area type="monotone" dataKey="bookings" name="Bookings" stroke={PALETTE[2]} strokeWidth={2} fill="url(#bookGrad)" dot={false} />
                <Area type="monotone" dataKey="clients" name="New Clients" stroke={PALETTE[5]} strokeWidth={2} fill="url(#cliGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily conversion rate chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle title="Daily Booking Volume" subtitle="Inquiries vs. bookings per day" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inquiries" name="Inquiries" fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="bookings" name="Bookings" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── By Service View ── */}
      {activeView === 'services' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle title="Inquiries by Practice Area" subtitle="Which services drive the most inquiries and bookings" />
            {serviceRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceRows} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inquiries" name="Inquiries" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="bookings" name="Booked" fill={PALETTE[2]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No service data available</div>
            )}
          </div>

          {/* Service conversion table */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <SectionTitle title="Service Conversion Rates" subtitle="Booking rate per practice area" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Practice Area</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Inquiries</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">Booked</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((row, i) => {
                    const rateColor = row.convRate >= 30 ? '#355E3B' : row.convRate >= 15 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={row.service} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="font-medium text-foreground">{row.service}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.inquiries}</td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.bookings}</td>
                        <td className="py-2.5 text-right">
                          <span className="font-semibold" style={{ color: rateColor }}>{pctStr(row.convRate)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {serviceRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">No service data in this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
