'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatterAllocation {
  matterId: string;
  matterName: string;
  clientName: string;
  serviceType: string;
  totalBillableHours: number;
  totalAmount: number;
  staffCount: number;
  avgRate: number;
  standardRate: number;
  rateMismatch: boolean;
  rateMismatchPct: number;
}

interface StaffAllocation {
  name: string;
  email: string;
  totalHours: number;
  billableHours: number;
  matterCount: number;
  totalRevenue: number;
  avgRate: number;
  utilizationPct: number;
  status: 'over' | 'under' | 'optimal';
}

interface RateDistribution {
  range: string;
  count: number;
  hours: number;
  revenue: number;
}

interface HourlyRate {
  service_type: string;
  rate_per_hour: number;
}

const COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d4edda', '#a8d5b5'];
const STATUS_COLORS = { over: '#dc2626', under: '#d97706', optimal: '#16a34a' };

const TARGET_UTILIZATION = 75; // % — optimal target
const OVER_THRESHOLD = 90;
const UNDER_THRESHOLD = 50;

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? '').replace(/"/g, '""');
        return v.includes(',') || v.includes('"') ? `"${v}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillableHoursAllocationDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [matters, setMatters] = useState<MatterAllocation[]>([]);
  const [staff, setStaff] = useState<StaffAllocation[]>([]);
  const [rateDistribution, setRateDistribution] = useState<RateDistribution[]>([]);
  const [standardRates, setStandardRates] = useState<HourlyRate[]>([]);
  const [activeView, setActiveView] = useState<'overview' | 'matters' | 'staff' | 'rates'>('overview');
  const [dateRange, setDateRange] = useState('30');
  const [mismatchOnly, setMismatchOnly] = useState(false);

  // KPI totals
  const [kpis, setKpis] = useState({
    totalBillableHours: 0,
    totalRevenue: 0,
    avgUtilization: 0,
    activeMatters: 0,
    overAllocated: 0,
    underAllocated: 0,
    rateMismatches: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(dateRange));
      const sinceStr = since.toISOString().split('T')[0];

      // Load standard rates
      const { data: ratesData } = await supabase
        .from('billing_hourly_rates')
        .select('service_type, rate_per_hour')
        .eq('is_active', true);
      const rates: HourlyRate[] = ratesData ?? [];
      setStandardRates(rates);
      const rateMap: Record<string, number> = {};
      rates.forEach(r => { rateMap[r.service_type] = r.rate_per_hour; });

      // Load billable hours with case info
      const { data: hoursData } = await supabase
        .from('paralegal_billable_hours')
        .select(`
          id, paralegal_name, paralegal_email, task_type,
          duration_hours, hourly_rate, total_amount, work_date,
          billing_status,
          inquiry_id,
          contact_inquiries (
            id, name, firm, service
          )
        `)
        .gte('work_date', sinceStr)
        .order('work_date', { ascending: false });

      const hours = hoursData ?? [];

      // ── Build matter allocations ──────────────────────────────────────────
      const matterMap: Record<string, {
        matterName: string; clientName: string; serviceType: string;
        totalHours: number; totalAmount: number; staffSet: Set<string>;
        rateSum: number; rateCount: number;
      }> = {};

      hours.forEach((h: Record<string, unknown>) => {
        const inq = h.contact_inquiries as { id: string; name: string; firm: string; service: string } | null;
        const key = (inq?.id ?? 'unknown') as string;
        if (!matterMap[key]) {
          matterMap[key] = {
            matterName: inq?.firm ?? 'Unknown Matter',
            clientName: inq?.name ?? 'Unknown Client',
            serviceType: inq?.service ?? 'General',
            totalHours: 0, totalAmount: 0,
            staffSet: new Set(), rateSum: 0, rateCount: 0,
          };
        }
        const m = matterMap[key];
        m.totalHours += Number(h.duration_hours ?? 0);
        m.totalAmount += Number(h.total_amount ?? 0);
        m.staffSet.add(h.paralegal_email as string);
        m.rateSum += Number(h.hourly_rate ?? 0);
        m.rateCount += 1;
      });

      const matterList: MatterAllocation[] = Object.entries(matterMap).map(([id, m]) => {
        const avgRate = m.rateCount > 0 ? m.rateSum / m.rateCount : 0;
        const stdRate = rateMap[m.serviceType] ?? 0;
        const mismatchPct = stdRate > 0 ? Math.abs((avgRate - stdRate) / stdRate) * 100 : 0;
        return {
          matterId: id,
          matterName: m.matterName,
          clientName: m.clientName,
          serviceType: m.serviceType,
          totalBillableHours: m.totalHours,
          totalAmount: m.totalAmount,
          staffCount: m.staffSet.size,
          avgRate,
          standardRate: stdRate,
          rateMismatch: mismatchPct > 10,
          rateMismatchPct: mismatchPct,
        };
      }).sort((a, b) => b.totalBillableHours - a.totalBillableHours);

      setMatters(matterList);

      // ── Build staff allocations ───────────────────────────────────────────
      const staffMap: Record<string, {
        name: string; email: string; totalHours: number;
        matterSet: Set<string>; totalRevenue: number; rateSum: number; rateCount: number;
      }> = {};

      hours.forEach((h: Record<string, unknown>) => {
        const email = (h.paralegal_email as string) ?? 'unknown';
        if (!staffMap[email]) {
          staffMap[email] = {
            name: h.paralegal_name as string ?? email,
            email,
            totalHours: 0, matterSet: new Set(),
            totalRevenue: 0, rateSum: 0, rateCount: 0,
          };
        }
        const s = staffMap[email];
        s.totalHours += Number(h.duration_hours ?? 0);
        s.totalRevenue += Number(h.total_amount ?? 0);
        s.rateSum += Number(h.hourly_rate ?? 0);
        s.rateCount += 1;
        if (h.inquiry_id) s.matterSet.add(h.inquiry_id as string);
      });

      // Assume 8h/day * working days in range as capacity
      const workingDays = Math.round(parseInt(dateRange) * 5 / 7);
      const capacityHours = workingDays * 8;

      const staffList: StaffAllocation[] = Object.values(staffMap).map(s => {
        const utilizationPct = capacityHours > 0 ? (s.totalHours / capacityHours) * 100 : 0;
        const status: 'over' | 'under' | 'optimal' =
          utilizationPct >= OVER_THRESHOLD ? 'over' :
          utilizationPct <= UNDER_THRESHOLD ? 'under' : 'optimal';
        return {
          name: s.name,
          email: s.email,
          totalHours: s.totalHours,
          billableHours: s.totalHours,
          matterCount: s.matterSet.size,
          totalRevenue: s.totalRevenue,
          avgRate: s.rateCount > 0 ? s.rateSum / s.rateCount : 0,
          utilizationPct,
          status,
        };
      }).sort((a, b) => b.utilizationPct - a.utilizationPct);

      setStaff(staffList);

      // ── Rate distribution buckets ─────────────────────────────────────────
      const buckets: Record<string, { count: number; hours: number; revenue: number }> = {
        '< $100': { count: 0, hours: 0, revenue: 0 },
        '$100–$150': { count: 0, hours: 0, revenue: 0 },
        '$150–$200': { count: 0, hours: 0, revenue: 0 },
        '$200–$300': { count: 0, hours: 0, revenue: 0 },
        '$300–$400': { count: 0, hours: 0, revenue: 0 },
        '> $400': { count: 0, hours: 0, revenue: 0 },
      };

      hours.forEach((h: Record<string, unknown>) => {
        const rate = Number(h.hourly_rate ?? 0);
        const hrs = Number(h.duration_hours ?? 0);
        const rev = Number(h.total_amount ?? 0);
        let bucket = '> $400';
        if (rate < 100) bucket = '< $100';
        else if (rate < 150) bucket = '$100–$150';
        else if (rate < 200) bucket = '$150–$200';
        else if (rate < 300) bucket = '$200–$300';
        else if (rate < 400) bucket = '$300–$400';
        buckets[bucket].count += 1;
        buckets[bucket].hours += hrs;
        buckets[bucket].revenue += rev;
      });

      setRateDistribution(
        Object.entries(buckets).map(([range, v]) => ({ range, ...v }))
      );

      // ── KPIs ──────────────────────────────────────────────────────────────
      const totalBillableHours = hours.reduce((s: number, h: Record<string, unknown>) => s + Number(h.duration_hours ?? 0), 0);
      const totalRevenue = hours.reduce((s: number, h: Record<string, unknown>) => s + Number(h.total_amount ?? 0), 0);
      const avgUtil = staffList.length > 0
        ? staffList.reduce((s, st) => s + st.utilizationPct, 0) / staffList.length
        : 0;

      setKpis({
        totalBillableHours,
        totalRevenue,
        avgUtilization: avgUtil,
        activeMatters: matterList.length,
        overAllocated: staffList.filter(s => s.status === 'over').length,
        underAllocated: staffList.filter(s => s.status === 'under').length,
        rateMismatches: matterList.filter(m => m.rateMismatch).length,
      });

    } catch (err) {
      console.error('BillableHoursAllocationDashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered views ────────────────────────────────────────────────────────
  const displayedMatters = mismatchOnly ? matters.filter(m => m.rateMismatch) : matters;
  const overStaff = staff.filter(s => s.status === 'over');
  const underStaff = staff.filter(s => s.status === 'under');
  const optimalStaff = staff.filter(s => s.status === 'optimal');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Billable Hours Allocation</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Utilization, rate distribution, and staff allocation across active matters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={() => exportCSV(
              staff.map(s => ({
                Name: s.name, Email: s.email,
                'Billable Hours': s.billableHours.toFixed(1),
                'Utilization %': Math.round(s.utilizationPct),
                'Avg Rate': s.avgRate.toFixed(2),
                'Revenue': s.totalRevenue.toFixed(2),
                Status: s.status,
              })),
              `staff-allocation-${dateRange}d.csv`
            )}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Billable Hours', value: `${kpis.totalBillableHours.toFixed(0)}h`, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Revenue', value: fmt(kpis.totalRevenue), color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Avg Utilization', value: `${Math.round(kpis.avgUtilization)}%`, color: kpis.avgUtilization >= TARGET_UTILIZATION ? 'text-green-700' : 'text-amber-700', bg: kpis.avgUtilization >= TARGET_UTILIZATION ? 'bg-green-50' : 'bg-amber-50' },
          { label: 'Active Matters', value: String(kpis.activeMatters), color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Over-Allocated', value: String(kpis.overAllocated), color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Under-Allocated', value: String(kpis.underAllocated), color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Rate Mismatches', value: String(kpis.rateMismatches), color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-3 flex flex-col gap-1`}>
            <span className="text-xs text-gray-500 font-medium">{k.label}</span>
            <span className={`text-lg font-bold ${k.color}`}>{loading ? '—' : k.value}</span>
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overview', 'matters', 'staff', 'rates'] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeView === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'rates' ? 'Rate Distribution' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Loading allocation data…
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {activeView === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Utilization bar chart */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff Utilization %</h3>
                {staff.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={staff.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Utilization']} />
                      <Bar dataKey="utilizationPct" radius={[0, 4, 4, 0]}>
                        {staff.slice(0, 10).map((s, i) => (
                          <Cell key={i} fill={STATUS_COLORS[s.status]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex gap-4 mt-2 justify-center">
                  {(['over', 'optimal', 'under'] as const).map(s => (
                    <span key={s} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[s] }} />
                      {s === 'over' ? 'Over-allocated' : s === 'under' ? 'Under-allocated' : 'Optimal'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Billable hours by matter */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Billable Hours by Matter (Top 8)</h3>
                {matters.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={matters.slice(0, 8)} margin={{ left: 0, right: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="matterName" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Billable Hours']} />
                      <Bar dataKey="totalBillableHours" fill="#355E3B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Recommendations */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Allocation Recommendations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Over-allocated */}
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Over-Allocated ({overStaff.length})</p>
                    {overStaff.length === 0 ? (
                      <p className="text-xs text-gray-400">None — great balance!</p>
                    ) : overStaff.map(s => (
                      <div key={s.email} className="mb-2">
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        <p className="text-xs text-red-600">{Math.round(s.utilizationPct)}% utilization · {s.billableHours.toFixed(0)}h logged</p>
                        <p className="text-xs text-gray-500 mt-0.5">Recommend redistributing {Math.round(s.billableHours - (OVER_THRESHOLD / 100) * (parseInt(dateRange) * 5 / 7) * 8)}h to under-allocated staff</p>
                      </div>
                    ))}
                  </div>
                  {/* Under-allocated */}
                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Under-Allocated ({underStaff.length})</p>
                    {underStaff.length === 0 ? (
                      <p className="text-xs text-gray-400">None — all staff engaged!</p>
                    ) : underStaff.map(s => (
                      <div key={s.email} className="mb-2">
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        <p className="text-xs text-amber-600">{Math.round(s.utilizationPct)}% utilization · {s.billableHours.toFixed(0)}h logged</p>
                        <p className="text-xs text-gray-500 mt-0.5">Available capacity: ~{Math.round(((TARGET_UTILIZATION / 100) * (parseInt(dateRange) * 5 / 7) * 8) - s.billableHours)}h more</p>
                      </div>
                    ))}
                  </div>
                  {/* Rate mismatches */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Rate Mismatches ({kpis.rateMismatches})</p>
                    {kpis.rateMismatches === 0 ? (
                      <p className="text-xs text-gray-400">All rates aligned with standards</p>
                    ) : matters.filter(m => m.rateMismatch).slice(0, 4).map(m => (
                      <div key={m.matterId} className="mb-2">
                        <p className="text-sm font-medium text-gray-800">{m.matterName}</p>
                        <p className="text-xs text-orange-600">
                          Avg {fmt(m.avgRate)}/hr vs standard {fmt(m.standardRate)}/hr
                          {' '}({m.rateMismatchPct > 0 ? '+' : ''}{Math.round(m.rateMismatchPct)}% off)
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.serviceType}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MATTERS ── */}
          {activeView === 'matters' && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Active Matters — Billable Hours</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mismatchOnly}
                    onChange={e => setMismatchOnly(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Rate mismatches only
                </label>
              </div>
              {displayedMatters.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No matters found for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3 font-medium">Matter / Client</th>
                        <th className="text-left px-4 py-3 font-medium">Service</th>
                        <th className="text-right px-4 py-3 font-medium">Billable Hrs</th>
                        <th className="text-right px-4 py-3 font-medium">Revenue</th>
                        <th className="text-right px-4 py-3 font-medium">Avg Rate</th>
                        <th className="text-right px-4 py-3 font-medium">Std Rate</th>
                        <th className="text-center px-4 py-3 font-medium">Staff</th>
                        <th className="text-center px-4 py-3 font-medium">Rate Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayedMatters.map(m => (
                        <tr key={m.matterId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">{m.matterName}</p>
                            <p className="text-xs text-gray-400">{m.clientName}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.serviceType}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{m.totalBillableHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(m.totalAmount)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(m.avgRate)}/hr</td>
                          <td className="px-4 py-3 text-right text-gray-500">{m.standardRate > 0 ? `${fmt(m.standardRate)}/hr` : '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{m.staffCount}</td>
                          <td className="px-4 py-3 text-center">
                            {m.rateMismatch ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                ⚠ {Math.round(m.rateMismatchPct)}% off
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                ✓ Aligned
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── STAFF ── */}
          {activeView === 'staff' && (
            <div className="space-y-4">
              {/* Optimal target note */}
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Target utilization: <strong>{TARGET_UTILIZATION}%</strong> · Over-allocated: &gt;{OVER_THRESHOLD}% · Under-allocated: &lt;{UNDER_THRESHOLD}%
              </div>

              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {staff.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">No staff data for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3 font-medium">Staff Member</th>
                          <th className="text-right px-4 py-3 font-medium">Billable Hrs</th>
                          <th className="text-right px-4 py-3 font-medium">Utilization</th>
                          <th className="text-right px-4 py-3 font-medium">Matters</th>
                          <th className="text-right px-4 py-3 font-medium">Revenue</th>
                          <th className="text-right px-4 py-3 font-medium">Avg Rate</th>
                          <th className="text-center px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {staff.map(s => (
                          <tr key={s.email} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.email}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{s.billableHours.toFixed(1)}h</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{
                                      width: `${Math.min(s.utilizationPct, 100)}%`,
                                      background: STATUS_COLORS[s.status],
                                    }}
                                  />
                                </div>
                                <span className="font-medium" style={{ color: STATUS_COLORS[s.status] }}>
                                  {Math.round(s.utilizationPct)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.matterCount}</td>
                            <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(s.totalRevenue)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmt(s.avgRate)}/hr</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                                style={{
                                  background: s.status === 'over' ? '#fee2e2' : s.status === 'under' ? '#fef3c7' : '#dcfce7',
                                  color: STATUS_COLORS[s.status],
                                }}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                              {s.status === 'over'
                                ? `Redistribute ~${Math.round(s.billableHours * 0.15)}h to under-allocated staff`
                                : s.status === 'under'
                                ? `Assign additional matters — ~${Math.round(((TARGET_UTILIZATION / 100) * (parseInt(dateRange) * 5 / 7) * 8) - s.billableHours)}h available capacity`
                                : 'Workload balanced — maintain current assignments'}
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

          {/* ── RATE DISTRIBUTION ── */}
          {activeView === 'rates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Hours by Rate Bracket</h3>
                {rateDistribution.every(r => r.hours === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={rateDistribution.filter(r => r.hours > 0)}
                        dataKey="hours"
                        nameKey="range"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ range, percent }) => `${range} (${Math.round((percent ?? 0) * 100)}%)`}
                        labelLine={false}
                      >
                        {rateDistribution.filter(r => r.hours > 0).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Rate distribution table */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Rate Distribution Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Rate Range</th>
                      <th className="text-right pb-2 font-medium">Entries</th>
                      <th className="text-right pb-2 font-medium">Hours</th>
                      <th className="text-right pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rateDistribution.map((r, i) => (
                      <tr key={r.range} className="hover:bg-gray-50">
                        <td className="py-2.5 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                          {r.range}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{r.count}</td>
                        <td className="py-2.5 text-right font-medium text-gray-900">{r.hours.toFixed(1)}h</td>
                        <td className="py-2.5 text-right text-green-700 font-medium">{fmt(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Standard rates reference */}
                {standardRates.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Standard Rates Reference</p>
                    <div className="space-y-1">
                      {standardRates.map(r => (
                        <div key={r.service_type} className="flex justify-between text-xs text-gray-600">
                          <span>{r.service_type}</span>
                          <span className="font-medium">{fmt(r.rate_per_hour)}/hr</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rate mismatch opportunities */}
              <div className="lg:col-span-2 bg-orange-50 border border-orange-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Rate-Mismatch Opportunities
                </h3>
                {matters.filter(m => m.rateMismatch).length === 0 ? (
                  <p className="text-sm text-orange-600">No rate mismatches detected — all active matters are billed within 10% of standard rates.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {matters.filter(m => m.rateMismatch).map(m => (
                      <div key={m.matterId} className="bg-white rounded-lg p-3 border border-orange-100">
                        <p className="font-medium text-gray-900 text-sm">{m.matterName}</p>
                        <p className="text-xs text-gray-500 mb-2">{m.serviceType} · {m.clientName}</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Billed avg:</span>
                          <span className="font-semibold text-orange-700">{fmt(m.avgRate)}/hr</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Standard:</span>
                          <span className="font-semibold text-gray-700">{fmt(m.standardRate)}/hr</span>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-gray-500">Variance:</span>
                          <span className={`font-bold ${m.avgRate > m.standardRate ? 'text-green-600' : 'text-red-600'}`}>
                            {m.avgRate > m.standardRate ? '+' : ''}{Math.round(m.rateMismatchPct)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {m.avgRate < m.standardRate
                            ? `Opportunity: raise rate to standard — potential +${fmt((m.standardRate - m.avgRate) * m.totalBillableHours)}`
                            : `Review: rate exceeds standard — verify client agreement`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
