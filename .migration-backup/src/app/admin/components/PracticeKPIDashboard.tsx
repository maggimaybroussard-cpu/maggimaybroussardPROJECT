'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenuePoint {
  month: string;
  billed: number;
  collected: number;
  outstanding: number;
}

interface AcquisitionSource {
  source: string;
  count: number;
  revenue: number;
  pct: number;
}

interface ConversionStage {
  stage: string;
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface BillingEfficiency {
  service: string;
  billed: number;
  collected: number;
  collectionRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
}

interface KPISummary {
  totalRevenueMTD: number;
  totalRevenueYTD: number;
  revenueGrowthPct: number;
  activeMatters: number;
  newClientsThisMonth: number;
  avgMatterValue: number;
  overallCollectionRate: number;
  overdueInvoicesCount: number;
  overdueAmount: number;
  conversionRate: number;
  avgDaysToConvert: number;
  billingEfficiencyScore: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#c8e6d0', '#e8f5ec'];
const ACCENT = '#355E3B';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? '').replace(/"/g, '""');
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(
  summary: KPISummary,
  revenue: RevenuePoint[],
  acquisition: AcquisitionSource[],
  billing: BillingEfficiency[]
) {
  const revenueRows = revenue.map(r => `<tr><td>${r.month}</td><td>${fmt(r.billed)}</td><td>${fmt(r.collected)}</td><td>${fmt(r.outstanding)}</td></tr>`).join('');
  const acqRows = acquisition.map(a => `<tr><td>${a.source}</td><td>${a.count}</td><td>${fmt(a.revenue)}</td><td>${fmtPct(a.pct)}</td></tr>`).join('');
  const billRows = billing.map(b => `<tr><td>${b.service}</td><td>${fmt(b.billed)}</td><td>${fmt(b.collected)}</td><td>${fmtPct(b.collectionRate)}</td><td>${b.overdueCount}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Practice KPI Report</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .kpi-value { font-size: 18px; font-weight: 600; margin-top: 4px; }
    .kpi-sub { font-size: 11px; color: #888; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
    th { background: #f5f5f5; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
  </style></head><body>
  <h1>Practice KPI Dashboard Report</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Broussard Legal Services</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Revenue MTD</div><div class="kpi-value">${fmtK(summary.totalRevenueMTD)}</div></div>
    <div class="kpi"><div class="kpi-label">Revenue YTD</div><div class="kpi-value">${fmtK(summary.totalRevenueYTD)}</div></div>
    <div class="kpi"><div class="kpi-label">Active Matters</div><div class="kpi-value">${summary.activeMatters}</div></div>
    <div class="kpi"><div class="kpi-label">Collection Rate</div><div class="kpi-value">${fmtPct(summary.overallCollectionRate)}</div></div>
    <div class="kpi"><div class="kpi-label">New Clients MTD</div><div class="kpi-value">${summary.newClientsThisMonth}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Matter Value</div><div class="kpi-value">${fmtK(summary.avgMatterValue)}</div></div>
    <div class="kpi"><div class="kpi-label">Conversion Rate</div><div class="kpi-value">${fmtPct(summary.conversionRate)}</div></div>
    <div class="kpi"><div class="kpi-label">Overdue Invoices</div><div class="kpi-value">${summary.overdueInvoicesCount}</div></div>
  </div>
  <h2>Revenue Trends (Last 6 Months)</h2>
  <table><thead><tr><th>Month</th><th>Billed</th><th>Collected</th><th>Outstanding</th></tr></thead><tbody>${revenueRows}</tbody></table>
  <h2>Client Acquisition Sources</h2>
  <table><thead><tr><th>Source</th><th>Clients</th><th>Revenue</th><th>Share</th></tr></thead><tbody>${acqRows}</tbody></table>
  <h2>Billing Efficiency by Practice Area</h2>
  <table><thead><tr><th>Service</th><th>Billed</th><th>Collected</th><th>Collection %</th><th>Overdue</th></tr></thead><tbody>${billRows}</tbody></table>
  <div class="footer">Broussard Legal Services · Practice KPI Dashboard</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, trend, trendUp, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${accent ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
      <p className={`text-[10px] uppercase tracking-widest font-semibold ${accent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`text-2xl font-semibold leading-tight ${accent ? 'text-primary-foreground' : 'text-foreground'}`}>{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-red-500'} ${accent ? 'text-primary-foreground/80' : ''}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
        {sub && <span className={`text-xs ${accent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{currency ? fmt(p.value) : p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PracticeKPIDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'revenue' | 'acquisition' | 'conversion' | 'billing'>('overview');
  const [dateRange, setDateRange] = useState<'3m' | '6m' | '12m'>('6m');

  const [summary, setSummary] = useState<KPISummary>({
    totalRevenueMTD: 0, totalRevenueYTD: 0, revenueGrowthPct: 0,
    activeMatters: 0, newClientsThisMonth: 0, avgMatterValue: 0,
    overallCollectionRate: 0, overdueInvoicesCount: 0, overdueAmount: 0,
    conversionRate: 0, avgDaysToConvert: 0, billingEfficiencyScore: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [acquisitionData, setAcquisitionData] = useState<AcquisitionSource[]>([]);
  const [conversionData, setConversionData] = useState<ConversionStage[]>([]);
  const [billingData, setBillingData] = useState<BillingEfficiency[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const months = dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const [invoicesRes, inquiriesRes, paymentsRes] = await Promise.all([
        supabase
          .from('client_invoices').select('id, amount, amount_paid, status, created_at, inquiry_id, contact_inquiries(service, status, booking_stage, created_at)').gte('created_at', since.toISOString()),supabase.from('contact_inquiries').select('id, service, status, booking_stage, created_at, updated_at').gte('created_at', since.toISOString()),supabase.from('payments').select('id, amount, payment_status, created_at').gte('created_at', since.toISOString()),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (inquiriesRes.error) throw inquiriesRes.error;

      const invoices = invoicesRes.data || [];
      const inquiries = inquiriesRes.data || [];
      const payments = paymentsRes.data || [];

      // ── Revenue Trends ────────────────────────────────────────────────────
      const monthMap = new Map<string, { billed: number; collected: number }>();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthMap.set(key, { billed: 0, collected: 0 });
      }
      for (const inv of invoices) {
        const d = new Date(inv.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthMap.has(key)) {
          const cur = monthMap.get(key)!;
          cur.billed += inv.amount || 0;
          cur.collected += inv.amount_paid || 0;
        }
      }
      const revPoints: RevenuePoint[] = Array.from(monthMap.entries()).map(([month, v]) => ({
        month,
        billed: v.billed,
        collected: v.collected,
        outstanding: Math.max(0, v.billed - v.collected),
      }));
      setRevenueData(revPoints);

      // ── Summary KPIs ──────────────────────────────────────────────────────
      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const ytdStart = new Date(now.getFullYear(), 0, 1);

      const mtdInvoices = invoices.filter(i => new Date(i.created_at) >= mtdStart);
      const ytdInvoices = invoices.filter(i => new Date(i.created_at) >= ytdStart);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevInvoices = invoices.filter(i => {
        const d = new Date(i.created_at);
        return d >= prevMonthStart && d <= prevMonthEnd;
      });

      const totalRevMTD = mtdInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const totalRevYTD = ytdInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const prevRevMTD = prevInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const growthPct = prevRevMTD > 0 ? ((totalRevMTD - prevRevMTD) / prevRevMTD) * 100 : 0;

      const totalBilled = invoices.reduce((s, i) => s + (i.amount || 0), 0);
      const totalCollected = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

      const overdueInvs = invoices.filter(i => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.created_at) < new Date(Date.now() - 30 * 86400000)));
      const overdueAmt = overdueInvs.reduce((s, i) => s + Math.max(0, (i.amount || 0) - (i.amount_paid || 0)), 0);

      const activeMatters = inquiries.filter(i => i.booking_stage === 'active_client').length;
      const newClients = inquiries.filter(i => new Date(i.created_at) >= mtdStart && i.booking_stage === 'active_client').length;
      const avgMatterVal = activeMatters > 0 ? totalCollected / activeMatters : 0;

      // Conversion: inquiry → active_client
      const totalInquiries = inquiries.length;
      const converted = inquiries.filter(i => ['active_client', 'completed'].includes(i.booking_stage)).length;
      const convRate = totalInquiries > 0 ? (converted / totalInquiries) * 100 : 0;

      // Billing efficiency score (weighted: collection rate 50%, low overdue 30%, growth 20%)
      const overdueScore = Math.max(0, 100 - (overdueInvs.length / Math.max(1, invoices.length)) * 100);
      const growthScore = Math.min(100, Math.max(0, 50 + growthPct));
      const effScore = Math.round(collectionRate * 0.5 + overdueScore * 0.3 + growthScore * 0.2);

      setSummary({
        totalRevenueMTD: totalRevMTD,
        totalRevenueYTD: totalRevYTD,
        revenueGrowthPct: growthPct,
        activeMatters,
        newClientsThisMonth: newClients,
        avgMatterValue: avgMatterVal,
        overallCollectionRate: collectionRate,
        overdueInvoicesCount: overdueInvs.length,
        overdueAmount: overdueAmt,
        conversionRate: convRate,
        avgDaysToConvert: 0,
        billingEfficiencyScore: effScore,
      });

      // ── Client Acquisition Sources ────────────────────────────────────────
      const sourceMap = new Map<string, { count: number; revenue: number }>();
      for (const inq of inquiries) {
        const src = inq.service || 'Direct';
        if (!sourceMap.has(src)) sourceMap.set(src, { count: 0, revenue: 0 });
        sourceMap.get(src)!.count++;
      }
      // Attach revenue from invoices
      for (const inv of invoices) {
        const ci = inv.contact_inquiries as { service: string } | null;
        const src = ci?.service || 'Direct';
        if (sourceMap.has(src)) {
          sourceMap.get(src)!.revenue += inv.amount_paid || 0;
        }
      }
      const totalAcq = inquiries.length || 1;
      const acqArr: AcquisitionSource[] = Array.from(sourceMap.entries())
        .map(([source, v]) => ({ source, count: v.count, revenue: v.revenue, pct: Math.round((v.count / totalAcq) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setAcquisitionData(acqArr);

      // ── Conversion Funnel ─────────────────────────────────────────────────
      const stageOrder = ['inquiry', 'consultation_booked', 'proposal_sent', 'active_client', 'completed'];
      const stageLabels: Record<string, string> = {
        inquiry: 'Initial Inquiry',
        consultation_booked: 'Consultation Booked',
        proposal_sent: 'Proposal Sent',
        active_client: 'Active Client',
        completed: 'Matter Completed',
      };
      const stageColors = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba'];
      const stageCounts = stageOrder.map((stage, idx) => {
        const count = inquiries.filter(i => {
          const stageIdx = stageOrder.indexOf(i.booking_stage);
          return stageIdx >= idx;
        }).length;
        return {
          stage,
          label: stageLabels[stage],
          count,
          pct: totalInquiries > 0 ? Math.round((count / totalInquiries) * 100) : 0,
          color: stageColors[idx],
        };
      });
      setConversionData(stageCounts);

      // ── Billing Efficiency by Service ─────────────────────────────────────
      const svcMap = new Map<string, { billed: number; collected: number; overdue: number }>();
      for (const inv of invoices) {
        const ci = inv.contact_inquiries as { service: string } | null;
        const svc = ci?.service || 'General';
        if (!svcMap.has(svc)) svcMap.set(svc, { billed: 0, collected: 0, overdue: 0 });
        const s = svcMap.get(svc)!;
        s.billed += inv.amount || 0;
        s.collected += inv.amount_paid || 0;
        if (inv.status === 'overdue') s.overdue++;
      }
      const billArr: BillingEfficiency[] = Array.from(svcMap.entries())
        .map(([service, v]) => ({
          service,
          billed: v.billed,
          collected: v.collected,
          collectionRate: v.billed > 0 ? (v.collected / v.billed) * 100 : 0,
          avgDaysToCollect: 0,
          overdueCount: v.overdue,
        }))
        .sort((a, b) => b.billed - a.billed)
        .slice(0, 8);
      setBillingData(billArr);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const VIEWS = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue Trends' },
    { id: 'acquisition', label: 'Client Acquisition' },
    { id: 'conversion', label: 'Matter Conversion' },
    { id: 'billing', label: 'Billing Efficiency' },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-sm text-muted-foreground">Loading KPI data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: ACCENT }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-foreground">Practice KPI Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue trends, client acquisition, matter conversion &amp; billing efficiency</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
            {(['3m', '6m', '12m'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r === '3m' ? '3 Mo' : r === '6m' ? '6 Mo' : '12 Mo'}
              </button>
            ))}
          </div>
          {/* Export buttons */}
          <button
            onClick={() => exportToCSV(revenueData.map(r => ({ Month: r.month, Billed: r.billed, Collected: r.collected, Outstanding: r.outstanding })), 'kpi-revenue-trends.csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>
          <button
            onClick={() => exportToPDF(summary, revenueData, acquisitionData, billingData)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: ACCENT }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Revenue MTD"
          value={fmtK(summary.totalRevenueMTD)}
          trend={`${Math.abs(Math.round(summary.revenueGrowthPct))}% vs last mo`}
          trendUp={summary.revenueGrowthPct >= 0}
          accent
        />
        <KPICard
          label="Revenue YTD"
          value={fmtK(summary.totalRevenueYTD)}
          sub="year to date"
        />
        <KPICard
          label="Active Matters"
          value={summary.activeMatters.toString()}
          sub={`${summary.newClientsThisMonth} new this month`}
        />
        <KPICard
          label="Avg Matter Value"
          value={fmtK(summary.avgMatterValue)}
          sub="per active matter"
        />
        <KPICard
          label="Collection Rate"
          value={fmtPct(summary.overallCollectionRate)}
          trend={summary.overallCollectionRate >= 80 ? 'On target' : 'Below target'}
          trendUp={summary.overallCollectionRate >= 80}
        />
        <KPICard
          label="Overdue Invoices"
          value={summary.overdueInvoicesCount.toString()}
          sub={fmtK(summary.overdueAmount) + ' outstanding'}
          trend={summary.overdueInvoicesCount > 5 ? 'Needs attention' : undefined}
          trendUp={false}
        />
        <KPICard
          label="Matter Conversion"
          value={fmtPct(summary.conversionRate)}
          sub="inquiry → active client"
        />
        <KPICard
          label="Billing Efficiency"
          value={`${summary.billingEfficiencyScore}/100`}
          trend={summary.billingEfficiencyScore >= 70 ? 'Healthy' : 'Needs review'}
          trendUp={summary.billingEfficiencyScore >= 70}
        />
      </div>

      {/* ── Sub-view Tabs ── */}
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto scrollbar-hide">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeView === v.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Revenue area chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground mb-5">Billed vs. collected over time</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4a7c59" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4a7c59" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip currency />} />
                <Area type="monotone" dataKey="billed" name="Billed" stroke={ACCENT} strokeWidth={2} fill="url(#gradBilled)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#4a7c59" strokeWidth={2} fill="url(#gradCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Acquisition pie */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Client Acquisition</h3>
            <p className="text-xs text-muted-foreground mb-5">Inquiries by practice area</p>
            {acquisitionData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No data available</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={acquisitionData} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={2}>
                      {acquisitionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Clients']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {acquisitionData.slice(0, 5).map((a, i) => (
                    <div key={a.source} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-foreground truncate flex-1">{a.source}</span>
                      <span className="text-xs font-semibold text-foreground">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Conversion funnel */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Matter Conversion Funnel</h3>
            <p className="text-xs text-muted-foreground mb-5">Inquiry → active client pipeline</p>
            <div className="flex flex-col gap-3">
              {conversionData.map((stage) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{stage.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{stage.count}</span>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">{stage.pct}%</span>
                    </div>
                  </div>
                  <div className="h-6 bg-secondary/40 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all duration-700"
                      style={{ width: `${Math.max(stage.pct, 2)}%`, background: stage.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing efficiency */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Billing Efficiency</h3>
            <p className="text-xs text-muted-foreground mb-5">Collection rate by practice area</p>
            {billingData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No billing data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={billingData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="service" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v: number) => [`${Math.round(v)}%`, 'Collection Rate']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="collectionRate" name="Collection Rate" radius={[0, 6, 6, 0]}>
                    {billingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Revenue Trends ── */}
      {activeView === 'revenue' && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Revenue Over Time</h3>
            <p className="text-xs text-muted-foreground mb-5">Billed, collected, and outstanding by month</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBilled2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCollected2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4a7c59" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4a7c59" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOutstanding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e57373" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#e57373" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip currency />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Area type="monotone" dataKey="billed" name="Billed" stroke={ACCENT} strokeWidth={2} fill="url(#gradBilled2)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#4a7c59" strokeWidth={2} fill="url(#gradCollected2)" />
                <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke="#e57373" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradOutstanding)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-base text-foreground">Monthly Revenue Breakdown</h3>
              <button
                onClick={() => exportToCSV(revenueData.map(r => ({ Month: r.month, Billed: r.billed, Collected: r.collected, Outstanding: r.outstanding })), 'revenue-trends.csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Month</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Billed</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Collected</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Outstanding</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Collection %</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map((row) => {
                    const rate = row.billed > 0 ? Math.round((row.collected / row.billed) * 100) : 0;
                    return (
                      <tr key={row.month} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-3 font-medium text-foreground">{row.month}</td>
                        <td className="px-6 py-3 text-right text-foreground">{fmt(row.billed)}</td>
                        <td className="px-6 py-3 text-right text-foreground">{fmt(row.collected)}</td>
                        <td className="px-6 py-3 text-right text-red-500">{fmt(row.outstanding)}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Client Acquisition ── */}
      {activeView === 'acquisition' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-0.5">Inquiries by Practice Area</h3>
              <p className="text-xs text-muted-foreground mb-5">Client acquisition volume per service</p>
              {acquisitionData.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={acquisitionData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="source" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Clients" radius={[6, 6, 0, 0]}>
                      {acquisitionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-0.5">Revenue by Source</h3>
              <p className="text-xs text-muted-foreground mb-5">Collected revenue per practice area</p>
              {acquisitionData.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={acquisitionData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="source" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
                      {acquisitionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Acquisition table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-base text-foreground">Acquisition Source Breakdown</h3>
              <button
                onClick={() => exportToCSV(acquisitionData.map(a => ({ Source: a.source, Clients: a.count, Revenue: a.revenue, Share: `${a.pct}%` })), 'client-acquisition.csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Practice Area</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Clients</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Revenue</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Avg/Client</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {acquisitionData.map((row, i) => (
                    <tr key={row.source} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-foreground">{row.source}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right text-foreground">{row.count}</td>
                      <td className="px-6 py-3 text-right text-foreground">{fmt(row.revenue)}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{row.count > 0 ? fmt(row.revenue / row.count) : '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                          <span className="text-xs font-semibold text-foreground w-8 text-right">{row.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Matter Conversion ── */}
      {activeView === 'conversion' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Funnel visual */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-0.5">Conversion Funnel</h3>
              <p className="text-xs text-muted-foreground mb-6">Inquiry → matter completion pipeline</p>
              <div className="flex flex-col gap-4">
                {conversionData.map((stage, i) => {
                  const dropOff = i > 0 ? conversionData[i - 1].count - stage.count : 0;
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: stage.color }}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground">{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">{stage.count}</span>
                          {dropOff > 0 && (
                            <span className="text-xs text-red-500 font-medium">−{dropOff} dropped</span>
                          )}
                        </div>
                      </div>
                      <div className="h-8 bg-secondary/40 rounded-xl overflow-hidden">
                        <div
                          className="h-full rounded-xl flex items-center pl-3 transition-all duration-700"
                          style={{ width: `${Math.max(stage.pct, 3)}%`, background: stage.color }}
                        >
                          {stage.pct > 15 && (
                            <span className="text-xs text-white font-semibold">{stage.pct}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversion metrics */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-serif text-base text-foreground mb-0.5">Conversion Metrics</h3>
              <p className="text-xs text-muted-foreground mb-6">Stage-by-stage performance</p>
              <div className="flex flex-col gap-4">
                {conversionData.map((stage, i) => {
                  const prevCount = i > 0 ? conversionData[i - 1].count : stage.count;
                  const stageConvRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 100;
                  return (
                    <div key={stage.stage} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                        <span className="text-sm text-foreground">{stage.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-foreground">{stage.count}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageConvRate >= 70 ? 'bg-emerald-100 text-emerald-700' : stageConvRate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {i === 0 ? '100%' : `${stageConvRate}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Overall Conversion Rate</span>
                  <span className="text-lg font-semibold" style={{ color: ACCENT }}>{fmtPct(summary.conversionRate)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Inquiry to active client or completed matter</p>
              </div>
            </div>
          </div>

          {/* Conversion by service */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Conversion by Practice Area</h3>
            <p className="text-xs text-muted-foreground mb-5">Which services convert inquiries to active matters most effectively</p>
            {acquisitionData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Practice Area</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Inquiries</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Revenue Generated</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acquisitionData.map((row, i) => (
                      <tr key={row.source} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-foreground">{row.source}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">{row.count}</td>
                        <td className="px-4 py-3 text-right text-foreground">{fmt(row.revenue)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground">{row.pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Billing Efficiency ── */}
      {activeView === 'billing' && (
        <div className="space-y-5">
          {/* Efficiency score card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Efficiency Score</p>
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={ACCENT} strokeWidth="3"
                    strokeDasharray={`${summary.billingEfficiencyScore} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-semibold text-foreground">{summary.billingEfficiencyScore}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Collection Rate</p>
              <p className="text-3xl font-semibold text-foreground">{fmtPct(summary.overallCollectionRate)}</p>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${summary.overallCollectionRate}%`, background: ACCENT }} />
              </div>
              <p className="text-xs text-muted-foreground">Target: 85%+</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Overdue Exposure</p>
              <p className="text-3xl font-semibold text-red-500">{fmtK(summary.overdueAmount)}</p>
              <p className="text-xs text-muted-foreground">{summary.overdueInvoicesCount} overdue invoice{summary.overdueInvoicesCount !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">Requires immediate follow-up</p>
            </div>
          </div>

          {/* Billing by service */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif text-base text-foreground mb-0.5">Billed vs. Collected by Practice Area</h3>
            <p className="text-xs text-muted-foreground mb-5">Revenue realization across all matters</p>
            {billingData.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">No billing data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={billingData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="service" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  <Bar dataKey="billed" name="Billed" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#6b9e7a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Billing efficiency table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-base text-foreground">Billing Efficiency by Practice Area</h3>
              <button
                onClick={() => exportToCSV(billingData.map(b => ({ Service: b.service, Billed: b.billed, Collected: b.collected, 'Collection Rate': `${Math.round(b.collectionRate)}%`, 'Overdue Count': b.overdueCount })), 'billing-efficiency.csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Practice Area</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Billed</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Collected</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Uncollected</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Collection %</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData.map((row) => {
                    const rate = Math.round(row.collectionRate);
                    return (
                      <tr key={row.service} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-3 font-medium text-foreground">{row.service}</td>
                        <td className="px-6 py-3 text-right text-foreground">{fmt(row.billed)}</td>
                        <td className="px-6 py-3 text-right text-foreground">{fmt(row.collected)}</td>
                        <td className="px-6 py-3 text-right text-red-500">{fmt(Math.max(0, row.billed - row.collected))}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {row.overdueCount > 0 ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{row.overdueCount}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
