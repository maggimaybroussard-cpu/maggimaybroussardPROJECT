'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, Line,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingTrendPoint {
  month: string;
  bookings: number;
  consultations: number;
  inquiries: number;
}

interface RevenuePoint {
  month: string;
  collected: number;
  invoiced: number;
}

interface SourceAttribution {
  source: string;
  count: number;
  converted: number;
  conversionRate: number;
}

interface SeasonalPattern {
  month: string;
  shortMonth: string;
  bookings: number;
  revenue: number;
  avgBookings: number;
}

interface ReportSummary {
  totalBookings: number;
  totalRevenue: number;
  topSource: string;
  peakMonth: string;
  avgMonthlyBookings: number;
  avgMonthlyRevenue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = ['#355E3B', '#5a9e62', '#8bc49a', '#b8dbbf', '#d4ece0', '#e8f5ec'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function exportToCSV(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToPDF(
  title: string,
  sections: { heading: string; rows: Record<string, string | number>[]; columns: string[] }[]
) {
  const lines: string[] = [];
  lines.push(`BROUSSARD LEGAL SERVICES — ${title.toUpperCase()}`);
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');

  for (const section of sections) {
    lines.push(`=== ${section.heading} ===`);
    lines.push(section.columns.map((c) => c.replace(/_/g, ' ').toUpperCase()).join('\t'));
    for (const row of section.rows) {
      lines.push(section.columns.map((c) => String(row[c] ?? '')).join('\t'));
    }
    lines.push('');
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">{typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'6m' | '12m' | '24m'>('12m');
  const [activeSection, setActiveSection] = useState<'booking_trends' | 'revenue' | 'source_attribution' | 'seasonal'>('booking_trends');
  const [exporting, setExporting] = useState<string | null>(null);

  const [bookingTrends, setBookingTrends] = useState<BookingTrendPoint[]>([]);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [sourceData, setSourceData] = useState<SourceAttribution[]>([]);
  const [seasonalData, setSeasonalData] = useState<SeasonalPattern[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalBookings: 0,
    totalRevenue: 0,
    topSource: '—',
    peakMonth: '—',
    avgMonthlyBookings: 0,
    avgMonthlyRevenue: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const months = dateRange === '6m' ? 6 : dateRange === '12m' ? 12 : 24;
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);
      const fromStr = fromDate.toISOString().split('T')[0];

      // Fetch all data in parallel
      const [inquiriesRes, calendlyRes, consultationsRes, invoicesRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id, service, booking_stage, lead_source, created_at')
          .gte('created_at', fromStr)
          .order('created_at', { ascending: true }),
        supabase
          .from('calendly_bookings')
          .select('id, status, created_at')
          .gte('created_at', fromStr)
          .order('created_at', { ascending: true }),
        supabase
          .from('consultation_bookings')
          .select('id, status, booking_date, created_at')
          .gte('created_at', fromStr)
          .order('created_at', { ascending: true }),
        supabase
          .from('client_invoices')
          .select('amount, payment_status, created_at')
          .gte('created_at', fromStr)
          .order('created_at', { ascending: true }),
      ]);

      const inquiries = inquiriesRes.data || [];
      const calendlyBookings = calendlyRes.data || [];
      const consultationBookings = consultationsRes.data || [];
      const invoices = invoicesRes.data || [];

      // Build month keys for the range
      const allMonths: string[] = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      // ── Booking Trends ──
      const trendMap: Record<string, { bookings: number; consultations: number; inquiries: number }> = {};
      allMonths.forEach((m) => { trendMap[m] = { bookings: 0, consultations: 0, inquiries: 0 }; });

      calendlyBookings.forEach((b) => {
        const key = getMonthKey(b.created_at);
        if (trendMap[key]) trendMap[key].bookings++;
      });
      consultationBookings.forEach((b) => {
        const key = getMonthKey(b.created_at);
        if (trendMap[key]) trendMap[key].consultations++;
      });
      inquiries.forEach((i) => {
        const key = getMonthKey(i.created_at);
        if (trendMap[key]) trendMap[key].inquiries++;
      });

      const trendPoints: BookingTrendPoint[] = allMonths.map((m) => ({
        month: getMonthLabel(m),
        ...trendMap[m],
      }));
      setBookingTrends(trendPoints);

      // ── Revenue ──
      const revenueMap: Record<string, { collected: number; invoiced: number }> = {};
      allMonths.forEach((m) => { revenueMap[m] = { collected: 0, invoiced: 0 }; });

      invoices.forEach((inv) => {
        const key = getMonthKey(inv.created_at);
        if (revenueMap[key]) {
          revenueMap[key].invoiced += inv.amount || 0;
          if (inv.payment_status === 'paid') revenueMap[key].collected += inv.amount || 0;
        }
      });

      const revPoints: RevenuePoint[] = allMonths.map((m) => ({
        month: getMonthLabel(m),
        collected: Math.round(revenueMap[m].collected),
        invoiced: Math.round(revenueMap[m].invoiced),
      }));
      setRevenueData(revPoints);

      // ── Source Attribution ──
      const sourceMap: Record<string, { count: number; converted: number }> = {};
      inquiries.forEach((i) => {
        const src = i.lead_source || 'Direct / Unknown';
        if (!sourceMap[src]) sourceMap[src] = { count: 0, converted: 0 };
        sourceMap[src].count++;
        if (['active_client', 'case_created', 'paid'].includes(i.booking_stage || '')) {
          sourceMap[src].converted++;
        }
      });

      const srcData: SourceAttribution[] = Object.entries(sourceMap)
        .map(([source, d]) => ({
          source,
          count: d.count,
          converted: d.converted,
          conversionRate: d.count > 0 ? Math.round((d.converted / d.count) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setSourceData(srcData);

      // ── Seasonal Patterns (by calendar month across all years) ──
      const seasonMap: Record<number, { bookings: number; revenue: number; years: Set<number> }> = {};
      for (let m = 0; m < 12; m++) seasonMap[m] = { bookings: 0, revenue: 0, years: new Set() };

      calendlyBookings.forEach((b) => {
        const d = new Date(b.created_at);
        seasonMap[d.getMonth()].bookings++;
        seasonMap[d.getMonth()].years.add(d.getFullYear());
      });
      consultationBookings.forEach((b) => {
        const d = new Date(b.created_at);
        seasonMap[d.getMonth()].bookings++;
      });
      invoices.forEach((inv) => {
        if (inv.payment_status === 'paid') {
          const d = new Date(inv.created_at);
          seasonMap[d.getMonth()].revenue += inv.amount || 0;
        }
      });

      const totalBookingsForAvg = Object.values(seasonMap).reduce((s, v) => s + v.bookings, 0);
      const avgPerMonth = totalBookingsForAvg / 12;

      const seasonPoints: SeasonalPattern[] = Array.from({ length: 12 }, (_, i) => ({
        month: FULL_MONTH_NAMES[i],
        shortMonth: MONTH_NAMES[i],
        bookings: seasonMap[i].bookings,
        revenue: Math.round(seasonMap[i].revenue),
        avgBookings: Math.round(avgPerMonth),
      }));
      setSeasonalData(seasonPoints);

      // ── Summary ──
      const totalBookings = calendlyBookings.length + consultationBookings.length;
      const totalRevenue = invoices.filter((i) => i.payment_status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
      const topSrc = srcData[0]?.source || '—';
      const peakMonthIdx = seasonPoints.reduce((best, cur, idx) => cur.bookings > seasonPoints[best].bookings ? idx : best, 0);
      const peakMonth = FULL_MONTH_NAMES[peakMonthIdx];

      setSummary({
        totalBookings,
        totalRevenue,
        topSource: topSrc,
        peakMonth,
        avgMonthlyBookings: months > 0 ? Math.round(totalBookings / months) : 0,
        avgMonthlyRevenue: months > 0 ? Math.round(totalRevenue / months) : 0,
      });
    } catch (err) {
      console.error('Reports fetch error:', err);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Export Handlers ──

  const handleExportCSV = async (section: string) => {
    setExporting(section);
    try {
      if (section === 'booking_trends') {
        exportToCSV(bookingTrends.map((r) => ({ month: r.month, calendly_bookings: r.bookings, consultation_bookings: r.consultations, total_inquiries: r.inquiries })), 'booking_trends');
      } else if (section === 'revenue') {
        exportToCSV(revenueData.map((r) => ({ month: r.month, revenue_collected: r.collected, revenue_invoiced: r.invoiced })), 'revenue_report');
      } else if (section === 'source_attribution') {
        exportToCSV(sourceData.map((r) => ({ source: r.source, total_leads: r.count, converted: r.converted, conversion_rate_pct: r.conversionRate })), 'source_attribution');
      } else if (section === 'seasonal') {
        exportToCSV(seasonalData.map((r) => ({ month: r.month, total_bookings: r.bookings, revenue_collected: r.revenue, avg_monthly_bookings: r.avgBookings })), 'seasonal_patterns');
      } else if (section === 'all') {
        exportToCSV([
          ...bookingTrends.map((r) => ({ report: 'Booking Trends', period: r.month, metric_1: r.bookings, metric_2: r.consultations, metric_3: r.inquiries })),
          ...revenueData.map((r) => ({ report: 'Revenue', period: r.month, metric_1: r.collected, metric_2: r.invoiced, metric_3: '' })),
          ...sourceData.map((r) => ({ report: 'Source Attribution', period: r.source, metric_1: r.count, metric_2: r.converted, metric_3: r.conversionRate })),
          ...seasonalData.map((r) => ({ report: 'Seasonal Patterns', period: r.month, metric_1: r.bookings, metric_2: r.revenue, metric_3: r.avgBookings })),
        ], 'full_report');
      }
    } catch { /* silent */ }
    setExporting(null);
  };

  const handleExportPDF = async (section: string) => {
    setExporting(`pdf_${section}`);
    try {
      const sections = [];
      if (section === 'booking_trends' || section === 'all') {
        sections.push({
          heading: 'Booking Trends',
          columns: ['month', 'calendly_bookings', 'consultation_bookings', 'total_inquiries'],
          rows: bookingTrends.map((r) => ({ month: r.month, calendly_bookings: r.bookings, consultation_bookings: r.consultations, total_inquiries: r.inquiries })),
        });
      }
      if (section === 'revenue' || section === 'all') {
        sections.push({
          heading: 'Revenue Report',
          columns: ['month', 'revenue_collected', 'revenue_invoiced'],
          rows: revenueData.map((r) => ({ month: r.month, revenue_collected: formatCurrency(r.collected), revenue_invoiced: formatCurrency(r.invoiced) })),
        });
      }
      if (section === 'source_attribution' || section === 'all') {
        sections.push({
          heading: 'Source Attribution',
          columns: ['source', 'total_leads', 'converted', 'conversion_rate_pct'],
          rows: sourceData.map((r) => ({ source: r.source, total_leads: r.count, converted: r.converted, conversion_rate_pct: `${r.conversionRate}%` })),
        });
      }
      if (section === 'seasonal' || section === 'all') {
        sections.push({
          heading: 'Seasonal Patterns',
          columns: ['month', 'total_bookings', 'revenue_collected', 'avg_monthly_bookings'],
          rows: seasonalData.map((r) => ({ month: r.month, total_bookings: r.bookings, revenue_collected: formatCurrency(r.revenue), avg_monthly_bookings: r.avgBookings })),
        });
      }
      await exportToPDF(section === 'all' ? 'Full Analytics Report' : section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), sections);
    } catch { /* silent */ }
    setExporting(null);
  };

  // ── Section config ──
  const SECTIONS = [
    { id: 'booking_trends' as const, label: 'Booking Trends', icon: '📈' },
    { id: 'revenue' as const, label: 'Revenue', icon: '💰' },
    { id: 'source_attribution' as const, label: 'Source Attribution', icon: '🎯' },
    { id: 'seasonal' as const, label: 'Seasonal Patterns', icon: '🗓️' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                Admin
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm font-semibold text-foreground">Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCSV('all')}
                disabled={loading || exporting === 'all'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
              >
                {exporting === 'all' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                )}
                Export All CSV
              </button>
              <button
                onClick={() => handleExportPDF('all')}
                disabled={loading || exporting === 'pdf_all'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {exporting === 'pdf_all' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                )}
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Title + Date Range */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-foreground mb-1">Analytics Reports</h1>
            <p className="text-sm text-muted-foreground font-light">Booking trends, revenue, source attribution, and seasonal patterns</p>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/40 rounded-xl p-1">
            {(['6m', '12m', '24m'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === r ? 'bg-card text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === '6m' ? 'Last 6 mo' : r === '12m' ? 'Last 12 mo' : 'Last 24 mo'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="h-3 w-24 bg-secondary rounded mb-3" />
                <div className="h-7 w-16 bg-secondary rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Bookings', value: summary.totalBookings.toLocaleString(), sub: `~${summary.avgMonthlyBookings}/mo avg`, color: '#355E3B' },
              { label: 'Revenue Collected', value: formatCurrency(summary.totalRevenue), sub: `${formatCurrency(summary.avgMonthlyRevenue)}/mo avg`, color: '#5a9e62' },
              { label: 'Top Lead Source', value: summary.topSource, sub: 'Highest volume', color: '#8bc49a' },
              { label: 'Peak Month', value: summary.peakMonth, sub: 'Most bookings', color: '#355E3B' },
            ].map((card) => (
              <div key={card.label} className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5" style={{ background: card.color, transform: 'translate(30%, -30%)' }} />
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{card.label}</p>
                <p className="text-xl font-bold text-foreground truncate">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1 w-fit flex-wrap">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeSection === s.id
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Booking Trends ── */}
        {activeSection === 'booking_trends' && (
          <div className="space-y-6">
            <SectionHeader
              title="Booking Trends"
              description="Monthly volume of Calendly bookings, consultation bookings, and new inquiries"
              onCSV={() => handleExportCSV('booking_trends')}
              onPDF={() => handleExportPDF('booking_trends')}
              csvLoading={exporting === 'booking_trends'}
              pdfLoading={exporting === 'pdf_booking_trends'}
              disabled={loading}
            />
            {loading ? <ChartSkeleton /> : (
              <div className="bg-card border border-border rounded-2xl p-6">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={bookingTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#355E3B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradConsultations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5a9e62" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#5a9e62" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradInquiries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8bc49a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8bc49a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Area type="monotone" dataKey="bookings" name="Calendly Bookings" stroke="#355E3B" fill="url(#gradBookings)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="consultations" name="Consultation Bookings" stroke="#5a9e62" fill="url(#gradConsultations)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="inquiries" name="New Inquiries" stroke="#8bc49a" fill="url(#gradInquiries)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {!loading && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {['Month', 'Calendly Bookings', 'Consultation Bookings', 'New Inquiries', 'Total Activity'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookingTrends.map((row, i) => (
                        <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                          <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{row.month}</td>
                          <td className="px-5 py-3 text-foreground/80">{row.bookings}</td>
                          <td className="px-5 py-3 text-foreground/80">{row.consultations}</td>
                          <td className="px-5 py-3 text-foreground/80">{row.inquiries}</td>
                          <td className="px-5 py-3 font-semibold text-foreground">{row.bookings + row.consultations + row.inquiries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Revenue ── */}
        {activeSection === 'revenue' && (
          <div className="space-y-6">
            <SectionHeader
              title="Revenue Report"
              description="Monthly collected vs. invoiced revenue across all matters"
              onCSV={() => handleExportCSV('revenue')}
              onPDF={() => handleExportPDF('revenue')}
              csvLoading={exporting === 'revenue'}
              pdfLoading={exporting === 'pdf_revenue'}
              disabled={loading}
            />
            {loading ? <ChartSkeleton /> : (
              <div className="bg-card border border-border rounded-2xl p-6">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Bar dataKey="invoiced" name="Revenue Invoiced" fill="#8bc49a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Revenue Collected" fill="#355E3B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!loading && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Revenue Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {['Month', 'Invoiced', 'Collected', 'Outstanding', 'Collection Rate'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revenueData.map((row, i) => {
                        const outstanding = row.invoiced - row.collected;
                        const rate = row.invoiced > 0 ? Math.round((row.collected / row.invoiced) * 100) : 0;
                        return (
                          <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{row.month}</td>
                            <td className="px-5 py-3 text-foreground/80">{formatCurrency(row.invoiced)}</td>
                            <td className="px-5 py-3 text-foreground/80">{formatCurrency(row.collected)}</td>
                            <td className={`px-5 py-3 font-medium ${outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(outstanding)}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-[80px]">
                                  <div className="h-full rounded-full" style={{ width: `${rate}%`, background: '#355E3B' }} />
                                </div>
                                <span className="text-foreground/80 font-medium">{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Source Attribution ── */}
        {activeSection === 'source_attribution' && (
          <div className="space-y-6">
            <SectionHeader
              title="Source Attribution"
              description="Lead volume and conversion rates by acquisition source"
              onCSV={() => handleExportCSV('source_attribution')}
              onPDF={() => handleExportPDF('source_attribution')}
              csvLoading={exporting === 'source_attribution'}
              pdfLoading={exporting === 'pdf_source_attribution'}
              disabled={loading}
            />
            {loading ? <ChartSkeleton /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Lead Volume by Source</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sourceData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="source" type="category" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={110} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Total Leads" fill="#355E3B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Source Distribution</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={sourceData}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {!loading && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Source Performance Table</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {['Source', 'Total Leads', 'Converted', 'Conversion Rate', 'Share of Leads'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sourceData.map((row, i) => {
                        const totalLeads = sourceData.reduce((s, r) => s + r.count, 0);
                        const share = totalLeads > 0 ? Math.round((row.count / totalLeads) * 100) : 0;
                        return (
                          <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-3 font-medium text-foreground">{row.source}</td>
                            <td className="px-5 py-3 text-foreground/80">{row.count}</td>
                            <td className="px-5 py-3 text-foreground/80">{row.converted}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.conversionRate >= 50 ? 'bg-emerald-100 text-emerald-700' : row.conversionRate >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                                {row.conversionRate}%
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-[80px]">
                                  <div className="h-full rounded-full" style={{ width: `${share}%`, background: COLORS[i % COLORS.length] }} />
                                </div>
                                <span className="text-foreground/80">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Seasonal Patterns ── */}
        {activeSection === 'seasonal' && (
          <div className="space-y-6">
            <SectionHeader
              title="Seasonal Patterns"
              description="Booking volume and revenue by calendar month — identify peak and slow seasons"
              onCSV={() => handleExportCSV('seasonal')}
              onPDF={() => handleExportPDF('seasonal')}
              csvLoading={exporting === 'seasonal'}
              pdfLoading={exporting === 'pdf_seasonal'}
              disabled={loading}
            />
            {loading ? <ChartSkeleton /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Bookings by Month</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={seasonalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="bookings" name="Total Bookings" fill="#355E3B" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="avgBookings" name="Monthly Avg" stroke="#8bc49a" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Revenue by Month</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={seasonalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRevSeasonal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#355E3B" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                      <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#355E3B" fill="url(#gradRevSeasonal)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {!loading && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Seasonal Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {['Month', 'Total Bookings', 'vs. Monthly Avg', 'Revenue Collected', 'Trend'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {seasonalData.map((row, i) => {
                        const diff = row.bookings - row.avgBookings;
                        const pct = row.avgBookings > 0 ? Math.round((diff / row.avgBookings) * 100) : 0;
                        return (
                          <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-3 font-medium text-foreground">{row.month}</td>
                            <td className="px-5 py-3 text-foreground/80">{row.bookings}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-secondary text-muted-foreground'}`}>
                                {diff > 0 ? '+' : ''}{pct}%
                              </span>
                            </td>
                            <td className="px-5 py-3 text-foreground/80">{formatCurrency(row.revenue)}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                {diff > 0 ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                                ) : diff < 0 ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                ) : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                )}
                                <span className="text-muted-foreground text-xs">{diff > 0 ? 'Above avg' : diff < 0 ? 'Below avg' : 'On avg'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title, description, onCSV, onPDF, csvLoading, pdfLoading, disabled,
}: {
  title: string;
  description: string;
  onCSV: () => void;
  onPDF: () => void;
  csvLoading: boolean;
  pdfLoading: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="font-serif text-xl text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onCSV}
          disabled={disabled || csvLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
        >
          {csvLoading ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          )}
          CSV
        </button>
        <button
          onClick={onPDF}
          disabled={disabled || pdfLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:opacity-90"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          {pdfLoading ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          )}
          PDF
        </button>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
      <div className="h-[320px] bg-secondary/40 rounded-xl" />
    </div>
  );
}
