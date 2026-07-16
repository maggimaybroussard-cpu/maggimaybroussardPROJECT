'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend, Cell,
} from 'recharts';

interface MatterProfit {
  inquiryId: string;
  matterName: string;
  clientEmail: string;
  service: string;
  totalBilled: number;
  totalPaid: number;
  billableHours: number;
  writeOffHours: number;
  totalHours: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  collectionRate: number;
  revenuePerHour: number;
  status: string;
  profitTier: 'high' | 'mid' | 'low' | 'loss';
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
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
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(matters: MatterProfit[], totalBilled: number, totalPaid: number, totalProfit: number, avgMargin: number) {
  const rows = matters.map(m => `
    <tr>
      <td>${m.matterName}</td>
      <td>${m.service || '—'}</td>
      <td>${m.clientEmail}</td>
      <td>${fmt(m.totalBilled)}</td>
      <td>${fmt(m.totalPaid)}</td>
      <td>${fmt(m.grossProfit)}</td>
      <td>${fmtPct(m.profitMargin)}</td>
      <td>${fmtPct(m.collectionRate)}</td>
      <td>${m.billableHours.toFixed(1)}h</td>
      <td>${m.writeOffHours.toFixed(1)}h</td>
      <td>${fmt(m.revenuePerHour)}/hr</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Matter Profitability Report</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
  </style></head><body>
  <h1>Matter Profitability Report</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Total Billed</div><div class="kpi-value">${fmt(totalBilled)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Collected</div><div class="kpi-value">${fmt(totalPaid)}</div></div>
    <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value">${fmt(totalProfit)}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Margin</div><div class="kpi-value">${fmtPct(avgMargin)}</div></div>
  </div>
  <table>
    <thead><tr><th>Matter</th><th>Service</th><th>Client</th><th>Billed</th><th>Collected</th><th>Profit</th><th>Margin</th><th>Collection %</th><th>Billable Hrs</th><th>Write-Off Hrs</th><th>Rev/Hr</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Profit = Collected − Overhead Cost ($75/hr) · Write-Off Hours = Logged hours not billed · Broussard Legal Services</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

function ProfitTierBadge({ tier }: { tier: MatterProfit['profitTier'] }) {
  const config = {
    high: { label: 'High Profit', cls: 'bg-green-100 text-green-700 border-green-200' },
    mid: { label: 'Mid Profit', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    low: { label: 'Low Profit', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    loss: { label: 'Loss', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const c = config[tier];
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>
  );
}

function MarginBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min((value / max) * 100, 100));
  const color = value >= 50 ? 'bg-green-500' : value >= 25 ? 'bg-amber-500' : value >= 0 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{fmtPct(value)}</span>
    </div>
  );
}

export default function MatterProfitabilityReport() {
  const [matters, setMatters] = useState<MatterProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'profit' | 'billed' | 'margin' | 'revPerHour' | 'writeOff'>('profit');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'mid' | 'low' | 'loss'>('all');
  const [services, setServices] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'table' | 'chart' | 'capacity'>('table');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [invoicesRes, logsRes] = await Promise.all([
        supabase
          .from('client_invoices')
          .select('id, inquiry_id, amount, amount_paid, status, contact_inquiries(id, name, email, service, status)')
          .not('inquiry_id', 'is', null),
        supabase.from('retainer_time_logs').select('inquiry_id, hours, hourly_rate, billable'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;

      const invoices = invoicesRes.data || [];
      const logs = logsRes.data || [];

      const map = new Map<string, MatterProfit>();

      for (const inv of invoices) {
        if (!inv.inquiry_id) continue;
        const ci = inv.contact_inquiries as { id: string; name: string; email: string; service: string; status: string } | null;
        if (!ci) continue;

        if (!map.has(inv.inquiry_id)) {
          map.set(inv.inquiry_id, {
            inquiryId: inv.inquiry_id,
            matterName: ci.name,
            clientEmail: ci.email,
            service: ci.service,
            totalBilled: 0,
            totalPaid: 0,
            billableHours: 0,
            writeOffHours: 0,
            totalHours: 0,
            totalCost: 0,
            grossProfit: 0,
            profitMargin: 0,
            collectionRate: 0,
            revenuePerHour: 0,
            status: ci.status,
            profitTier: 'mid',
          });
        }
        const m = map.get(inv.inquiry_id)!;
        m.totalBilled += Number(inv.amount) || 0;
        m.totalPaid += Number(inv.amount_paid) || 0;
      }

      const OVERHEAD_RATE = 75;
      for (const log of logs) {
        if (!log.inquiry_id) continue;
        const m = map.get(log.inquiry_id);
        if (m) {
          const hrs = Number(log.hours) || 0;
          // If billable field exists and is false, treat as write-off; otherwise billable
          const isBillable = log.billable !== false;
          if (isBillable) {
            m.billableHours += hrs;
          } else {
            m.writeOffHours += hrs;
          }
          m.totalHours += hrs;
          m.totalCost += hrs * OVERHEAD_RATE;
        }
      }

      const result: MatterProfit[] = [];
      for (const m of map.values()) {
        m.grossProfit = m.totalPaid - m.totalCost;
        m.profitMargin = m.totalPaid > 0 ? (m.grossProfit / m.totalPaid) * 100 : 0;
        m.collectionRate = m.totalBilled > 0 ? (m.totalPaid / m.totalBilled) * 100 : 0;
        m.revenuePerHour = m.totalHours > 0 ? m.totalPaid / m.totalHours : 0;
        // Tier classification
        if (m.profitMargin >= 50) m.profitTier = 'high';
        else if (m.profitMargin >= 25) m.profitTier = 'mid';
        else if (m.profitMargin >= 0) m.profitTier = 'low';
        else m.profitTier = 'loss';
        result.push(m);
      }

      const uniqueServices = [...new Set(result.map(m => m.service).filter(Boolean))];
      setServices(uniqueServices);
      setMatters(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profitability data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = matters
    .filter(m => serviceFilter === 'all' || m.service === serviceFilter)
    .filter(m => tierFilter === 'all' || m.profitTier === tierFilter)
    .sort((a, b) => {
      if (sortBy === 'profit') return b.grossProfit - a.grossProfit;
      if (sortBy === 'billed') return b.totalBilled - a.totalBilled;
      if (sortBy === 'margin') return b.profitMargin - a.profitMargin;
      if (sortBy === 'revPerHour') return b.revenuePerHour - a.revenuePerHour;
      if (sortBy === 'writeOff') return b.writeOffHours - a.writeOffHours;
      return b.grossProfit - a.grossProfit;
    });

  const totalBilled = filtered.reduce((s, m) => s + m.totalBilled, 0);
  const totalPaid = filtered.reduce((s, m) => s + m.totalPaid, 0);
  const totalProfit = filtered.reduce((s, m) => s + m.grossProfit, 0);
  const avgMargin = filtered.length > 0 ? filtered.reduce((s, m) => s + m.profitMargin, 0) / filtered.length : 0;
  const totalBillableHours = filtered.reduce((s, m) => s + m.billableHours, 0);
  const totalWriteOffHours = filtered.reduce((s, m) => s + m.writeOffHours, 0);
  const totalHours = totalBillableHours + totalWriteOffHours;
  const writeOffRate = totalHours > 0 ? (totalWriteOffHours / totalHours) * 100 : 0;
  const avgRevPerHour = filtered.length > 0 ? filtered.reduce((s, m) => s + m.revenuePerHour, 0) / filtered.filter(m => m.totalHours > 0).length : 0;

  const highProfit = filtered.filter(m => m.profitTier === 'high');
  const lowProfit = filtered.filter(m => m.profitTier === 'low' || m.profitTier === 'loss');

  const barChartData = filtered.slice(0, 10).map(m => ({
    name: m.matterName.split(' ').slice(0, 2).join(' '),
    billed: m.totalBilled,
    paid: m.totalPaid,
    profit: Math.max(0, m.grossProfit),
    loss: Math.min(0, m.grossProfit),
  }));

  const hoursChartData = filtered.filter(m => m.totalHours > 0).slice(0, 10).map(m => ({
    name: m.matterName.split(' ').slice(0, 2).join(' '),
    billable: m.billableHours,
    writeOff: m.writeOffHours,
    revPerHour: Math.round(m.revenuePerHour),
  }));

  const scatterData = filtered.filter(m => m.totalHours > 0).map(m => ({
    x: m.totalHours,
    y: m.totalPaid,
    z: Math.abs(m.grossProfit) + 1000,
    name: m.matterName,
    tier: m.profitTier,
    margin: m.profitMargin,
  }));

  const TIER_COLORS: Record<string, string> = {
    high: '#16a34a',
    mid: '#d97706',
    low: '#ea580c',
    loss: '#dc2626',
  };

  const handleExportCSV = () => {
    exportToCSV(filtered.map(m => ({
      'Matter': m.matterName,
      'Service': m.service || '',
      'Client Email': m.clientEmail,
      'Status': m.status,
      'Profit Tier': m.profitTier,
      'Total Billed': m.totalBilled.toFixed(2),
      'Total Collected': m.totalPaid.toFixed(2),
      'Billable Hours': m.billableHours.toFixed(1),
      'Write-Off Hours': m.writeOffHours.toFixed(1),
      'Total Hours': m.totalHours.toFixed(1),
      'Revenue Per Hour': m.revenuePerHour.toFixed(2),
      'Overhead Cost': m.totalCost.toFixed(2),
      'Gross Profit': m.grossProfit.toFixed(2),
      'Profit Margin %': m.profitMargin.toFixed(1),
      'Collection Rate %': m.collectionRate.toFixed(1),
    })), `matter-profitability-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Matter Profitability</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue vs. time spent — margin %, billable vs. write-off hours, capacity reallocation</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button
            onClick={() => exportToPDF(filtered, totalBilled, totalPaid, totalProfit, avgMargin)}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            PDF
          </button>
          <button onClick={fetchData} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row — 8 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Billed', value: fmt(totalBilled), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Total Collected', value: fmt(totalPaid), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Gross Profit', value: fmt(totalProfit), color: totalProfit >= 0 ? 'text-green-700' : 'text-red-700', bg: totalProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' },
          { label: 'Avg Margin', value: fmtPct(avgMargin), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'Billable Hours', value: `${totalBillableHours.toFixed(1)}h`, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
          { label: 'Write-Off Hours', value: `${totalWriteOffHours.toFixed(1)}h`, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
          { label: 'Write-Off Rate', value: fmtPct(writeOffRate), color: writeOffRate > 20 ? 'text-red-700' : 'text-amber-700', bg: writeOffRate > 20 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200' },
          { label: 'Avg Rev / Hour', value: fmt(avgRevPerHour), color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{k.label}</p>
            <p className={`text-xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
        {(['table', 'chart', 'capacity'] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeView === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {v === 'capacity' ? 'Capacity & Pricing' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Services</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value as typeof tierFilter)} className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Tiers</option>
          <option value="high">High Profit (≥50%)</option>
          <option value="mid">Mid Profit (25–49%)</option>
          <option value="low">Low Profit (0–24%)</option>
          <option value="loss">Loss (&lt;0%)</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="profit">Sort by Profit</option>
          <option value="billed">Sort by Billed</option>
          <option value="margin">Sort by Margin %</option>
          <option value="revPerHour">Sort by Rev/Hour</option>
          <option value="writeOff">Sort by Write-Off Hours</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">No matter data available yet.</div>
      ) : (
        <>
          {/* TABLE VIEW */}
          {activeView === 'table' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Matter / Client</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Billed</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Collected</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Profit</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell" style={{minWidth: 140}}>Margin %</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell" style={{minWidth: 160}}>Billable / Write-Off</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Rev/Hr</th>
                      <th className="text-center px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden xl:table-cell">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => (
                      <tr key={m.inquiryId} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{m.matterName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.service} · {m.clientEmail}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell text-foreground">{fmt(m.totalBilled)}</td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell text-emerald-700 font-medium">{fmt(m.totalPaid)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-semibold ${m.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(m.grossProfit)}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell" style={{minWidth: 140}}>
                          <MarginBar value={m.profitMargin} />
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell" style={{minWidth: 160}}>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-teal-700 font-medium">{m.billableHours.toFixed(1)}h</span>
                            <span className="text-muted-foreground">billable</span>
                            {m.writeOffHours > 0 && (
                              <>
                                <span className="text-muted-foreground mx-1">·</span>
                                <span className="text-rose-600 font-medium">{m.writeOffHours.toFixed(1)}h</span>
                                <span className="text-muted-foreground">w/o</span>
                              </>
                            )}
                          </div>
                          {m.totalHours > 0 && (
                            <div className="mt-1 flex gap-0.5 h-1.5 rounded-full overflow-hidden w-24">
                              <div className="bg-teal-500 rounded-l-full" style={{ width: `${(m.billableHours / m.totalHours) * 100}%` }} />
                              <div className="bg-rose-400 rounded-r-full" style={{ width: `${(m.writeOffHours / m.totalHours) * 100}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right hidden lg:table-cell text-muted-foreground text-xs font-medium">
                          {m.revenuePerHour > 0 ? `${fmt(m.revenuePerHour)}/hr` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center hidden xl:table-cell">
                          <ProfitTierBadge tier={m.profitTier} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground flex flex-wrap gap-4">
                <span>{filtered.length} matter{filtered.length !== 1 ? 's' : ''}</span>
                <span>Profit = Collected − Overhead ($75/hr)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" /> Billable</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Write-Off</span>
              </div>
            </div>
          )}

          {/* CHART VIEW */}
          {activeView === 'chart' && (
            <div className="space-y-6">
              {/* Revenue vs Profit Bar Chart */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-serif text-lg text-foreground mb-1">Revenue vs. Profit by Matter</h3>
                <p className="text-xs text-muted-foreground mb-4">Top 10 matters — billed, collected, and gross profit</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barChartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="billed" name="Billed" fill="#355E3B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Collected" fill="#4a7c59" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#8dbf9a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Billable vs Write-Off Hours */}
              {hoursChartData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-serif text-lg text-foreground mb-1">Billable vs. Write-Off Hours</h3>
                  <p className="text-xs text-muted-foreground mb-4">Stacked hours per matter — teal = billable, rose = write-off</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={hoursChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}h`} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(v: number, name: string) => [`${v.toFixed(1)}h`, name]} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="billable" name="Billable Hours" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="writeOff" name="Write-Off Hours" stackId="a" fill="#fb7185" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Revenue per Hour Scatter */}
              {scatterData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-serif text-lg text-foreground mb-1">Hours Invested vs. Revenue Collected</h3>
                  <p className="text-xs text-muted-foreground mb-4">Bubble size = profit magnitude · Color = profitability tier</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="x" name="Hours" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} label={{ value: 'Total Hours', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <YAxis dataKey="y" name="Revenue" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <ZAxis dataKey="z" range={[60, 400]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div className="p-3 space-y-1">
                              <p className="font-semibold text-foreground text-xs">{d.name}</p>
                              <p className="text-xs text-muted-foreground">{d.x.toFixed(1)}h · {fmt(d.y)} · {fmtPct(d.margin)} margin</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData} name="Matters">
                        {scatterData.map((entry, index) => (
                          <Cell key={index} fill={TIER_COLORS[entry.tier] || '#888'} fillOpacity={0.8} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-3 flex-wrap">
                    {Object.entries(TIER_COLORS).map(([tier, color]) => (
                      <span key={tier} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                        {tier === 'high' ? 'High (≥50%)' : tier === 'mid' ? 'Mid (25–49%)' : tier === 'low' ? 'Low (0–24%)' : 'Loss (<0%)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAPACITY & PRICING VIEW */}
          {activeView === 'capacity' && (
            <div className="space-y-6">
              {/* High Profitability — Expand */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">High-Profitability Matters — Prioritize &amp; Scale</h3>
                    <p className="text-xs text-muted-foreground">Margin ≥ 50% · {highProfit.length} matter{highProfit.length !== 1 ? 's' : ''} · Allocate more capacity here</p>
                  </div>
                </div>
                {highProfit.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground text-center">No high-profitability matters in current filter.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {highProfit.map(m => (
                      <div key={m.inquiryId} className="px-5 py-4 flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{m.matterName}</p>
                          <p className="text-xs text-muted-foreground">{m.service}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs">
                          <div className="text-center">
                            <p className="text-muted-foreground">Margin</p>
                            <p className="font-semibold text-green-700">{fmtPct(m.profitMargin)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Rev/Hr</p>
                            <p className="font-semibold text-foreground">{m.revenuePerHour > 0 ? `${fmt(m.revenuePerHour)}` : '—'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Billable</p>
                            <p className="font-semibold text-teal-700">{m.billableHours.toFixed(1)}h</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Write-Off</p>
                            <p className={`font-semibold ${m.writeOffHours > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{m.writeOffHours.toFixed(1)}h</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Profit</p>
                            <p className="font-semibold text-green-700">{fmt(m.grossProfit)}</p>
                          </div>
                        </div>
                        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-medium">
                          ↑ Expand capacity
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Profitability — Review */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Low-Profitability &amp; Loss Matters — Review Pricing</h3>
                    <p className="text-xs text-muted-foreground">Margin &lt; 25% · {lowProfit.length} matter{lowProfit.length !== 1 ? 's' : ''} · Consider rate adjustments or scope reduction</p>
                  </div>
                </div>
                {lowProfit.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-muted-foreground text-center">No low-profitability matters in current filter.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {lowProfit.map(m => {
                      const writeOffPct = m.totalHours > 0 ? (m.writeOffHours / m.totalHours) * 100 : 0;
                      const suggestedRate = m.totalHours > 0 ? (m.totalCost / m.totalHours) * 1.5 : 0;
                      return (
                        <div key={m.inquiryId} className="px-5 py-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-foreground text-sm">{m.matterName}</p>
                                <ProfitTierBadge tier={m.profitTier} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{m.service}</p>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs">
                              <div className="text-center">
                                <p className="text-muted-foreground">Margin</p>
                                <p className={`font-semibold ${m.profitMargin < 0 ? 'text-red-600' : 'text-orange-600'}`}>{fmtPct(m.profitMargin)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">Write-Off</p>
                                <p className="font-semibold text-rose-600">{m.writeOffHours.toFixed(1)}h ({fmtPct(writeOffPct)})</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">Rev/Hr</p>
                                <p className="font-semibold text-foreground">{m.revenuePerHour > 0 ? fmt(m.revenuePerHour) : '—'}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">Profit/Loss</p>
                                <p className={`font-semibold ${m.grossProfit < 0 ? 'text-red-600' : 'text-orange-600'}`}>{fmt(m.grossProfit)}</p>
                              </div>
                            </div>
                          </div>
                          {/* Recommendations */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {writeOffPct > 20 && (
                              <span className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-2.5 py-1">
                                ⚠ High write-off rate ({fmtPct(writeOffPct)}) — review scope creep
                              </span>
                            )}
                            {m.profitMargin < 0 && (
                              <span className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-2.5 py-1">
                                ✕ Operating at a loss — immediate pricing review needed
                              </span>
                            )}
                            {suggestedRate > 0 && m.profitMargin < 25 && (
                              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1">
                                💡 Suggested rate: {fmt(suggestedRate)}/hr to achieve 50% margin
                              </span>
                            )}
                            {m.collectionRate < 80 && (
                              <span className="text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded-lg px-2.5 py-1">
                                ↓ Collection rate {fmtPct(m.collectionRate)} — follow up on outstanding balance
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pricing Summary */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">Pricing &amp; Capacity Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">High Profit</p>
                    <p className="text-2xl font-bold text-green-700">{highProfit.length}</p>
                    <p className="text-muted-foreground mt-0.5">matters to scale</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Low / Loss</p>
                    <p className="text-2xl font-bold text-red-700">{lowProfit.length}</p>
                    <p className="text-muted-foreground mt-0.5">matters to reprice</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Write-Off Rate</p>
                    <p className={`text-2xl font-bold ${writeOffRate > 20 ? 'text-red-700' : 'text-amber-700'}`}>{fmtPct(writeOffRate)}</p>
                    <p className="text-muted-foreground mt-0.5">{totalWriteOffHours.toFixed(1)}h lost</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <p className="text-muted-foreground uppercase tracking-widest font-semibold mb-1">Avg Rev/Hr</p>
                    <p className="text-2xl font-bold text-indigo-700">{fmt(avgRevPerHour)}</p>
                    <p className="text-muted-foreground mt-0.5">across all matters</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
