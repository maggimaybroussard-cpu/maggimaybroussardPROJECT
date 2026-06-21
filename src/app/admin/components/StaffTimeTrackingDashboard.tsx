'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface StaffMember {
  name: string;
  email: string;
  role: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  totalRevenue: number;
  avgHourlyRate: number;
  caseCount: number;
}

interface WeeklyTrend {
  week: string;
  billable: number;
  nonBillable: number;
}

const COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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

function exportToPDF(
  staff: StaffMember[],
  dateRange: string,
  totalBillable: number,
  totalNonBillable: number,
  totalRevenue: number,
  avgUtilization: number
) {
  const rows = staff.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.role}</td>
      <td>${s.billableHours.toFixed(1)}h</td>
      <td>${s.nonBillableHours.toFixed(1)}h</td>
      <td>${s.totalHours.toFixed(1)}h</td>
      <td>${Math.round(s.utilizationRate)}%</td>
      <td>${fmt(s.totalRevenue)}</td>
      <td>${fmt(s.avgHourlyRate)}/hr</td>
      <td>${s.caseCount}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Staff Utilization Report</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
  </style></head><body>
  <h1>Staff Utilization Report</h1>
  <p class="sub">Period: ${dateRange} · Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Billable Hours</div><div class="kpi-value">${totalBillable.toFixed(1)}h</div></div>
    <div class="kpi"><div class="kpi-label">Non-Billable</div><div class="kpi-value">${totalNonBillable.toFixed(1)}h</div></div>
    <div class="kpi"><div class="kpi-label">Revenue Generated</div><div class="kpi-value">${fmt(totalRevenue)}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Utilization</div><div class="kpi-value">${Math.round(avgUtilization)}%</div></div>
  </div>
  <table>
    <thead><tr><th>Staff Member</th><th>Role</th><th>Billable</th><th>Non-Billable</th><th>Total Hours</th><th>Utilization</th><th>Revenue</th><th>Avg Rate</th><th>Cases</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Broussard Legal Services</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

export default function StaffTimeTrackingDashboard() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const [logsRes, paralegalRes] = await Promise.all([
        supabase
          .from('retainer_time_logs').select('id, hours, hourly_rate, description, work_date, logged_by, inquiry_id, is_billable').gte('work_date', since.toISOString().split('T')[0])
          .order('work_date', { ascending: false }),
        supabase
          .from('paralegal_roster').select('id, name, email, role, hourly_rate'),
      ]);

      const logs = logsRes.data || [];
      const paralegals = paralegalRes.data || [];

      const staffMap = new Map<string, StaffMember>();

      for (const p of paralegals) {
        staffMap.set(p.name || p.email, {
          name: p.name || p.email,
          email: p.email || '',
          role: p.role || 'Paralegal',
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          utilizationRate: 0,
          totalRevenue: 0,
          avgHourlyRate: p.hourly_rate || 0,
          caseCount: 0,
        });
      }

      const casesByStaff = new Map<string, Set<string>>();

      for (const log of logs) {
        const key = log.logged_by || 'Unknown';
        if (!staffMap.has(key)) {
          staffMap.set(key, {
            name: key,
            email: '',
            role: 'Staff',
            totalHours: 0,
            billableHours: 0,
            nonBillableHours: 0,
            utilizationRate: 0,
            totalRevenue: 0,
            avgHourlyRate: log.hourly_rate || 0,
            caseCount: 0,
          });
        }
        const s = staffMap.get(key)!;
        const hours = Number(log.hours) || 0;
        const rate = Number(log.hourly_rate) || s.avgHourlyRate;
        const isBillable = log.is_billable !== false;

        s.totalHours += hours;
        if (isBillable) {
          s.billableHours += hours;
          s.totalRevenue += hours * rate;
        } else {
          s.nonBillableHours += hours;
        }

        if (log.inquiry_id) {
          if (!casesByStaff.has(key)) casesByStaff.set(key, new Set());
          casesByStaff.get(key)!.add(log.inquiry_id);
        }
      }

      for (const [key, s] of staffMap.entries()) {
        s.utilizationRate = s.totalHours > 0 ? (s.billableHours / s.totalHours) * 100 : 0;
        s.caseCount = casesByStaff.get(key)?.size || 0;
        if (s.billableHours > 0 && s.totalRevenue > 0) {
          s.avgHourlyRate = s.totalRevenue / s.billableHours;
        }
      }

      setStaff([...staffMap.values()].sort((a, b) => b.billableHours - a.billableHours));

      const weeks: WeeklyTrend[] = [];
      for (let w = 7; w >= 0; w--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - w * 7 - 6);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekLogs = logs.filter(l => {
          const d = new Date(l.work_date);
          return d >= weekStart && d <= weekEnd;
        });
        weeks.push({
          week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          billable: weekLogs.filter(l => l.is_billable !== false).reduce((s, l) => s + (Number(l.hours) || 0), 0),
          nonBillable: weekLogs.filter(l => l.is_billable === false).reduce((s, l) => s + (Number(l.hours) || 0), 0),
        });
      }
      setWeeklyTrend(weeks);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load time data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalBillable = staff.reduce((s, m) => s + m.billableHours, 0);
  const totalNonBillable = staff.reduce((s, m) => s + m.nonBillableHours, 0);
  const totalRevenue = staff.reduce((s, m) => s + m.totalRevenue, 0);
  const avgUtilization = staff.length > 0 ? staff.reduce((s, m) => s + m.utilizationRate, 0) / staff.length : 0;

  const pieData = [
    { name: 'Billable', value: totalBillable },
    { name: 'Non-Billable', value: totalNonBillable },
  ];

  const handleExportCSV = () => {
    exportToCSV(staff.map(s => ({
      'Staff Member': s.name,
      'Email': s.email,
      'Role': s.role,
      'Billable Hours': s.billableHours.toFixed(1),
      'Non-Billable Hours': s.nonBillableHours.toFixed(1),
      'Total Hours': s.totalHours.toFixed(1),
      'Utilization %': Math.round(s.utilizationRate),
      'Revenue Generated': s.totalRevenue.toFixed(2),
      'Avg Hourly Rate': s.avgHourlyRate.toFixed(2),
      'Cases': s.caseCount,
    })), `staff-utilization-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Staff Time Tracking</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Paralegal utilization, billable vs. non-billable hours, and productivity</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['7d', '30d', '90d'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dateRange === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{r}</button>
          ))}
          <button
            onClick={handleExportCSV}
            disabled={staff.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button
            onClick={() => exportToPDF(staff, dateRange, totalBillable, totalNonBillable, totalRevenue, avgUtilization)}
            disabled={staff.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            PDF
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Billable Hours', value: `${totalBillable.toFixed(1)}h`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Non-Billable', value: `${totalNonBillable.toFixed(1)}h`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Revenue Generated', value: fmt(totalRevenue), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Avg Utilization', value: `${Math.round(avgUtilization)}%`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-4">Weekly Hours Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="billable" name="Billable" fill="#355E3B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="nonBillable" name="Non-Billable" fill="#afd9ba" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center">
          <h3 className="font-serif text-lg text-foreground mb-4 self-start">Hours Split</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(1)}h`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-xs text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : staff.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">No time log data found for this period.</div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-serif text-lg text-foreground">Staff Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Staff Member</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Billable</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Non-Billable</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Utilization</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Revenue</th>
                  <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Cases</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => (
                  <tr
                    key={s.name}
                    onClick={() => setSelectedStaff(selectedStaff?.name === s.name ? null : s)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-all ${selectedStaff?.name === s.name ? 'bg-primary/5' : i % 2 === 0 ? 'hover:bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/20'}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.role}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{s.billableHours.toFixed(1)}h</td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground hidden sm:table-cell">{s.nonBillableHours.toFixed(1)}h</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(s.utilizationRate, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground w-8">{Math.round(s.utilizationRate)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-foreground hidden md:table-cell">{fmt(s.totalRevenue)}</td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground hidden lg:table-cell">{s.caseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
