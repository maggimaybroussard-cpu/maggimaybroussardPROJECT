'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineOutcome {
  id: string;
  client_name: string | null;
  client_email: string | null;
  consultation_date: string | null;
  outcome_summary: string | null;
  consultation_notes: string | null;
  status: string;
  linked_to_clio: boolean;
  follow_up_date: string | null;
  created_at: string;
}

interface PipelineBooking {
  id: string;
  client_name: string | null;
  client_email: string | null;
  booking_date: string | null;
  status: string | null;
  created_at: string;
}

interface PipelineInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  created_at: string;
}

interface StageCount {
  stage: string;
  count: number;
  color: string;
}

interface MonthlyTrend {
  month: string;
  inquiries: number;
  bookings: number;
  outcomes: number;
}

const OUTCOME_TYPE_COLORS: Record<string, string> = {
  resolved: '#10b981',
  escalated: '#ef4444',
  ongoing: '#3b82f6',
  pending: '#f59e0b',
  unknown: '#94a3b8',
};

const STAGE_COLORS = ['#1B2A4A', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function detectOutcomeType(notes: string | null): string {
  if (!notes) return 'unknown';
  const lower = notes.toLowerCase();
  if (lower.includes('outcome type: resolved')) return 'resolved';
  if (lower.includes('outcome type: escalated')) return 'escalated';
  if (lower.includes('outcome type: ongoing')) return 'ongoing';
  if (lower.includes('outcome type: pending')) return 'pending';
  return 'unknown';
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConsultationPipelineReport() {
  const [outcomes, setOutcomes] = useState<PipelineOutcome[]>([]);
  const [bookings, setBookings] = useState<PipelineBooking[]>([]);
  const [inquiries, setInquiries] = useState<PipelineInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'30' | '60' | '90' | 'all'>('90');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const cutoff =
        dateRange === 'all'
          ? null
          : new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString();

      const [outcomesRes, bookingsRes, inquiriesRes] = await Promise.all([
        cutoff
          ? supabase.from('consultation_outcomes').select('*').gte('created_at', cutoff).order('created_at', { ascending: false })
          : supabase.from('consultation_outcomes').select('*').order('created_at', { ascending: false }),
        cutoff
          ? supabase.from('consultation_bookings').select('id, client_name, client_email, booking_date, status, created_at').gte('created_at', cutoff).order('created_at', { ascending: false })
          : supabase.from('consultation_bookings').select('id, client_name, client_email, booking_date, status, created_at').order('created_at', { ascending: false }),
        cutoff
          ? supabase.from('contact_inquiries').select('id, name, email, service, status, created_at').gte('created_at', cutoff).order('created_at', { ascending: false })
          : supabase.from('contact_inquiries').select('id, name, email, service, status, created_at').order('created_at', { ascending: false }),
      ]);

      if (outcomesRes.error) throw new Error(outcomesRes.error.message);
      if (bookingsRes.error) throw new Error(bookingsRes.error.message);
      if (inquiriesRes.error) throw new Error(inquiriesRes.error.message);

      setOutcomes(outcomesRes.data ?? []);
      setBookings(bookingsRes.data ?? []);
      setInquiries(inquiriesRes.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived metrics ────────────────────────────────────────────────────────

  const totalInquiries = inquiries.length;
  const totalBookings = bookings.length;
  const totalOutcomes = outcomes.length;
  const clioLinked = outcomes.filter(o => o.linked_to_clio).length;
  const conversionRate = totalInquiries > 0 ? ((totalBookings / totalInquiries) * 100).toFixed(1) : '0';
  const outcomeRate = totalBookings > 0 ? ((totalOutcomes / totalBookings) * 100).toFixed(1) : '0';

  // Pipeline funnel stages
  const stageData: StageCount[] = [
    { stage: 'Inquiries', count: totalInquiries, color: STAGE_COLORS[0] },
    { stage: 'Bookings', count: totalBookings, color: STAGE_COLORS[1] },
    { stage: 'Outcomes', count: totalOutcomes, color: STAGE_COLORS[2] },
    { stage: 'Clio Linked', count: clioLinked, color: STAGE_COLORS[3] },
  ];

  // Outcome type breakdown
  const outcomeTypeCounts = outcomes.reduce<Record<string, number>>((acc, o) => {
    const type = detectOutcomeType(o.consultation_notes);
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
  const outcomeTypePie = Object.entries(outcomeTypeCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: OUTCOME_TYPE_COLORS[name] ?? '#94a3b8',
  }));

  // Outcome status breakdown
  const statusCounts = outcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusPie = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }));

  // Monthly trend (last 6 months)
  const monthlyMap: Record<string, MonthlyTrend> = {};
  const addToMonth = (dateStr: string, field: keyof Omit<MonthlyTrend, 'month'>) => {
    const key = formatMonth(dateStr);
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, inquiries: 0, bookings: 0, outcomes: 0 };
    monthlyMap[key][field]++;
  };
  inquiries.forEach(i => addToMonth(i.created_at, 'inquiries'));
  bookings.forEach(b => addToMonth(b.created_at, 'bookings'));
  outcomes.forEach(o => addToMonth(o.created_at, 'outcomes'));
  const monthlyTrend = Object.values(monthlyMap).slice(-6);

  // Follow-up due
  const followUpDue = outcomes.filter(o => {
    if (!o.follow_up_date) return false;
    const d = new Date(o.follow_up_date);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d >= now && d <= in7;
  });
  const overdueFU = outcomes.filter(o => o.follow_up_date && new Date(o.follow_up_date) < new Date());

  // Recent outcomes table
  const recentOutcomes = outcomes.slice(0, 10);

  const PIE_COLORS = ['#1B2A4A', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1B2A4A]">Consultation Pipeline Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Full funnel view — from inquiry to Clio-linked outcome
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as typeof dateRange)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
          >
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={fetchData}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Inquiries', value: totalInquiries, sub: 'Contact form submissions', color: 'text-[#1B2A4A]', bg: 'bg-slate-50 border-slate-200' },
              { label: 'Consultations Booked', value: totalBookings, sub: `${conversionRate}% inquiry → booking`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Outcomes Recorded', value: totalOutcomes, sub: `${outcomeRate}% booking → outcome`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Clio Linked', value: clioLinked, sub: `${totalOutcomes > 0 ? ((clioLinked / totalOutcomes) * 100).toFixed(0) : 0}% of outcomes`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
            ].map(kpi => (
              <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Follow-up Alerts */}
          {(followUpDue.length > 0 || overdueFU.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {overdueFU.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-sm font-semibold text-red-700">Overdue Follow-ups ({overdueFU.length})</p>
                  </div>
                  <ul className="space-y-1">
                    {overdueFU.slice(0, 3).map(o => (
                      <li key={o.id} className="text-xs text-red-600">
                        {o.client_name} — due {o.follow_up_date ? new Date(o.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </li>
                    ))}
                    {overdueFU.length > 3 && <li className="text-xs text-red-400">+{overdueFU.length - 3} more</li>}
                  </ul>
                </div>
              )}
              {followUpDue.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <p className="text-sm font-semibold text-amber-700">Due This Week ({followUpDue.length})</p>
                  </div>
                  <ul className="space-y-1">
                    {followUpDue.slice(0, 3).map(o => (
                      <li key={o.id} className="text-xs text-amber-700">
                        {o.client_name} — due {o.follow_up_date ? new Date(o.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </li>
                    ))}
                    {followUpDue.length > 3 && <li className="text-xs text-amber-500">+{followUpDue.length - 3} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Funnel Bar Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Pipeline Funnel</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Outcome Type Pie */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Outcome Types</h3>
              {outcomeTypePie.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={outcomeTypePie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {outcomeTypePie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No outcomes yet</div>
              )}
            </div>
          </div>

          {/* Monthly Trend */}
          {monthlyTrend.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inquiries" name="Inquiries" fill="#1B2A4A" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="bookings" name="Bookings" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="outcomes" name="Outcomes" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Outcome Status Breakdown + Recent Outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status Breakdown */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Outcome Status</h3>
              {statusPie.length > 0 ? (
                <div className="space-y-2">
                  {statusPie.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-[#1B2A4A]">{s.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No data</p>
              )}
            </div>

            {/* Recent Outcomes Table */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-[#1B2A4A]">Recent Outcomes</h3>
              </div>
              {recentOutcomes.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">No outcomes recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Clio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentOutcomes.map(o => {
                        const otype = detectOutcomeType(o.consultation_notes);
                        return (
                          <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#1B2A4A] truncate max-w-[120px]">{o.client_name ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden sm:table-cell">
                              {o.consultation_date
                                ? new Date(o.consultation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  background: OUTCOME_TYPE_COLORS[otype] + '20',
                                  color: OUTCOME_TYPE_COLORS[otype],
                                }}
                              >
                                {otype.charAt(0).toUpperCase() + otype.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                o.status === 'finalized' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                o.status === 'in_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                o.status === 'archived'? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {o.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {o.linked_to_clio ? (
                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                  Linked
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
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
          </div>
        </>
      )}
    </div>
  );
}
