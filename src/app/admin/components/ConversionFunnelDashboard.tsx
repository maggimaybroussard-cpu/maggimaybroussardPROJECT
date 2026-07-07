'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStage {
  id: string;
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
  payments: number;
  convRate: number;
}

interface ServiceRow {
  service: string;
  inquiries: number;
  bookings: number;
  revenue: number;
  convRate: number;
}

interface DailyPoint {
  date: string;
  inquiries: number;
  bookings: number;
  payments: number;
}

interface AIInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  body: string;
}

interface KPIs {
  totalInquiries: number;
  totalBookings: number;
  totalPayments: number;
  totalRevenue: number;
  inquiryToBooking: number;
  bookingToPayment: number;
  overallConversion: number;
  avgRevenuePerClient: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = ['#355E3B', '#4a7c52', '#6b9e74', '#8fbf97', '#b3d9ba'];
const ACCENT = '#355E3B';

const DATE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

function getCutoff(range: DateRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
  return d.toISOString();
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function pct(n: number) { return `${n.toFixed(1)}%`; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-primary/20' : 'bg-card border-border'}`}
      style={accent ? { background: 'rgba(53,94,59,0.06)' } : {}}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversionFunnelDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [sourceData, setSourceData] = useState<SourceRow[]>([]);
  const [serviceData, setServiceData] = useState<ServiceRow[]>([]);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [ga4Data, setGa4Data] = useState<{ sessions: number; pageViews: number; bounceRate: number } | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = getCutoff(dateRange);

      // Parallel Supabase queries
      const [inquiriesRes, bookingsRes, paymentsRes] = await Promise.all([
        // All inquiries in range
        (() => {
          let q = supabase.from('contact_inquiries').select('id,service,status,booking_stage,created_at,lead_source');
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
        // Bookings (consultation_booked stage)
        (() => {
          let q = supabase.from('contact_inquiries').select('id,service,calendly_start_time,created_at,lead_source').not('calendly_start_time', 'is', null);
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
        // Payments
        (() => {
          let q = supabase.from('payments').select('id,amount,currency,payment_type,created_at').eq('payment_status', 'succeeded');
          if (cutoff) q = q.gte('created_at', cutoff);
          return q;
        })(),
      ]);

      const inquiries = inquiriesRes.data ?? [];
      const bookings = bookingsRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      const totalInquiries = inquiries.length;
      const totalBookings = bookings.length;
      const totalPayments = payments.length;
      const totalRevenue = payments.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);

      const inquiryToBooking = totalInquiries > 0 ? (totalBookings / totalInquiries) * 100 : 0;
      const bookingToPayment = totalBookings > 0 ? (totalPayments / totalBookings) * 100 : 0;
      const overallConversion = totalInquiries > 0 ? (totalPayments / totalInquiries) * 100 : 0;
      const avgRevenuePerClient = totalPayments > 0 ? totalRevenue / totalPayments : 0;

      setKpis({ totalInquiries, totalBookings, totalPayments, totalRevenue, inquiryToBooking, bookingToPayment, overallConversion, avgRevenuePerClient });

      // Build funnel stages
      const activeClients = inquiries.filter((i: { booking_stage: string }) => i.booking_stage === 'active_client').length;
      const stages: FunnelStage[] = [
        { id: 'inquiries', label: 'Inquiries Received', count: totalInquiries, pct: 100, dropOff: 0, color: PALETTE[0], icon: '📥' },
        { id: 'bookings', label: 'Consultations Booked', count: totalBookings, pct: totalInquiries > 0 ? (totalBookings / totalInquiries) * 100 : 0, dropOff: totalInquiries > 0 ? ((totalInquiries - totalBookings) / totalInquiries) * 100 : 0, color: PALETTE[1], icon: '📅' },
        { id: 'payments', label: 'Deposits / Payments', count: totalPayments, pct: totalInquiries > 0 ? (totalPayments / totalInquiries) * 100 : 0, dropOff: totalBookings > 0 ? ((totalBookings - totalPayments) / totalBookings) * 100 : 0, color: PALETTE[2], icon: '💳' },
        { id: 'active', label: 'Active Clients', count: activeClients, pct: totalInquiries > 0 ? (activeClients / totalInquiries) * 100 : 0, dropOff: totalPayments > 0 ? ((totalPayments - activeClients) / totalPayments) * 100 : 0, color: PALETTE[3], icon: '✅' },
      ];
      setFunnelStages(stages);

      // Source attribution
      const sourceMap: Record<string, { inquiries: number; bookings: number; payments: number }> = {};
      inquiries.forEach((i: { lead_source: string | null }) => {
        const src = i.lead_source ?? 'Direct';
        if (!sourceMap[src]) sourceMap[src] = { inquiries: 0, bookings: 0, payments: 0 };
        sourceMap[src].inquiries++;
      });
      bookings.forEach((b: { lead_source: string | null }) => {
        const src = b.lead_source ?? 'Direct';
        if (!sourceMap[src]) sourceMap[src] = { inquiries: 0, bookings: 0, payments: 0 };
        sourceMap[src].bookings++;
      });
      const srcRows: SourceRow[] = Object.entries(sourceMap)
        .map(([source, d]) => ({
          source,
          inquiries: d.inquiries,
          bookings: d.bookings,
          payments: d.payments,
          convRate: d.inquiries > 0 ? (d.bookings / d.inquiries) * 100 : 0,
        }))
        .sort((a, b) => b.inquiries - a.inquiries)
        .slice(0, 6);
      setSourceData(srcRows);

      // Service breakdown
      const svcMap: Record<string, { inquiries: number; bookings: number; revenue: number }> = {};
      inquiries.forEach((i: { service: string | null }) => {
        const svc = i.service ?? 'General';
        if (!svcMap[svc]) svcMap[svc] = { inquiries: 0, bookings: 0, revenue: 0 };
        svcMap[svc].inquiries++;
      });
      bookings.forEach((b: { service: string | null }) => {
        const svc = b.service ?? 'General';
        if (!svcMap[svc]) svcMap[svc] = { inquiries: 0, bookings: 0, revenue: 0 };
        svcMap[svc].bookings++;
      });
      const svcRows: ServiceRow[] = Object.entries(svcMap)
        .map(([service, d]) => ({
          service: service.length > 20 ? service.slice(0, 18) + '…' : service,
          inquiries: d.inquiries,
          bookings: d.bookings,
          revenue: d.revenue,
          convRate: d.inquiries > 0 ? (d.bookings / d.inquiries) * 100 : 0,
        }))
        .sort((a, b) => b.inquiries - a.inquiries)
        .slice(0, 6);
      setServiceData(svcRows);

      // Daily trend (last 14 days)
      const days = 14;
      const dailyPoints: DailyPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayInquiries = inquiries.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        const dayBookings = bookings.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        const dayPayments = payments.filter((x: { created_at: string }) => x.created_at?.slice(0, 10) === dateStr).length;
        dailyPoints.push({ date: dateStr.slice(5), inquiries: dayInquiries, bookings: dayBookings, payments: dayPayments });
      }
      setDailyData(dailyPoints);

      // Fetch GA4 data
      try {
        const ga4Res = await fetch('/api/admin/ga4');
        if (ga4Res.ok) {
          const ga4 = await ga4Res.json();
          setGa4Data({
            sessions: ga4?.summary?.sessions ?? 0,
            pageViews: ga4?.summary?.pageViews ?? 0,
            bounceRate: ga4?.summary?.bounceRate ?? 0,
          });
        }
      } catch {
        // GA4 optional
      }

      // Generate AI insights
      generateAIInsights({ totalInquiries, totalBookings, totalPayments, inquiryToBooking, bookingToPayment, overallConversion, srcRows, svcRows });

    } catch (err) {
      console.error('ConversionFunnelDashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  function generateAIInsights(data: {
    totalInquiries: number; totalBookings: number; totalPayments: number;
    inquiryToBooking: number; bookingToPayment: number; overallConversion: number;
    srcRows: SourceRow[]; svcRows: ServiceRow[];
  }) {
    const insights: AIInsight[] = [];

    if (data.inquiryToBooking < 30) {
      insights.push({
        type: 'warning',
        title: 'Low Inquiry → Booking Rate',
        body: `Only ${data.inquiryToBooking.toFixed(1)}% of inquiries convert to bookings. Consider adding a follow-up SMS sequence or reducing friction in the Calendly embed.`,
      });
    } else if (data.inquiryToBooking > 60) {
      insights.push({
        type: 'success',
        title: 'Strong Inquiry → Booking Rate',
        body: `${data.inquiryToBooking.toFixed(1)}% of inquiries convert to consultations — well above the 30% benchmark. Your intake flow is working.`,
      });
    }

    if (data.bookingToPayment < 40) {
      insights.push({
        type: 'warning',
        title: 'Booking → Payment Drop-Off',
        body: `${data.bookingToPayment.toFixed(1)}% of booked consultations result in payment. Sending a deposit reminder email 24 hours after booking may improve this.`,
      });
    }

    const topSrc = data.srcRows[0];
    if (topSrc) {
      insights.push({
        type: 'info',
        title: `Top Lead Source: ${topSrc.source}`,
        body: `${topSrc.source} drives ${topSrc.inquiries} inquiries with a ${topSrc.convRate.toFixed(1)}% booking rate. ${topSrc.convRate < 20 ? 'Consider nurturing these leads with a targeted email sequence.' : 'Keep investing in this channel.'}`,
      });
    }

    const topSvc = data.svcRows[0];
    if (topSvc) {
      insights.push({
        type: 'info',
        title: `Most Requested: ${topSvc.service}`,
        body: `${topSvc.service} accounts for ${topSvc.inquiries} inquiries. ${topSvc.convRate > 50 ? 'High conversion — consider upselling retainer packages to these clients.' : 'Moderate conversion — a service-specific landing page may help.'}`,
      });
    }

    if (data.overallConversion > 10) {
      insights.push({
        type: 'success',
        title: 'Overall Funnel Health: Good',
        body: `${data.overallConversion.toFixed(1)}% of all inquiries become paying clients. Industry average for legal services is 5–8%.`,
      });
    }

    setAiInsights(insights);
  }

  const generateAIReport = useCallback(async () => {
    if (!kpis) return;
    setAiLoading(true);
    try {
      const prompt = `You are a legal business analyst. Analyze this conversion funnel data for Broussard Legal Services (a contract paralegal firm):
- Total Inquiries: ${kpis.totalInquiries}
- Consultations Booked: ${kpis.totalBookings} (${kpis.inquiryToBooking.toFixed(1)}% conversion)
- Payments Received: ${kpis.totalPayments} (${kpis.bookingToPayment.toFixed(1)}% booking-to-payment)
- Total Revenue: ${fmt(kpis.totalRevenue)}
- Overall Conversion: ${kpis.overallConversion.toFixed(1)}%

Provide 3 specific, actionable recommendations to improve the conversion funnel. Be concise and practical.`;

      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? data?.content ?? '';
        if (content) {
          setAiInsights(prev => [{
            type: 'info',
            title: '🤖 AI Analysis',
            body: content,
          }, ...prev.slice(0, 3)]);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setAiLoading(false);
    }
  }, [kpis]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-sm text-muted-foreground">Loading funnel data…</p>
        </div>
      </div>
    );
  }

  const maxFunnelCount = funnelStages[0]?.count || 1;

  return (
    <div className="space-y-8">
      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Conversion Funnel</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Full visitor-to-client pipeline with AI-powered insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === opt.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={generateAIReport}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            {aiLoading ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            )}
            AI Analysis
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Inquiries" value={kpis.totalInquiries.toLocaleString()} sub={`Last ${dateRange === 'all' ? 'all time' : dateRange}`} />
          <KPICard label="Consultations Booked" value={kpis.totalBookings.toLocaleString()} sub={`${pct(kpis.inquiryToBooking)} of inquiries`} />
          <KPICard label="Payments Received" value={kpis.totalPayments.toLocaleString()} sub={`${pct(kpis.bookingToPayment)} of bookings`} />
          <KPICard label="Total Revenue" value={fmt(kpis.totalRevenue)} sub={`Avg ${fmt(kpis.avgRevenuePerClient)}/client`} accent />
        </div>
      )}

      {/* GA4 Row */}
      {ga4Data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Sessions</p>
            <p className="text-2xl font-semibold text-foreground">{ga4Data.sessions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">GA4 · 30 days</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Page Views</p>
            <p className="text-2xl font-semibold text-foreground">{ga4Data.pageViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">GA4 · 30 days</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Bounce Rate</p>
            <p className="text-2xl font-semibold text-foreground">{ga4Data.bounceRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">GA4 · 30 days</p>
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-serif text-lg text-foreground mb-1">Conversion Funnel</h3>
        <p className="text-xs text-muted-foreground mb-6">Inquiry → Booking → Payment → Active Client</p>
        <div className="flex flex-col gap-4">
          {funnelStages.map((stage, i) => {
            const barWidth = Math.round((stage.count / maxFunnelCount) * 100);
            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{stage.icon}</span>
                    <div>
                      <span className="text-sm font-medium text-foreground">{stage.label}</span>
                      {i > 0 && stage.dropOff > 0 && (
                        <span className="ml-2 text-xs text-red-500 font-medium">−{stage.dropOff.toFixed(0)}% drop-off</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{stage.count.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct(stage.pct)}</span>
                  </div>
                </div>
                <div className="h-10 bg-secondary/30 rounded-xl overflow-hidden">
                  <div
                    className="h-full rounded-xl flex items-center pl-4 transition-all duration-700"
                    style={{ width: `${Math.max(barWidth, 4)}%`, backgroundColor: stage.color }}
                  >
                    {barWidth > 15 && (
                      <span className="text-xs text-white font-semibold">{stage.count.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {kpis && (
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">End-to-end conversion rate</span>
            <span className="text-sm font-semibold text-foreground">{pct(kpis.overallConversion)}</span>
          </div>
        )}
      </div>

      {/* Daily Trend */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-serif text-lg text-foreground mb-1">Daily Pipeline Activity</h3>
        <p className="text-xs text-muted-foreground mb-5">Inquiries, bookings, and payments — last 14 days</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cfGrad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cfGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE[1]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PALETTE[1]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cfGrad3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE[2]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PALETTE[2]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
            <Area type="monotone" dataKey="inquiries" name="Inquiries" stroke={PALETTE[0]} fill="url(#cfGrad1)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="bookings" name="Bookings" stroke={PALETTE[1]} fill="url(#cfGrad2)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="payments" name="Payments" stroke={PALETTE[2]} fill="url(#cfGrad3)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Source + Service side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Attribution */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Lead Source Attribution</h3>
          <p className="text-xs text-muted-foreground mb-5">Inquiries and booking rate by source</p>
          {sourceData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No source data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sourceData.map((row, i) => (
                <div key={row.source} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-sm text-foreground truncate">{row.source}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <span className="text-muted-foreground">{row.inquiries} inq.</span>
                    <span className="text-muted-foreground">{row.bookings} booked</span>
                    <span className={`font-semibold ${row.convRate >= 30 ? 'text-emerald-600' : row.convRate >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{pct(row.convRate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Service Interest Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-5">Inquiries and booking rate by service type</p>
          {serviceData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No service data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={serviceData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="service" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="inquiries" name="Inquiries" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" name="Bookings" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <h3 className="font-serif text-lg text-foreground">AI Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiInsights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 border ${
                  insight.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
                  insight.type === 'warning'? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <p className={`text-xs font-semibold mb-1.5 ${
                  insight.type === 'success' ? 'text-emerald-700' :
                  insight.type === 'warning'? 'text-amber-700' : 'text-blue-700'
                }`}>{insight.title}</p>
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{insight.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
