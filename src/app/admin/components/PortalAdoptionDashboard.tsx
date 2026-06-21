'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngagementEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

interface DailyActivity {
  date: string;
  logins: number;
  formSubmits: number;
  docUploads: number;
  invoiceDownloads: number;
  total: number;
}

interface EventBreakdown {
  name: string;
  count: number;
  color: string;
}

interface ActiveUser {
  userId: string;
  eventCount: number;
  lastSeen: string;
  eventTypes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_GREEN = '#355E3B';
const PALETTE = ['#355E3B', '#4a7c52', '#6b9e74', '#8fbf97', '#b3d9ba', '#d6edd9'];

const EVENT_LABELS: Record<string, string> = {
  portal_login: 'Portal Logins',
  portal_form_submit: 'Form Submissions',
  portal_document_upload: 'Document Uploads',
  portal_invoice_download: 'Invoice Downloads',
  portal_dashboard_view: 'Dashboard Views',
  portal_documents_view: 'Documents Views',
  portal_billing_view: 'Billing Views',
  portal_messages_view: 'Messages Views',
  portal_cases_view: 'Cases Views',
  portal_document_signed: 'Documents Signed',
  portal_retainer_view: 'Retainer Views',
};

const EVENT_COLORS: Record<string, string> = {
  portal_login: '#355E3B',
  portal_form_submit: '#4a7c52',
  portal_document_upload: '#6b9e74',
  portal_invoice_download: '#8fbf97',
  portal_dashboard_view: '#b3d9ba',
  portal_documents_view: '#d6edd9',
  portal_billing_view: '#a3c4a8',
  portal_messages_view: '#7aab82',
  portal_cases_view: '#5a9464',
  portal_document_signed: '#2d5233',
  portal_retainer_view: '#c8e6cc',
};

const KEY_EVENTS = ['portal_login', 'portal_form_submit', 'portal_document_upload', 'portal_invoice_download'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  icon,
  accent = BRAND_GREEN,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}18` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-foreground">{typeof value === 'number' ? fmt(value) : value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalAdoptionDashboard() {
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const since = getDaysAgo(range);

      const { data, error: fetchErr } = await supabase
        .from('portal_engagement_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (fetchErr) throw fetchErr;
      setEvents(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portal engagement data.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Derived metrics ────────────────────────────────────────────────────────

  const totalEvents = events.length;
  const loginEvents = events.filter((e) => e.event_type === 'portal_login');
  const formSubmitEvents = events.filter((e) => e.event_type === 'portal_form_submit');
  const docUploadEvents = events.filter((e) => e.event_type === 'portal_document_upload');
  const invoiceDownloadEvents = events.filter((e) => e.event_type === 'portal_invoice_download');

  const uniqueUsers = new Set(events.map((e) => e.user_id).filter(Boolean)).size;
  const activeUsers = new Set(loginEvents.map((e) => e.user_id).filter(Boolean)).size;

  // Daily activity breakdown
  const dailyMap: Record<string, DailyActivity> = {};
  events.forEach((e) => {
    const day = e.created_at.slice(0, 10);
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, logins: 0, formSubmits: 0, docUploads: 0, invoiceDownloads: 0, total: 0 };
    }
    dailyMap[day].total++;
    if (e.event_type === 'portal_login') dailyMap[day].logins++;
    if (e.event_type === 'portal_form_submit') dailyMap[day].formSubmits++;
    if (e.event_type === 'portal_document_upload') dailyMap[day].docUploads++;
    if (e.event_type === 'portal_invoice_download') dailyMap[day].invoiceDownloads++;
  });

  const dailyData: DailyActivity[] = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, date: fmtDate(d.date) }));

  // Event type breakdown
  const eventCountMap: Record<string, number> = {};
  events.forEach((e) => {
    eventCountMap[e.event_type] = (eventCountMap[e.event_type] || 0) + 1;
  });

  const eventBreakdown: EventBreakdown[] = Object.entries(eventCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      name: EVENT_LABELS[type] ?? type.replace(/_/g, ' '),
      count,
      color: EVENT_COLORS[type] ?? BRAND_GREEN,
    }));

  // Active users table
  const userMap: Record<string, ActiveUser> = {};
  events.forEach((e) => {
    if (!e.user_id) return;
    if (!userMap[e.user_id]) {
      userMap[e.user_id] = { userId: e.user_id, eventCount: 0, lastSeen: e.created_at, eventTypes: [] };
    }
    userMap[e.user_id].eventCount++;
    if (!userMap[e.user_id].eventTypes.includes(e.event_type)) {
      userMap[e.user_id].eventTypes.push(e.event_type);
    }
    if (e.created_at > userMap[e.user_id].lastSeen) {
      userMap[e.user_id].lastSeen = e.created_at;
    }
  });

  const topUsers = Object.values(userMap)
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10);

  // Recent activity feed
  const recentEvents = events.slice(0, 20);

  // Adoption rate: users who did at least one key action
  const usersWithKeyAction = new Set(
    events
      .filter((e) => KEY_EVENTS.includes(e.event_type))
      .map((e) => e.user_id)
      .filter(Boolean)
  ).size;

  const adoptionRate = uniqueUsers > 0 ? Math.round((usersWithKeyAction / uniqueUsers) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Portal Adoption & Engagement</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Login patterns, form submissions, document uploads, and invoice downloads
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}d
            </button>
          ))}
          <button
            onClick={fetchEvents}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Portal Logins"
              value={loginEvents.length}
              sub={`${activeUsers} unique users`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              }
            />
            <KPICard
              label="Form Submissions"
              value={formSubmitEvents.length}
              sub="Intake & questionnaires"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
              }
              accent="#4a7c52"
            />
            <KPICard
              label="Doc Uploads"
              value={docUploadEvents.length}
              sub="Client-uploaded files"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
              }
              accent="#6b9e74"
            />
            <KPICard
              label="Invoice Downloads"
              value={invoiceDownloadEvents.length}
              sub="PDF receipts & invoices"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              }
              accent="#8fbf97"
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Total Events"
              value={totalEvents}
              sub={`Last ${range} days`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />
            <KPICard
              label="Unique Users"
              value={uniqueUsers}
              sub="With any portal activity"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              accent="#4a7c52"
            />
            <KPICard
              label="Adoption Rate"
              value={`${adoptionRate}%`}
              sub="Users with key actions"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              }
              accent="#6b9e74"
            />
            <KPICard
              label="Event Types"
              value={eventBreakdown.length}
              sub="Distinct tracked actions"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              }
              accent="#8fbf97"
            />
          </div>

          {/* Daily Activity Chart */}
          {dailyData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Daily Portal Activity</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="logins" name="Logins" fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="formSubmits" name="Form Submits" fill={PALETTE[1]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="docUploads" name="Doc Uploads" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="invoiceDownloads" name="Invoice Downloads" fill={PALETTE[3]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Event Breakdown + Pie */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Breakdown table */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Event Breakdown</h3>
              {eventBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded in this period.</p>
              ) : (
                <div className="space-y-2">
                  {eventBreakdown.map((item) => {
                    const pct = totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-foreground flex-1 truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: item.color }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground w-8 text-right">{item.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Engagement Distribution</h3>
              {eventBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={eventBreakdown.slice(0, 6)}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {eventBreakdown.slice(0, 6).map((entry, i) => (
                        <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Active Users + Recent Feed */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top users */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Most Active Users</h3>
              {topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No user activity recorded.</p>
              ) : (
                <div className="space-y-2">
                  {topUsers.map((u, i) => (
                    <div key={u.userId} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate font-mono">
                          {u.userId.slice(0, 8)}…
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {u.eventTypes.slice(0, 3).map((t) => EVENT_LABELS[t] ?? t).join(', ')}
                          {u.eventTypes.length > 3 ? ` +${u.eventTypes.length - 3}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground">{u.eventCount}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(u.lastSeen)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity feed */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recentEvents.map((e) => (
                    <div key={e.id} className="flex items-start gap-2.5 py-1.5 border-b border-border/50 last:border-0">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: EVENT_COLORS[e.event_type] ?? BRAND_GREEN }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {EVENT_LABELS[e.event_type] ?? e.event_type.replace(/_/g, ' ')}
                        </p>
                        {e.event_data && Object.keys(e.event_data).length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {Object.entries(e.event_data)
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{fmtDateTime(e.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {totalEvents === 0 && !loading && (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BRAND_GREEN} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3 className="font-serif text-lg text-foreground mb-2">No Portal Activity Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Portal engagement events will appear here once clients log in, submit forms, upload documents, or download invoices.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
