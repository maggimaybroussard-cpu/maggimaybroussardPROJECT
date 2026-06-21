'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string;
  booking_time: string;
  booking_type: string;
  status: string;
  duration_minutes: number;
  source: string | null;
  created_at: string;
  conversion_status: string | null;
  converted_at: string | null;
  intake_form_status: string | null;
  lead_score: number | null;
}

interface DailyCount {
  date: string;
  bookings: number;
  completed: number;
  noShow: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
  pct: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  color: string;
}

interface SourceBreakdown {
  source: string;
  count: number;
  pct: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9'];
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#355E3B',
  completed: '#4a7c59',
  pending: '#d97706',
  no_show: '#dc2626',
  cancelled: '#9ca3af',
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consult',
  case_checkin: 'Case Check-In',
  follow_up: 'Follow-Up',
  document_review: 'Doc Review',
};

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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-[#355E3B]/20 bg-[#f0f7f1]' : 'bg-white border-gray-100'}`}>
      <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-[#355E3B]' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingAnalyticsDashboard() {
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const cutoff = getCutoff(range);
      let q = supabase
        .from('consultation_bookings')
        .select('id, client_name, client_email, booking_date, booking_time, booking_type, status, duration_minutes, source, created_at, conversion_status, converted_at, intake_form_status, lead_score')
        .order('booking_date', { ascending: false });
      if (cutoff) q = q.gte('created_at', cutoff);
      const { data, error: err } = await q;
      if (err) throw err;
      setBookings((data ?? []) as BookingRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const total = bookings.length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const noShow = bookings.filter((b) => b.status === 'no_show').length;
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
  const converted = bookings.filter((b) => b.conversion_status === 'client').length;
  const showRate = total > 0 ? ((completed / Math.max(completed + noShow, 1)) * 100).toFixed(0) : '—';
  const convRate = total > 0 ? ((converted / total) * 100).toFixed(0) : '—';
  const avgScore = bookings.length > 0
    ? (bookings.reduce((s, b) => s + (b.lead_score ?? 0), 0) / bookings.length).toFixed(1)
    : '—';

  // ── Daily trend ──────────────────────────────────────────────────────────────
  const dailyMap: Record<string, DailyCount> = {};
  bookings.forEach((b) => {
    const d = b.booking_date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, bookings: 0, completed: 0, noShow: 0 };
    dailyMap[d].bookings++;
    if (b.status === 'completed') dailyMap[d].completed++;
    if (b.status === 'no_show') dailyMap[d].noShow++;
  });
  const dailyData: DailyCount[] = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map((d) => ({ ...d, date: formatDateLabel(d.date) }));

  // ── Type breakdown ───────────────────────────────────────────────────────────
  const typeMap: Record<string, number> = {};
  bookings.forEach((b) => { typeMap[b.booking_type] = (typeMap[b.booking_type] ?? 0) + 1; });
  const typeData: TypeBreakdown[] = Object.entries(typeMap).map(([type, count]) => ({
    type: BOOKING_TYPE_LABELS[type] ?? type,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // ── Status breakdown ─────────────────────────────────────────────────────────
  const statusData: StatusBreakdown[] = [
    { status: 'Confirmed', count: confirmed, color: STATUS_COLORS.confirmed },
    { status: 'Completed', count: completed, color: STATUS_COLORS.completed },
    { status: 'No-Show', count: noShow, color: STATUS_COLORS.no_show },
    { status: 'Cancelled', count: cancelled, color: STATUS_COLORS.cancelled },
  ].filter((s) => s.count > 0);

  // ── Source breakdown ─────────────────────────────────────────────────────────
  const sourceMap: Record<string, number> = {};
  bookings.forEach((b) => {
    const src = b.source ?? 'direct';
    sourceMap[src] = (sourceMap[src] ?? 0) + 1;
  });
  const sourceData: SourceBreakdown[] = Object.entries(sourceMap).map(([source, count]) => ({
    source: source.charAt(0).toUpperCase() + source.slice(1),
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // ── Intake form completion ───────────────────────────────────────────────────
  const intakeCompleted = bookings.filter((b) => b.intake_form_status === 'completed').length;
  const intakePct = total > 0 ? Math.round((intakeCompleted / total) * 100) : 0;

  // ── Recent bookings ──────────────────────────────────────────────────────────
  const recent = bookings.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Booking Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Consultation booking performance, attendance, and conversion metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                range === opt.value
                  ? 'bg-[#355E3B] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#355E3B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Total Bookings" value={total} accent />
            <KPICard label="Confirmed" value={confirmed} sub="active" />
            <KPICard label="Completed" value={completed} sub="attended" />
            <KPICard label="No-Show" value={noShow} sub="missed" />
            <KPICard label="Show Rate" value={`${showRate}%`} sub="of scheduled" />
            <KPICard label="Converted" value={`${convRate}%`} sub="became clients" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Avg Lead Score</p>
              <p className="text-3xl font-semibold text-gray-900">{avgScore}</p>
              <p className="text-xs text-gray-400 mt-1">out of 100</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Intake Completion</p>
              <p className="text-3xl font-semibold text-gray-900">{intakePct}%</p>
              <div className="mt-2 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#355E3B] rounded-full" style={{ width: `${intakePct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{intakeCompleted} of {total} completed</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Clients Converted</p>
              <p className="text-3xl font-semibold text-[#355E3B]">{converted}</p>
              <p className="text-xs text-gray-400 mt-1">from {total} bookings</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Trend */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Booking Trend</h3>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bookGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#355E3B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Area type="monotone" dataKey="bookings" stroke="#355E3B" strokeWidth={2} fill="url(#bookGrad)" name="Bookings" />
                    <Area type="monotone" dataKey="completed" stroke="#4a7c59" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data for this period</div>
              )}
            </div>

            {/* Status Pie */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
              {statusData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {statusData.map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                          <span className="text-xs text-gray-600">{s.status}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data for this period</div>
              )}
            </div>
          </div>

          {/* Type + Source Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Booking Type */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">By Consultation Type</h3>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="count" name="Bookings" radius={[0, 4, 4, 0]}>
                      {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data</div>
              )}
            </div>

            {/* Source */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">By Booking Source</h3>
              {sourceData.length > 0 ? (
                <div className="space-y-3">
                  {sourceData.map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{s.source}</span>
                        <span className="text-xs text-gray-400">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data</div>
              )}
            </div>
          </div>

          {/* Recent Bookings Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Recent Bookings</h3>
              <span className="text-xs text-gray-400">{total} total in period</span>
            </div>
            {recent.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No bookings in this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Converted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => {
                      const statusColor: Record<string, string> = {
                        confirmed: 'bg-blue-50 text-blue-700',
                        completed: 'bg-emerald-50 text-emerald-700',
                        no_show: 'bg-red-50 text-red-700',
                        cancelled: 'bg-gray-100 text-gray-500',
                        pending: 'bg-amber-50 text-amber-700',
                      };
                      return (
                        <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900 text-sm">{b.client_name}</p>
                            <p className="text-xs text-gray-400">{b.client_email}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{b.booking_date}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{BOOKING_TYPE_LABELS[b.booking_type] ?? b.booking_type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[b.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-700">{b.lead_score ?? '—'}</td>
                          <td className="px-4 py-3">
                            {b.conversion_status === 'client' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#355E3B]">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Yes
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
