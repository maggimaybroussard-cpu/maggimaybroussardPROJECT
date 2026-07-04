'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NurtureSequence {
  id: string;
  inquiry_id: string | null;
  email: string;
  name: string;
  trigger_type: 'form_submission' | 'abandoned_booking' | 'intake_incomplete' | 'consultation_no_show' | 'post_consultation_no_convert';
  sequence_status: 'active' | 'paused' | 'completed' | 'converted' | 'unsubscribed';
  current_step: number;
  total_steps: number;
  lead_score: number;
  score_tier: 'hot' | 'warm' | 'cold';
  last_email_sent_at: string | null;
  next_email_scheduled_at: string | null;
  converted_at: string | null;
  conversion_type: string | null;
  created_at: string;
}

interface AbandonedBooking {
  id: string;
  inquiry_id: string | null;
  email: string;
  name: string;
  abandoned_at: string;
  booking_page_reached: string | null;
  service_interest: string | null;
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  sequence_status: 'active' | 'paused' | 'completed' | 'converted' | 'unsubscribed';
  recovered_at: string | null;
  lead_score: number;
  created_at: string;
}

interface NurtureStats {
  totalActive: number;
  totalConverted: number;
  totalAbandoned: number;
  recoveredAbandoned: number;
  avgLeadScore: number;
  hotLeads: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreFill(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 45) return '#f59e0b';
  return '#60a5fa';
}

function tierBadge(tier: 'hot' | 'warm' | 'cold') {
  if (tier === 'hot') return 'bg-red-100 text-red-700 border-red-200';
  if (tier === 'warm') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-600 border-blue-200';
}

const TRIGGER_LABELS: Record<string, string> = {
  form_submission: 'Form Submission',
  abandoned_booking: 'Abandoned Booking',
  intake_incomplete: 'Incomplete Intake',
  consultation_no_show: 'No-Show',
  post_consultation_no_convert: 'Post-Consult',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-600',
  converted: 'bg-green-100 text-green-700',
  unsubscribed: 'bg-red-100 text-red-600',
};

// ── Step Progress Bar ─────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{current}/{total}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LeadNurtureSequencesDashboard() {
  const [activeView, setActiveView] = useState<'nurture' | 'abandoned'>('nurture');
  const [sequences, setSequences] = useState<NurtureSequence[]>([]);
  const [abandoned, setAbandoned] = useState<AbandonedBooking[]>([]);
  const [stats, setStats] = useState<NurtureStats>({
    totalActive: 0,
    totalConverted: 0,
    totalAbandoned: 0,
    recoveredAbandoned: 0,
    avgLeadScore: 0,
    hotLeads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'converted' | 'paused'>('all');
  const [triggerFilter, setTriggerFilter] = useState<'all' | 'form_submission' | 'abandoned_booking'>('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [nurtureRes, abandonedRes] = await Promise.allSettled([
        supabase
          .from('lead_nurture_sequences')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('abandoned_booking_sequences')
          .select('*')
          .order('abandoned_at', { ascending: false })
          .limit(200),
      ]);

      const nurtureRows: NurtureSequence[] =
        nurtureRes.status === 'fulfilled' ? (nurtureRes.value.data ?? []) : [];
      const abandonedRows: AbandonedBooking[] =
        abandonedRes.status === 'fulfilled' ? (abandonedRes.value.data ?? []) : [];

      setSequences(nurtureRows);
      setAbandoned(abandonedRows);

      const active = nurtureRows.filter((r) => r.sequence_status === 'active').length;
      const converted = nurtureRows.filter((r) => r.sequence_status === 'converted').length;
      const hot = nurtureRows.filter((r) => r.score_tier === 'hot').length;
      const avg =
        nurtureRows.length > 0
          ? Math.round(nurtureRows.reduce((s, r) => s + r.lead_score, 0) / nurtureRows.length)
          : 0;
      const recovered = abandonedRows.filter((r) => r.recovered_at !== null).length;

      setStats({
        totalActive: active,
        totalConverted: converted,
        totalAbandoned: abandonedRows.length,
        recoveredAbandoned: recovered,
        avgLeadScore: avg,
        hotLeads: hot,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePauseResume = async (id: string, currentStatus: string) => {
    setActionLoading(id);
    try {
      const supabase = createClient();
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const { error: updateErr } = await supabase
        .from('lead_nurture_sequences')
        .update({ sequence_status: newStatus })
        .eq('id', id);
      if (updateErr) throw new Error(updateErr.message);
      setSequences((prev) =>
        prev.map((s) => (s.id === id ? { ...s, sequence_status: newStatus as NurtureSequence['sequence_status'] } : s))
      );
      showToast(`Sequence ${newStatus === 'active' ? 'resumed' : 'paused'}`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkConverted = async (id: string) => {
    setActionLoading(id);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from('lead_nurture_sequences')
        .update({ sequence_status: 'converted', converted_at: new Date().toISOString() })
        .eq('id', id);
      if (updateErr) throw new Error(updateErr.message);
      setSequences((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, sequence_status: 'converted', converted_at: new Date().toISOString() }
            : s
        )
      );
      showToast('Lead marked as converted', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecoverAbandoned = async (id: string) => {
    setActionLoading(id);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from('abandoned_booking_sequences')
        .update({ recovered_at: new Date().toISOString(), sequence_status: 'converted' })
        .eq('id', id);
      if (updateErr) throw new Error(updateErr.message);
      setAbandoned((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, recovered_at: new Date().toISOString(), sequence_status: 'converted' }
            : a
        )
      );
      showToast('Booking marked as recovered', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSequences = sequences.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || s.sequence_status === statusFilter;
    const matchesTrigger =
      triggerFilter === 'all' ||
      (triggerFilter === 'form_submission' && s.trigger_type === 'form_submission') ||
      (triggerFilter === 'abandoned_booking' && s.trigger_type === 'abandoned_booking');
    return matchesSearch && matchesStatus && matchesTrigger;
  });

  const filteredAbandoned = abandoned.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.service_interest ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ?'bg-emerald-600 text-white' :'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Sequences', value: stats.totalActive, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Converted', value: stats.totalConverted, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          { label: '🔥 Hot Leads', value: stats.hotLeads, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Avg Lead Score', value: stats.avgLeadScore, color: 'text-foreground', bg: 'bg-card' },
          { label: 'Abandoned', value: stats.totalAbandoned, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Recovered', value: stats.recoveredAbandoned, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-border rounded-2xl p-4`}>
            <p className="text-xs text-muted-foreground font-medium mb-1 leading-tight">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary/40 rounded-xl p-1 gap-1">
          {(['nurture', 'abandoned'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === v
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'nurture' ? '📧 Nurture Sequences' : '🚪 Abandoned Bookings'}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="ml-auto px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        {activeView === 'nurture' && (
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="converted">Converted</option>
              <option value="paused">Paused</option>
            </select>
            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value as typeof triggerFilter)}
              className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="all">All Triggers</option>
              <option value="form_submission">Form Submission</option>
              <option value="abandoned_booking">Abandoned Booking</option>
            </select>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      )}

      {/* ── Nurture Sequences View ── */}
      {!loading && activeView === 'nurture' && (
        <>
          {filteredSequences.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p className="font-serif text-xl text-foreground mb-2">No nurture sequences yet</p>
              <p className="text-sm text-muted-foreground">Sequences are triggered automatically when forms are submitted or bookings are abandoned.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSequences.map((seq) => (
                <div key={seq.id} className="bg-card border border-border rounded-2xl p-5 hover:border-accent/30 transition-all">
                  <div className="flex items-start gap-4">
                    {/* Score circle */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ background: scoreFill(seq.lead_score) }}
                    >
                      {seq.lead_score}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{seq.name}</p>
                          <p className="text-xs text-muted-foreground">{seq.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tierBadge(seq.score_tier)}`}>
                            {seq.score_tier === 'hot' ? '🔥' : seq.score_tier === 'warm' ? '🌤' : '❄️'} {seq.score_tier}
                          </span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[seq.sequence_status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {seq.sequence_status}
                          </span>
                          <span className="text-xs bg-secondary/60 text-muted-foreground px-2.5 py-1 rounded-full">
                            {TRIGGER_LABELS[seq.trigger_type] ?? seq.trigger_type}
                          </span>
                        </div>
                      </div>

                      {/* Step progress */}
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">Sequence Progress</p>
                        <StepProgress current={seq.current_step} total={seq.total_steps} />
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {seq.last_email_sent_at && (
                          <span className="text-xs text-muted-foreground">
                            Last email: {timeAgo(seq.last_email_sent_at)}
                          </span>
                        )}
                        {seq.next_email_scheduled_at && seq.sequence_status === 'active' && (
                          <span className="text-xs text-muted-foreground">
                            Next: {formatDate(seq.next_email_scheduled_at)}
                          </span>
                        )}
                        {seq.converted_at && (
                          <span className="text-xs text-emerald-600 font-medium">
                            ✓ Converted {timeAgo(seq.converted_at)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          Started {timeAgo(seq.created_at)}
                        </span>
                      </div>

                      {/* Actions */}
                      {seq.sequence_status !== 'converted' && seq.sequence_status !== 'unsubscribed' && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handlePauseResume(seq.id, seq.sequence_status)}
                            disabled={actionLoading === seq.id}
                            className="px-3 py-1.5 rounded-lg border border-border bg-secondary/40 text-xs font-medium text-foreground hover:border-accent/50 transition-all disabled:opacity-50"
                          >
                            {actionLoading === seq.id ? '…' : seq.sequence_status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => handleMarkConverted(seq.id)}
                            disabled={actionLoading === seq.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                          >
                            Mark Converted
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Abandoned Bookings View ── */}
      {!loading && activeView === 'abandoned' && (
        <>
          {filteredAbandoned.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <p className="font-serif text-xl text-foreground mb-2">No abandoned bookings tracked</p>
              <p className="text-sm text-muted-foreground">Abandoned bookings are captured when visitors start but don&apos;t complete the booking process.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAbandoned.map((ab) => (
                <div key={ab.id} className="bg-card border border-border rounded-2xl p-5 hover:border-accent/30 transition-all">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ background: scoreFill(ab.lead_score) }}
                    >
                      {ab.lead_score}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{ab.name}</p>
                          <p className="text-xs text-muted-foreground">{ab.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[ab.sequence_status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {ab.recovered_at ? '✓ Recovered' : ab.sequence_status}
                          </span>
                          {ab.service_interest && (
                            <span className="text-xs bg-secondary/60 text-muted-foreground px-2.5 py-1 rounded-full">
                              {ab.service_interest}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          Abandoned {timeAgo(ab.abandoned_at)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Follow-ups sent: <strong className="text-foreground">{ab.follow_up_count}</strong>
                        </span>
                        {ab.last_follow_up_at && (
                          <span className="text-xs text-muted-foreground">
                            Last follow-up: {timeAgo(ab.last_follow_up_at)}
                          </span>
                        )}
                        {ab.next_follow_up_at && !ab.recovered_at && (
                          <span className="text-xs text-muted-foreground">
                            Next: {formatDate(ab.next_follow_up_at)}
                          </span>
                        )}
                        {ab.booking_page_reached && (
                          <span className="text-xs text-muted-foreground">
                            Dropped at: <em>{ab.booking_page_reached}</em>
                          </span>
                        )}
                      </div>

                      {!ab.recovered_at && ab.sequence_status !== 'unsubscribed' && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handleRecoverAbandoned(ab.id)}
                            disabled={actionLoading === ab.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                          >
                            {actionLoading === ab.id ? '…' : 'Mark Recovered'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
