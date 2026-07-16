'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  engagement_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
  work_type: string | null;
  case_task: string | null;
  hourly_rate: number | null;
  billed_at: string | null;
  created_at: string;
  retainer_subscriptions?: {
    customer_name: string;
    customer_email: string;
    plan_name: string;
    amount: number;
  } | null;
  contact_inquiries?: {
    name: string;
    email: string;
    service: string;
    firm: string;
  } | null;
  engagements?: {
    title: string;
    matter_number: string | null;
  } | null;
}

interface AttorneySummary {
  attorney: string;
  totalHours: number;
  billedHours: number;
  unbilledHours: number;
  totalAmount: number;
  logCount: number;
}

interface ClientSummary {
  clientName: string;
  clientEmail: string;
  totalHours: number;
  billedHours: number;
  unbilledHours: number;
  totalAmount: number;
  logCount: number;
}

interface CaseSummary {
  caseId: string;
  caseName: string;
  service: string;
  clientName: string;
  totalHours: number;
  billedHours: number;
  unbilledHours: number;
  totalAmount: number;
  logCount: number;
}

const COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#C8965A', '#4A6FA5', '#8B5E3C'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? '').replace(/"/g, '""');
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
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

// ─── Date Presets ─────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: 0 },
];

function getPresetDates(days: number): { from: string; to: string } {
  const to = new Date();
  const from = days > 0 ? new Date(Date.now() - days * 86400000) : new Date('2020-01-01');
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillableHoursReportingDashboard() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState(1); // This Month
  const [dateFrom, setDateFrom] = useState(() => getPresetDates(30).from);
  const [dateTo, setDateTo] = useState(() => getPresetDates(30).to);
  const [activeView, setActiveView] = useState<'attorney' | 'client' | 'case'>('attorney');
  const [searchQuery, setSearchQuery] = useState('');
  const [billedFilter, setBilledFilter] = useState<'all' | 'billed' | 'unbilled'>('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('retainer_time_logs')
        .select(`
          *,
          retainer_subscriptions(customer_name, customer_email, plan_name, amount),
          contact_inquiries(name, email, service, firm),
          engagements(title, matter_number)
        `)
        .order('work_date', { ascending: false });

      if (dateFrom) query = query.gte('work_date', dateFrom);
      if (dateTo) query = query.lte('work_date', dateTo);

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setLogs(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load time logs');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePreset = (idx: number, days: number) => {
    setActivePreset(idx);
    const { from, to } = getPresetDates(days);
    setDateFrom(from);
    setDateTo(to);
  };

  // ── Filtered logs ─────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (billedFilter === 'billed' && !log.billed_at) return false;
      if (billedFilter === 'unbilled' && log.billed_at) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientName = log.retainer_subscriptions?.customer_name?.toLowerCase() ?? '';
        const caseName = log.contact_inquiries?.name?.toLowerCase() ?? '';
        const attorney = (log.logged_by ?? '').toLowerCase();
        const desc = (log.description ?? '').toLowerCase();
        if (!clientName.includes(q) && !caseName.includes(q) && !attorney.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [logs, billedFilter, searchQuery]);

  // ── KPI totals ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalHours = filteredLogs.reduce((s, l) => s + Number(l.hours), 0);
    const billedHours = filteredLogs.filter((l) => l.billed_at).reduce((s, l) => s + Number(l.hours), 0);
    const unbilledHours = totalHours - billedHours;
    const totalAmount = filteredLogs.reduce((s, l) => {
      const rate = l.hourly_rate ?? 0;
      return s + (rate > 0 ? Number(l.hours) * rate : 0);
    }, 0);
    const uniqueClients = new Set(filteredLogs.map((l) => l.retainer_subscriptions?.customer_email).filter(Boolean)).size;
    const uniqueCases = new Set(filteredLogs.map((l) => l.inquiry_id).filter(Boolean)).size;
    return { totalHours, billedHours, unbilledHours, totalAmount, uniqueClients, uniqueCases };
  }, [filteredLogs]);

  // ── Attorney summary ──────────────────────────────────────────────────────
  const attorneySummary = useMemo<AttorneySummary[]>(() => {
    const map: Record<string, AttorneySummary> = {};
    filteredLogs.forEach((log) => {
      const attorney = log.logged_by || 'Maggi May Broussard';
      if (!map[attorney]) map[attorney] = { attorney, totalHours: 0, billedHours: 0, unbilledHours: 0, totalAmount: 0, logCount: 0 };
      const hrs = Number(log.hours);
      const rate = log.hourly_rate ?? 0;
      map[attorney].totalHours += hrs;
      map[attorney].logCount += 1;
      map[attorney].totalAmount += rate > 0 ? hrs * rate : 0;
      if (log.billed_at) map[attorney].billedHours += hrs;
      else map[attorney].unbilledHours += hrs;
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredLogs]);

  // ── Client summary ────────────────────────────────────────────────────────
  const clientSummary = useMemo<ClientSummary[]>(() => {
    const map: Record<string, ClientSummary> = {};
    filteredLogs.forEach((log) => {
      const sub = log.retainer_subscriptions;
      const clientName = sub?.customer_name || 'Unknown Client';
      const clientEmail = sub?.customer_email || '';
      const key = clientEmail || clientName;
      if (!map[key]) map[key] = { clientName, clientEmail, totalHours: 0, billedHours: 0, unbilledHours: 0, totalAmount: 0, logCount: 0 };
      const hrs = Number(log.hours);
      const rate = log.hourly_rate ?? 0;
      map[key].totalHours += hrs;
      map[key].logCount += 1;
      map[key].totalAmount += rate > 0 ? hrs * rate : 0;
      if (log.billed_at) map[key].billedHours += hrs;
      else map[key].unbilledHours += hrs;
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredLogs]);

  // ── Case summary ──────────────────────────────────────────────────────────
  const caseSummary = useMemo<CaseSummary[]>(() => {
    const map: Record<string, CaseSummary> = {};
    filteredLogs.forEach((log) => {
      const caseId = log.inquiry_id || 'no-case';
      const inq = log.contact_inquiries;
      const caseName = inq?.name || 'No Case Linked';
      const service = inq?.service || '—';
      const clientName = log.retainer_subscriptions?.customer_name || inq?.name || 'Unknown';
      if (!map[caseId]) map[caseId] = { caseId, caseName, service, clientName, totalHours: 0, billedHours: 0, unbilledHours: 0, totalAmount: 0, logCount: 0 };
      const hrs = Number(log.hours);
      const rate = log.hourly_rate ?? 0;
      map[caseId].totalHours += hrs;
      map[caseId].logCount += 1;
      map[caseId].totalAmount += rate > 0 ? hrs * rate : 0;
      if (log.billed_at) map[caseId].billedHours += hrs;
      else map[caseId].unbilledHours += hrs;
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredLogs]);

  // ── CSV exports ───────────────────────────────────────────────────────────
  const handleExportAttorney = () => {
    exportCSV(
      attorneySummary.map((r) => ({
        Attorney: r.attorney,
        'Total Hours': r.totalHours.toFixed(2),
        'Billed Hours': r.billedHours.toFixed(2),
        'Unbilled Hours': r.unbilledHours.toFixed(2),
        'Total Amount': r.totalAmount.toFixed(2),
        'Log Count': r.logCount,
      })),
      `billable-hours-by-attorney_${dateFrom}_${dateTo}.csv`
    );
  };

  const handleExportClient = () => {
    exportCSV(
      clientSummary.map((r) => ({
        Client: r.clientName,
        Email: r.clientEmail,
        'Total Hours': r.totalHours.toFixed(2),
        'Billed Hours': r.billedHours.toFixed(2),
        'Unbilled Hours': r.unbilledHours.toFixed(2),
        'Total Amount': r.totalAmount.toFixed(2),
        'Log Count': r.logCount,
      })),
      `billable-hours-by-client_${dateFrom}_${dateTo}.csv`
    );
  };

  const handleExportCase = () => {
    exportCSV(
      caseSummary.map((r) => ({
        Case: r.caseName,
        Service: r.service,
        Client: r.clientName,
        'Total Hours': r.totalHours.toFixed(2),
        'Billed Hours': r.billedHours.toFixed(2),
        'Unbilled Hours': r.unbilledHours.toFixed(2),
        'Total Amount': r.totalAmount.toFixed(2),
        'Log Count': r.logCount,
      })),
      `billable-hours-by-case_${dateFrom}_${dateTo}.csv`
    );
  };

  const handleExportDetail = () => {
    exportCSV(
      filteredLogs.map((log) => ({
        Date: log.work_date,
        Attorney: log.logged_by || 'Maggi May Broussard',
        Client: log.retainer_subscriptions?.customer_name || '—',
        'Client Email': log.retainer_subscriptions?.customer_email || '—',
        Case: log.contact_inquiries?.name || '—',
        Service: log.contact_inquiries?.service || '—',
        Engagement: log.engagements?.title || '—',
        'Work Type': log.work_type || '—',
        'Case Task': log.case_task || '—',
        Description: (log.description || '').replace(/^\[[^\]]+\]\s*/, ''),
        Hours: Number(log.hours).toFixed(2),
        Rate: log.hourly_rate ? `$${log.hourly_rate}` : '—',
        Amount: log.hourly_rate ? (Number(log.hours) * log.hourly_rate).toFixed(2) : '—',
        Billed: log.billed_at ? 'Yes' : 'No',
        'Billed Date': log.billed_at ? formatDate(log.billed_at) : '—',
      })),
      `billable-hours-detail_${dateFrom}_${dateTo}.csv`
    );
  };

  const chartData = useMemo(() => {
    if (activeView === 'attorney') return attorneySummary.slice(0, 8).map((r) => ({ name: r.attorney.split(' ').slice(-1)[0], hours: parseFloat(r.totalHours.toFixed(1)), amount: r.totalAmount }));
    if (activeView === 'client') return clientSummary.slice(0, 8).map((r) => ({ name: r.clientName.split(' ')[0], hours: parseFloat(r.totalHours.toFixed(1)), amount: r.totalAmount }));
    return caseSummary.slice(0, 8).map((r) => ({ name: r.caseName.split(' ').slice(0, 2).join(' '), hours: parseFloat(r.totalHours.toFixed(1)), amount: r.totalAmount }));
  }, [activeView, attorneySummary, clientSummary, caseSummary]);

  return (
    <div className="space-y-6">
      {/* ── Date Range Controls ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => handlePreset(idx, p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                  activePreset === idx
                    ? 'text-white' :'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                style={activePreset === idx ? { background: '#355E3B' } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(-1); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Hours', value: kpis.totalHours.toFixed(1), sub: 'logged', color: 'text-foreground' },
          { label: 'Billed Hours', value: kpis.billedHours.toFixed(1), sub: `${kpis.totalHours > 0 ? ((kpis.billedHours / kpis.totalHours) * 100).toFixed(0) : 0}% of total`, color: 'text-emerald-700' },
          { label: 'Unbilled Hours', value: kpis.unbilledHours.toFixed(1), sub: 'pending billing', color: kpis.unbilledHours > 0 ? 'text-amber-600' : 'text-foreground' },
          { label: 'Total Value', value: formatCurrency(kpis.totalAmount), sub: 'at logged rates', color: 'text-foreground' },
          { label: 'Active Clients', value: String(kpis.uniqueClients), sub: 'with logged hours', color: 'text-foreground' },
          { label: 'Active Cases', value: String(kpis.uniqueCases), sub: 'with time entries', color: 'text-foreground' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{kpi.label}</p>
            <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── View Tabs + Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          {(['attorney', 'client', 'case'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                activeView === v ? 'bg-card text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              By {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'billed', 'unbilled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setBilledFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                billedFilter === f ? 'text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
              style={billedFilter === f ? { background: '#355E3B' } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={activeView === 'attorney' ? handleExportAttorney : activeView === 'client' ? handleExportClient : handleExportCase}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Summary
          </button>
          <button
            onClick={handleExportDetail}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Detail
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Chart ── */}
      {!loading && chartData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-base text-foreground mb-1">
            Hours by {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
          </h3>
          <p className="text-xs text-muted-foreground mb-5">
            {dateFrom && dateTo ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}` : 'All time'}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number) => [`${value} hrs`, 'Hours']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Summary Table ── */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
              <div className="flex-1"><div className="w-40 h-4 bg-muted/60 rounded animate-pulse mb-1.5" /><div className="w-24 h-3 bg-muted/40 rounded animate-pulse" /></div>
              <div className="w-16 h-4 bg-muted/50 rounded animate-pulse" />
              <div className="w-16 h-4 bg-muted/50 rounded animate-pulse hidden sm:block" />
              <div className="w-20 h-4 bg-muted/50 rounded animate-pulse hidden md:block" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── By Attorney ── */}
          {activeView === 'attorney' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Billable Hours by Attorney</h3>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">{attorneySummary.length} attorney{attorneySummary.length !== 1 ? 's' : ''} · {filteredLogs.length} entries</p>
                </div>
              </div>
              {attorneySummary.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No time logs found for the selected period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Attorney</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Hrs</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Billed</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Unbilled</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Amount</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attorneySummary.map((row, i) => {
                        const pct = kpis.totalHours > 0 ? (row.totalHours / kpis.totalHours) * 100 : 0;
                        return (
                          <tr key={row.attorney} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                                  {row.attorney.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{row.attorney}</p>
                                  <div className="mt-1 h-1.5 w-24 bg-muted/30 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-foreground">{row.totalHours.toFixed(1)}</td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell">
                              <span className="text-emerald-700 font-medium">{row.billedHours.toFixed(1)}</span>
                            </td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell">
                              <span className={row.unbilledHours > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>{row.unbilledHours.toFixed(1)}</span>
                            </td>
                            <td className="px-5 py-4 text-right hidden md:table-cell font-medium text-foreground">{row.totalAmount > 0 ? formatCurrency(row.totalAmount) : '—'}</td>
                            <td className="px-5 py-4 text-right hidden lg:table-cell text-muted-foreground">{row.logCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/20">
                        <td className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total</td>
                        <td className="px-5 py-3 text-right font-semibold text-foreground">{kpis.totalHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-emerald-700">{kpis.billedHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-amber-600">{kpis.unbilledHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden md:table-cell font-semibold text-foreground">{kpis.totalAmount > 0 ? formatCurrency(kpis.totalAmount) : '—'}</td>
                        <td className="px-5 py-3 text-right hidden lg:table-cell font-semibold text-foreground">{filteredLogs.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── By Client ── */}
          {activeView === 'client' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/60">
                <h3 className="text-sm font-semibold text-foreground">Billable Hours by Client</h3>
                <p className="text-xs text-muted-foreground font-light mt-0.5">{clientSummary.length} client{clientSummary.length !== 1 ? 's' : ''} · {filteredLogs.length} entries</p>
              </div>
              {clientSummary.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No time logs found for the selected period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Hrs</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Billed</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Unbilled</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Amount</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSummary.map((row, i) => {
                        const pct = kpis.totalHours > 0 ? (row.totalHours / kpis.totalHours) * 100 : 0;
                        return (
                          <tr key={row.clientEmail || row.clientName} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                                  {row.clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{row.clientName}</p>
                                  {row.clientEmail && <p className="text-xs text-muted-foreground font-light">{row.clientEmail}</p>}
                                  <div className="mt-1 h-1.5 w-24 bg-muted/30 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-foreground">{row.totalHours.toFixed(1)}</td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell"><span className="text-emerald-700 font-medium">{row.billedHours.toFixed(1)}</span></td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell"><span className={row.unbilledHours > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>{row.unbilledHours.toFixed(1)}</span></td>
                            <td className="px-5 py-4 text-right hidden md:table-cell font-medium text-foreground">{row.totalAmount > 0 ? formatCurrency(row.totalAmount) : '—'}</td>
                            <td className="px-5 py-4 text-right hidden lg:table-cell text-muted-foreground">{row.logCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/20">
                        <td className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total</td>
                        <td className="px-5 py-3 text-right font-semibold text-foreground">{kpis.totalHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-emerald-700">{kpis.billedHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-amber-600">{kpis.unbilledHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden md:table-cell font-semibold text-foreground">{kpis.totalAmount > 0 ? formatCurrency(kpis.totalAmount) : '—'}</td>
                        <td className="px-5 py-3 text-right hidden lg:table-cell font-semibold text-foreground">{filteredLogs.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── By Case ── */}
          {activeView === 'case' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/60">
                <h3 className="text-sm font-semibold text-foreground">Billable Hours by Case</h3>
                <p className="text-xs text-muted-foreground font-light mt-0.5">{caseSummary.length} case{caseSummary.length !== 1 ? 's' : ''} · {filteredLogs.length} entries</p>
              </div>
              {caseSummary.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No time logs found for the selected period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Case / Client</th>
                        <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Service</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Hrs</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Billed</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Unbilled</th>
                        <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseSummary.map((row, i) => {
                        const pct = kpis.totalHours > 0 ? (row.totalHours / kpis.totalHours) * 100 : 0;
                        return (
                          <tr key={row.caseId} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                <div>
                                  <p className="font-semibold text-foreground">{row.caseName}</p>
                                  <p className="text-xs text-muted-foreground font-light">{row.clientName}</p>
                                  <div className="mt-1 h-1.5 w-24 bg-muted/30 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell text-muted-foreground text-xs">{row.service}</td>
                            <td className="px-5 py-4 text-right font-semibold text-foreground">{row.totalHours.toFixed(1)}</td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell"><span className="text-emerald-700 font-medium">{row.billedHours.toFixed(1)}</span></td>
                            <td className="px-5 py-4 text-right hidden sm:table-cell"><span className={row.unbilledHours > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>{row.unbilledHours.toFixed(1)}</span></td>
                            <td className="px-5 py-4 text-right hidden md:table-cell font-medium text-foreground">{row.totalAmount > 0 ? formatCurrency(row.totalAmount) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/20">
                        <td className="px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground" colSpan={2}>Total</td>
                        <td className="px-5 py-3 text-right font-semibold text-foreground">{kpis.totalHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-emerald-700">{kpis.billedHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden sm:table-cell font-semibold text-amber-600">{kpis.unbilledHours.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right hidden md:table-cell font-semibold text-foreground">{kpis.totalAmount > 0 ? formatCurrency(kpis.totalAmount) : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Payroll Export Note ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/60">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-foreground">Payroll &amp; Billing Export</p>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            Use <strong>Export Summary</strong> for payroll summaries by attorney or billing summaries by client/case. Use <strong>Export Detail</strong> for a full line-item log suitable for billing software or payroll processing.
          </p>
        </div>
      </div>
    </div>
  );
}
