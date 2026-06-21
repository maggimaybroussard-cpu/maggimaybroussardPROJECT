'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactInquiry {
  id: string;
  source: string;
  service: string;
  booking_stage: string;
  status: string;
  created_at: string;
}

interface IntakeSubmission {
  id: string;
  case_type: string;
  submitted_at: string | null;
  created_at: string;
  inquiry_id: string | null;
}

interface TrendPoint {
  month: string;
  website_form: number;
  typeform: number;
  referral: number;
  other: number;
}

interface ConversionRow {
  service: string;
  total: number;
  active: number;
  conversionRate: number;
}

interface StageRow {
  stage: string;
  count: number;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9'];
const ACCENT = '#355E3B';

const SOURCE_COLORS: Record<string, string> = {
  website_form: '#355E3B',
  contact_form: '#355E3B',
  typeform_intake: '#C8965A',
  typeform: '#C8965A',
  referral: '#6b9e7a',
  other: '#afd9ba',
};

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Website Form',
  contact_form: 'Website Form',
  typeform_intake: 'Typeform',
  typeform: 'Typeform',
  referral: 'Referral',
  other: 'Other',
};

const STAGE_COLORS: Record<string, string> = {
  inquiry: '#3b82f6',
  consultation_booked: '#8b5cf6',
  proposal_sent: '#f59e0b',
  active_client: '#355E3B',
  completed: '#10b981',
  closed: '#6b7280',
};

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Consultation Booked',
  proposal_sent: 'Proposal Sent',
  active_client: 'Active Client',
  completed: 'Completed',
  closed: 'Closed',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSource(raw: string): 'website_form' | 'typeform' | 'referral' | 'other' {
  const s = (raw || '').toLowerCase();
  if (s === 'typeform_intake' || s === 'typeform') return 'typeform';
  if (s === 'referral') return 'referral';
  if (s === 'website_form' || s === 'contact_form') return 'website_form';
  return 'other';
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getLast6Months(): string[] {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
  }
  return months;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntakeAnalyticsDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'3m' | '6m' | '12m'>('6m');

  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);

  // Derived
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [conversionData, setConversionData] = useState<ConversionRow[]>([]);
  const [stageData, setStageData] = useState<StageRow[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const monthsBack = range === '3m' ? 3 : range === '12m' ? 12 : 6;
      const since = new Date();
      since.setMonth(since.getMonth() - monthsBack);
      const sinceStr = since.toISOString();

      const [inquiriesRes, submissionsRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id,source,service,booking_stage,status,created_at')
          .gte('created_at', sinceStr)
          .order('created_at', { ascending: true }),
        supabase
          .from('intake_submissions')
          .select('id,case_type,submitted_at,created_at,inquiry_id')
          .gte('created_at', sinceStr)
          .order('created_at', { ascending: true }),
      ]);

      if (inquiriesRes.error) throw inquiriesRes.error;
      if (submissionsRes.error) throw submissionsRes.error;

      setInquiries(inquiriesRes.data || []);
      setSubmissions(submissionsRes.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derive charts from raw data
  useEffect(() => {
    if (!inquiries.length && !submissions.length) {
      setTrendData([]);
      setConversionData([]);
      setStageData([]);
      setSourceBreakdown([]);
      return;
    }

    // ── Trend by source (monthly) ──────────────────────────────────────────
    const monthsBack = range === '3m' ? 3 : range === '12m' ? 12 : 6;
    const allMonths: string[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      allMonths.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }

    const trendMap: Record<string, TrendPoint> = {};
    allMonths.forEach((m) => {
      trendMap[m] = { month: m, website_form: 0, typeform: 0, referral: 0, other: 0 };
    });

    // Count inquiries by source per month
    inquiries.forEach((inq) => {
      const m = getMonthKey(inq.created_at);
      if (!trendMap[m]) return;
      const src = normalizeSource(inq.source);
      trendMap[m][src] = (trendMap[m][src] || 0) + 1;
    });

    // Also count typeform submissions (may not have inquiry yet)
    submissions.forEach((sub) => {
      const m = getMonthKey(sub.created_at);
      if (!trendMap[m]) return;
      // Only count if no linked inquiry (avoid double-count)
      if (!sub.inquiry_id) {
        trendMap[m].typeform = (trendMap[m].typeform || 0) + 1;
      }
    });

    setTrendData(Object.values(trendMap));

    // ── Source breakdown (pie) ─────────────────────────────────────────────
    const srcCount: Record<string, number> = { website_form: 0, typeform: 0, referral: 0, other: 0 };
    inquiries.forEach((inq) => {
      const src = normalizeSource(inq.source);
      srcCount[src] = (srcCount[src] || 0) + 1;
    });
    submissions.forEach((sub) => {
      if (!sub.inquiry_id) srcCount.typeform = (srcCount.typeform || 0) + 1;
    });

    const srcBreakdown = [
      { name: 'Website Form', value: srcCount.website_form, color: SOURCE_COLORS.website_form },
      { name: 'Typeform', value: srcCount.typeform, color: SOURCE_COLORS.typeform },
      { name: 'Referral', value: srcCount.referral, color: SOURCE_COLORS.referral },
      { name: 'Other', value: srcCount.other, color: SOURCE_COLORS.other },
    ].filter((d) => d.value > 0);
    setSourceBreakdown(srcBreakdown);

    // ── Conversion rates by service type ──────────────────────────────────
    const serviceMap: Record<string, { total: number; active: number }> = {};
    inquiries.forEach((inq) => {
      const svc = inq.service || 'Unknown';
      if (!serviceMap[svc]) serviceMap[svc] = { total: 0, active: 0 };
      serviceMap[svc].total += 1;
      if (['active_client', 'completed'].includes(inq.booking_stage)) {
        serviceMap[svc].active += 1;
      }
    });

    const convRows: ConversionRow[] = Object.entries(serviceMap)
      .map(([service, data]) => ({
        service: service.length > 28 ? service.slice(0, 26) + '…' : service,
        total: data.total,
        active: data.active,
        conversionRate: data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    setConversionData(convRows);

    // ── Lead stage distribution ────────────────────────────────────────────
    const stageCount: Record<string, number> = {};
    inquiries.forEach((inq) => {
      const stage = inq.booking_stage || 'inquiry';
      stageCount[stage] = (stageCount[stage] || 0) + 1;
    });

    const stageOrder = ['inquiry', 'consultation_booked', 'proposal_sent', 'active_client', 'completed', 'closed'];
    const stageRows: StageRow[] = stageOrder
      .filter((s) => stageCount[s] > 0)
      .map((s) => ({
        stage: STAGE_LABELS[s] || s,
        count: stageCount[s],
        color: STAGE_COLORS[s] || '#afd9ba',
      }));
    setStageData(stageRows);
  }, [inquiries, submissions, range]);

  // ── KPI summary ───────────────────────────────────────────────────────────
  const totalLeads = inquiries.length + submissions.filter((s) => !s.inquiry_id).length;
  const activeClients = inquiries.filter((i) => ['active_client', 'completed'].includes(i.booking_stage)).length;
  const overallConversion = totalLeads > 0 ? ((activeClients / totalLeads) * 100).toFixed(1) : '0';
  const typeformCount = inquiries.filter((i) => normalizeSource(i.source) === 'typeform').length
    + submissions.filter((s) => !s.inquiry_id).length;
  const websiteCount = inquiries.filter((i) => normalizeSource(i.source) === 'website_form').length;
  const referralCount = inquiries.filter((i) => normalizeSource(i.source) === 'referral').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        <p className="font-semibold mb-1">Failed to load intake analytics</p>
        <p className="text-red-500">{error}</p>
        <button onClick={fetchAll} className="mt-3 text-xs underline hover:no-underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Range Selector ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-foreground mb-0.5">Intake Analytics</h2>
          <p className="text-sm text-muted-foreground font-light">Submission trends, conversion rates, and lead stage distribution</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
          {(['3m', '6m', '12m'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                range === r
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === '3m' ? '3 Months' : r === '6m' ? '6 Months' : '12 Months'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Leads" value={totalLeads.toString()} sub={`Last ${range === '3m' ? '3' : range === '6m' ? '6' : '12'} months`} accent />
        <KPICard label="Converted" value={activeClients.toString()} sub={`${overallConversion}% conversion rate`} />
        <KPICard label="Via Typeform" value={typeformCount.toString()} sub={`${totalLeads > 0 ? Math.round((typeformCount / totalLeads) * 100) : 0}% of total`} />
        <KPICard label="Via Website" value={websiteCount.toString()} sub={`${referralCount} referral leads`} />
      </div>

      {/* ── Trend Chart + Source Pie ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Trend by source */}
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Submission Trends by Source</h3>
          <p className="text-xs text-muted-foreground mb-5">Monthly intake volume — Website Form, Typeform & Referral</p>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No submissions in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Line type="monotone" dataKey="website_form" name="Website Form" stroke={SOURCE_COLORS.website_form} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="typeform" name="Typeform" stroke={SOURCE_COLORS.typeform} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="referral" name="Referral" stroke={SOURCE_COLORS.referral} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="other" name="Other" stroke={SOURCE_COLORS.other} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source breakdown pie */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Source Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-5">Share of total leads by channel</p>
          {sourceBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={sourceBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={38}
                    paddingAngle={2}
                  >
                    {sourceBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, 'Leads']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-3">
                {sourceBreakdown.map((item) => {
                  const pct = totalLeads > 0 ? Math.round((item.value / totalLeads) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-foreground truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-foreground">{item.value}</span>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Conversion Rates + Stage Distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Conversion by service */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Conversion Rate by Service</h3>
          <p className="text-xs text-muted-foreground mb-5">Leads that reached Active Client or Completed stage</p>
          {conversionData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No service data</div>
          ) : (
            <div className="space-y-3">
              {conversionData.map((row) => (
                <div key={row.service}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground font-medium truncate max-w-[55%]">{row.service}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{row.active}/{row.total}</span>
                      <span className={`text-sm font-semibold ${row.conversionRate >= 50 ? 'text-primary' : row.conversionRate >= 25 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {row.conversionRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${row.conversionRate}%`,
                        background: row.conversionRate >= 50 ? ACCENT : row.conversionRate >= 25 ? '#C8965A' : '#afd9ba',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead stage distribution */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Lead Stage Distribution</h3>
          <p className="text-xs text-muted-foreground mb-5">Current pipeline snapshot — all leads in period</p>
          {stageData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No stage data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: number) => [v, 'Leads']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
                    {stageData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Stage legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-border">
                {stageData.map((s) => (
                  <div key={s.stage} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-muted-foreground truncate">{s.stage}</span>
                    <span className="text-xs font-semibold text-foreground ml-auto">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {totalLeads === 0 && (
        <div className="bg-secondary/20 border border-border rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No intake data yet</p>
          <p className="text-xs text-muted-foreground">Leads from your website form, Typeform, and referrals will appear here once submissions come in.</p>
        </div>
      )}
    </div>
  );
}
