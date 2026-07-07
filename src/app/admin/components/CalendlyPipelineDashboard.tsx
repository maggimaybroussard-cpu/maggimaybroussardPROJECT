'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CalendlyEvent {
  uri: string;
  uuid: string;
  name: string;
  start_time: string;
  end_time: string;
  status: string;
  event_type: string;
  location?: {
    type?: string;
    location?: string;
    join_url?: string;
  };
  invitees_counter?: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
}

interface CalendlyInvitee {
  uri: string;
  uuid: string;
  name: string;
  email: string;
  status: string;
  timezone: string;
  created_at: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
    position: number;
  }>;
  tracking?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  text_reminder_number?: string;
}

type AttendanceStatus = 'pending' | 'attended' | 'no_show' | 'rescheduled' | 'canceled';

interface BookingRow {
  event: CalendlyEvent;
  invitee: CalendlyInvitee | null;
  serviceInterest: string;
  leadScore: number;
  isHot: boolean;
  reminderSent: boolean;
  prepSent: boolean;
  attendanceStatus: AttendanceStatus;
  noShowFlagged: boolean;
  inquiryId: string | null;
}

function computeLeadScore(invitee: CalendlyInvitee | null, event: CalendlyEvent, attendanceStatus: AttendanceStatus): number {
  let score = 50; // base for booking
  if (!invitee) return score;

  const qas = invitee.questions_and_answers ?? [];
  score += qas.length * 8;

  if (invitee.text_reminder_number) score += 15;
  if (invitee.tracking?.utm_source) score += 10;
  if (invitee.tracking?.utm_campaign) score += 5;
  if (invitee.tracking?.utm_source === 'services_page') score += 20;

  const totalAnswerLength = qas.reduce((sum, qa) => sum + (qa.answer?.length ?? 0), 0);
  if (totalAnswerLength > 100) score += 10;
  if (totalAnswerLength > 250) score += 10;

  // Attendance outcome adjustments
  if (attendanceStatus === 'attended') score = Math.min(100, score + 15);
  if (attendanceStatus === 'no_show') score = Math.max(0, score - 20);
  if (attendanceStatus === 'rescheduled') score = Math.max(0, score - 5);

  return Math.min(100, score);
}

function extractServiceInterest(invitee: CalendlyInvitee | null, eventName: string): string {
  if (!invitee) return eventName || 'General Consultation';
  const qas = invitee.questions_and_answers ?? [];
  const serviceQ = qas.find((qa) =>
    /service|interest|help|matter|case|practice|area|type/i.test(qa.question)
  );
  if (serviceQ?.answer) return serviceQ.answer;
  return eventName || 'General Consultation';
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-gray-100 text-gray-600';
  if (score >= 85) color = 'bg-red-100 text-red-700 border border-red-200';
  else if (score >= 70) color = 'bg-amber-100 text-amber-700 border border-amber-200';
  else if (score >= 55) color = 'bg-blue-100 text-blue-700 border border-blue-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score >= 85 && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )}
      {score}
    </span>
  );
}

function AttendanceBadge({ status, noShowFlagged }: { status: AttendanceStatus; noShowFlagged: boolean }) {
  if (status === 'attended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold">
        ✅ Attended
      </span>
    );
  }
  if (status === 'no_show' || noShowFlagged) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-semibold">
        🚫 No-Show
      </span>
    );
  }
  if (status === 'rescheduled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold">
        📅 Rescheduled
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-xs font-semibold">
        ✕ Canceled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold">
      ⏳ Pending
    </span>
  );
}

export default function CalendlyPipelineDashboard() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'hot' | 'upcoming_48h' | 'no_show'>('all');
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [localState, setLocalState] = useState<Record<string, { reminderSent?: boolean; prepSent?: boolean; attendanceStatus?: AttendanceStatus }>>({});
  const [markingAttendance, setMarkingAttendance] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const eventsRes = await fetch(
        `/api/calendly/events?min_start_time=${now.toISOString()}&max_start_time=${in30Days.toISOString()}&status=active&count=50`
      );

      if (!eventsRes.ok) {
        throw new Error(`Calendly API error: ${eventsRes.status}`);
      }

      const eventsData = await eventsRes.json();
      const events: CalendlyEvent[] = eventsData.collection ?? [];

      const eventSlice = events.slice(0, 20);
      const inviteeResults = await Promise.allSettled(
        eventSlice.map(async (ev) => {
          const uuid = ev.uri.split('/').pop() ?? '';
          const res = await fetch(`/api/calendly/invitees?event_uuid=${uuid}`);
          if (!res.ok) return null;
          const data = await res.json();
          return (data.collection ?? [])[0] as CalendlyInvitee | undefined;
        })
      );

      // Fetch attendance status from Supabase for each invitee email
      const supabase = createClient();
      const emails = eventSlice
        .map((_, i) => {
          const r = inviteeResults[i];
          return r.status === 'fulfilled' ? (r as PromiseFulfilledResult<CalendlyInvitee | null | undefined>).value?.email : null;
        })
        .filter(Boolean) as string[];

      const { data: inquiryData } = emails.length > 0
        ? await supabase
            .from('contact_inquiries')
            .select('id, email, attendance_status, no_show_flagged')
            .in('email', emails)
            .order('created_at', { ascending: false })
        : { data: [] };

      // Build a map of email → latest inquiry attendance info
      const attendanceMap: Record<string, { id: string; attendance_status: AttendanceStatus; no_show_flagged: boolean }> = {};
      for (const row of (inquiryData ?? [])) {
        if (!attendanceMap[row.email]) {
          attendanceMap[row.email] = {
            id: row.id,
            attendance_status: (row.attendance_status as AttendanceStatus) ?? 'pending',
            no_show_flagged: row.no_show_flagged ?? false,
          };
        }
      }

      const built: BookingRow[] = eventSlice.map((ev, i) => {
        const invitee =
          inviteeResults[i].status === 'fulfilled'
            ? (inviteeResults[i] as PromiseFulfilledResult<CalendlyInvitee | null | undefined>).value ?? null
            : null;

        const attendanceInfo = invitee?.email ? attendanceMap[invitee.email] : null;
        const attendanceStatus: AttendanceStatus = attendanceInfo?.attendance_status ?? 'pending';
        const noShowFlagged = attendanceInfo?.no_show_flagged ?? false;

        const serviceInterest = extractServiceInterest(invitee, ev.name);
        const leadScore = computeLeadScore(invitee, ev, attendanceStatus);
        const isHot = (leadScore >= 75 || daysUntil(ev.start_time) <= 2) && attendanceStatus !== 'no_show';

        return {
          event: ev,
          invitee,
          serviceInterest,
          leadScore,
          isHot,
          reminderSent: false,
          prepSent: false,
          attendanceStatus,
          noShowFlagged,
          inquiryId: attendanceInfo?.id ?? null,
        };
      });

      setRows(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Calendly bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAttendance = async (row: BookingRow, status: 'attended' | 'no_show') => {
    const key = row.event.uuid;
    setMarkingAttendance((prev) => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/calendly/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: status === 'attended' ? '_internal_attended' : '_internal_noshow',
          payload: {
            invitee: { email: row.invitee?.email ?? '', name: row.invitee?.name ?? '' },
            scheduled_event: { uri: row.event.uri },
          },
        }),
      });

      // Also call handle-calendly-booking directly via admin API
      const supabase = createClient();
      if (row.inquiryId) {
        await supabase
          .from('contact_inquiries')
          .update({
            attendance_status: status === 'attended' ? 'attended' : 'no_show',
            no_show_flagged: status === 'no_show',
            attendance_scored_at: new Date().toISOString(),
            attendance_score_delta: status === 'attended' ? 15 : -20,
          })
          .eq('id', row.inquiryId);
      }

      setLocalState((prev) => ({
        ...prev,
        [key]: { ...prev[key], attendanceStatus: status === 'attended' ? 'attended' : 'no_show' },
      }));
      setActionFeedback((prev) => ({ ...prev, [key]: status === 'attended' ? 'marked_attended' : 'marked_noshow' }));
    } catch {
      setActionFeedback((prev) => ({ ...prev, [key]: 'error' }));
    }
    setMarkingAttendance((prev) => ({ ...prev, [key]: false }));
    setTimeout(() => setActionFeedback((prev) => { const n = { ...prev }; delete n[key]; return n; }), 4000);
  };

  const handleSendReminder = async (row: BookingRow) => {
    const key = row.event.uuid;
    setActionFeedback((prev) => ({ ...prev, [key]: 'sending_reminder' }));
    try {
      await fetch('/api/sms/booking-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.invitee?.name ?? 'Client',
          email: row.invitee?.email ?? '',
          phone: row.invitee?.text_reminder_number ?? '',
          start_time: row.event.start_time,
          event_type: row.event.name,
        }),
      });
      setLocalState((prev) => ({ ...prev, [key]: { ...prev[key], reminderSent: true } }));
      setActionFeedback((prev) => ({ ...prev, [key]: 'reminder_sent' }));
    } catch {
      setActionFeedback((prev) => ({ ...prev, [key]: 'error' }));
    }
    setTimeout(() => setActionFeedback((prev) => { const n = { ...prev }; delete n[key]; return n; }), 3000);
  };

  const handleSendPrep = async (row: BookingRow) => {
    const key = row.event.uuid;
    setActionFeedback((prev) => ({ ...prev, [key]: 'sending_prep' }));
    try {
      await fetch('/api/admin/consultations/send-prep-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: row.invitee?.email ?? '',
          name: row.invitee?.name ?? 'Client',
          service: row.serviceInterest,
          start_time: row.event.start_time,
        }),
      });
      setLocalState((prev) => ({ ...prev, [key]: { ...prev[key], prepSent: true } }));
      setActionFeedback((prev) => ({ ...prev, [key]: 'prep_sent' }));
    } catch {
      setActionFeedback((prev) => ({ ...prev, [key]: 'error' }));
    }
    setTimeout(() => setActionFeedback((prev) => { const n = { ...prev }; delete n[key]; return n; }), 3000);
  };

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      row.invitee?.name?.toLowerCase().includes(q) ||
      row.invitee?.email?.toLowerCase().includes(q) ||
      row.serviceInterest?.toLowerCase().includes(q) ||
      row.event.name?.toLowerCase().includes(q);

    if (filter === 'hot') return matchesSearch && row.isHot;
    if (filter === 'upcoming_48h') return matchesSearch && daysUntil(row.event.start_time) <= 2;
    if (filter === 'no_show') return matchesSearch && (row.noShowFlagged || row.attendanceStatus === 'no_show' || (localState[row.event.uuid]?.attendanceStatus === 'no_show'));
    return matchesSearch;
  });

  const hotCount = rows.filter((r) => r.isHot).length;
  const upcoming48h = rows.filter((r) => daysUntil(r.event.start_time) <= 2).length;
  const noShowCount = rows.filter((r) => r.noShowFlagged || r.attendanceStatus === 'no_show').length;
  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.leadScore, 0) / rows.length) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{rows.length}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Next 30 Days</p>
        </div>
        <div className="bg-card border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-semibold text-red-700">{hotCount}</p>
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">🔥 Hot Leads</p>
        </div>
        <div className="bg-card border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-amber-700">{upcoming48h}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Within 48h</p>
        </div>
        <div className="bg-card border border-red-100 rounded-xl p-4">
          <p className="text-2xl font-semibold text-red-600">{noShowCount}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">🚫 No-Shows</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-semibold text-foreground">{avgScore}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Avg Score</p>
        </div>
      </div>

      {/* No-Show Alert Banner */}
      {noShowCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <span className="text-lg mt-0.5">🚫</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {noShowCount} no-show{noShowCount > 1 ? 's' : ''} auto-flagged
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              No-show leads are automatically flagged and their lead score is reduced by 20 pts. Consider a re-engagement follow-up.
            </p>
          </div>
        </div>
      )}

      {/* Hot Lead Banner */}
      {hotCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-lg mt-0.5">🔥</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {hotCount} hot {hotCount === 1 ? 'lead' : 'leads'} auto-flagged
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Leads are flagged hot when score ≥ 75 or booking is within 48 hours. Send prep docs and reminders before the session.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'hot', 'upcoming_48h', 'no_show'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-foreground text-background'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70'
              }`}
            >
              {f === 'all' ? 'All' : f === 'hot' ? '🔥 Hot' : f === 'upcoming_48h' ? '⚡ 48h' : '🚫 No-Shows'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading Calendly bookings…</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-center">
          <p className="text-sm font-semibold text-red-800 mb-1">Failed to load bookings</p>
          <p className="text-xs text-red-700 mb-3">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <svg className="mx-auto mb-3 text-muted-foreground/30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-sm text-muted-foreground">No bookings found for the next 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const key = row.event.uuid;
            const ls = localState[key] ?? {};
            const feedback = actionFeedback[key];
            const days = daysUntil(row.event.start_time);
            const effectiveAttendance = ls.attendanceStatus ?? row.attendanceStatus;
            const effectiveNoShow = effectiveAttendance === 'no_show' || row.noShowFlagged;

            return (
              <div
                key={key}
                className={`bg-card border rounded-xl p-4 transition-all ${
                  effectiveNoShow
                    ? 'border-red-200 bg-red-50/30'
                    : effectiveAttendance === 'attended' ?'border-emerald-200 bg-emerald-50/20'
                    : row.isHot
                    ? 'border-red-200 shadow-sm shadow-red-50'
                    : 'border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left: attendee + time */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {/* Attendance badge — always shown */}
                      <AttendanceBadge status={effectiveAttendance} noShowFlagged={effectiveNoShow} />
                      {row.isHot && effectiveAttendance === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-bold uppercase tracking-wide">
                          🔥 Hot Lead
                        </span>
                      )}
                      {days <= 1 && effectiveAttendance === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold">
                          ⚡ Today
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-foreground text-sm truncate">
                      {row.invitee?.name ?? 'Unknown Attendee'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{row.invitee?.email ?? '—'}</p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {formatDateTime(row.event.start_time)}
                      </span>
                      {row.invitee?.timezone && (
                        <span className="flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {row.invitee.timezone.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: service interest + score */}
                  <div className="sm:w-56 shrink-0">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Service Interest</p>
                    <p className="text-sm text-foreground font-medium leading-snug line-clamp-2">{row.serviceInterest}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">Lead Score</p>
                      <ScoreBadge score={row.leadScore} />
                      {effectiveAttendance === 'attended' && (
                        <span className="text-xs text-emerald-600 font-semibold">+15</span>
                      )}
                      {effectiveNoShow && (
                        <span className="text-xs text-red-600 font-semibold">-20</span>
                      )}
                    </div>
                    {row.invitee?.tracking?.utm_source && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: <span className="text-foreground">{row.invitee.tracking.utm_source}</span>
                      </p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="sm:w-48 shrink-0 flex flex-col gap-2">
                    {/* Attendance marking buttons */}
                    {effectiveAttendance === 'pending' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleMarkAttendance(row, 'attended')}
                          disabled={markingAttendance[key]}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60"
                          title="Mark as Attended"
                        >
                          {markingAttendance[key] ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : '✅'}
                          Attended
                        </button>
                        <button
                          onClick={() => handleMarkAttendance(row, 'no_show')}
                          disabled={markingAttendance[key]}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all disabled:opacity-60"
                          title="Mark as No-Show"
                        >
                          {markingAttendance[key] ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : '🚫'}
                          No-Show
                        </button>
                      </div>
                    )}

                    {feedback === 'marked_attended' && (
                      <p className="text-xs text-emerald-700 font-semibold py-1">✅ Marked attended (+15 pts)</p>
                    )}
                    {feedback === 'marked_noshow' && (
                      <p className="text-xs text-red-700 font-semibold py-1">🚫 Flagged no-show (-20 pts)</p>
                    )}

                    {feedback === 'sending_reminder' || feedback === 'sending_prep' ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </div>
                    ) : feedback === 'reminder_sent' ? (
                      <p className="text-xs text-green-700 font-semibold py-1">✓ Reminder sent</p>
                    ) : feedback === 'prep_sent' ? (
                      <p className="text-xs text-green-700 font-semibold py-1">✓ Prep docs sent</p>
                    ) : feedback === 'error' ? (
                      <p className="text-xs text-red-600 py-1">Failed — try again</p>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSendPrep(row)}
                          disabled={ls.prepSent}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            ls.prepSent
                              ? 'bg-green-50 text-green-700 border border-green-200 cursor-default' :'bg-foreground text-background hover:opacity-80'
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          {ls.prepSent ? 'Prep Sent ✓' : 'Send Prep Docs'}
                        </button>
                        <button
                          onClick={() => handleSendReminder(row)}
                          disabled={ls.reminderSent || !row.invitee?.text_reminder_number}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            ls.reminderSent
                              ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                              : !row.invitee?.text_reminder_number
                              ? 'bg-secondary/30 text-muted-foreground border-border cursor-not-allowed'
                              : 'bg-card text-foreground border-border hover:bg-secondary/40'
                          }`}
                          title={!row.invitee?.text_reminder_number ? 'No phone number on file' : ''}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.72 16z"/>
                          </svg>
                          {ls.reminderSent ? 'Reminder Sent ✓' : 'SMS Reminder'}
                        </button>
                      </>
                    )}

                    {/* Q&A preview */}
                    {(row.invitee?.questions_and_answers?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-open:rotate-90 transition-transform">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                          {row.invitee!.questions_and_answers!.length} intake {row.invitee!.questions_and_answers!.length === 1 ? 'answer' : 'answers'}
                        </summary>
                        <div className="mt-2 space-y-1.5 pl-3 border-l border-border">
                          {row.invitee!.questions_and_answers!.map((qa, i) => (
                            <div key={i}>
                              <p className="text-[10px] text-muted-foreground">{qa.question}</p>
                              <p className="text-xs text-foreground">{qa.answer}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Attended: +15 pts</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />No-Show: -20 pts, auto-flagged</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Rescheduled: -5 pts</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Score ≥ 75 or within 48h = Hot</span>
      </div>
    </div>
  );
}
