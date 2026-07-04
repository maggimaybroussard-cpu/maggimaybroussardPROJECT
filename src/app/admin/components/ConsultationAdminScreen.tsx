'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Consultation {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  status: string;
  notes: string | null;
  booking_stage: string;
  calendly_event_uuid: string | null;
  calendly_start_time: string | null;
  calendly_end_time: string | null;
  calendly_event_name: string | null;
  calendly_meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ['new', 'in_review', 'contacted', 'confirmed', 'completed', 'closed'];
const STAGE_OPTIONS = ['inquiry', 'consultation_booked', 'proposal_sent', 'active_client', 'completed', 'closed'];

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  contacted: 'bg-purple-100 text-purple-700 border-purple-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Booked',
  proposal_sent: 'Proposal Sent',
  active_client: 'Active Client',
  completed: 'Completed',
  closed: 'Closed',
};

const STAGE_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-100 text-blue-700',
  consultation_booked: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-amber-100 text-amber-700',
  active_client: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type FilterTime = 'all' | 'upcoming' | 'past';

export default function ConsultationAdminScreen() {
  const supabase = createClient();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<FilterTime>('all');
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, new: 0, completed: 0 });

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/consultations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch consultations');
      const json = await res.json();
      const list: Consultation[] = json.consultations || [];
      setConsultations(list);

      const now = new Date();
      setStats({
        total: list.length,
        upcoming: list.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) > now).length,
        new: list.filter((c) => c.status === 'new').length,
        completed: list.filter((c) => c.status === 'completed').length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status);
      setEditStage(selected.booking_stage);
      setEditNotes(selected.notes ?? '');
    }
  }, [selected]);

  useEffect(() => {
    if (saveMsg) {
      const t = setTimeout(() => setSaveMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [saveMsg]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { error: err } = await supabase
        .from('contact_inquiries')
        .update({
          status: editStatus,
          booking_stage: editStage,
          notes: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);
      if (err) throw err;
      setSaveMsg({ type: 'success', text: 'Consultation updated.' });
      setSelected((prev) => prev ? { ...prev, status: editStatus, booking_stage: editStage, notes: editNotes || null } : null);
      setConsultations((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, status: editStatus, booking_stage: editStage, notes: editNotes || null } : c)
      );
    } catch (err) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendAlert = async () => {
    if (!selected) return;
    setSendingAlert(true);
    setAlertMsg(null);
    try {
      const res = await fetch('/api/admin/consultations/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId: selected.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setAlertMsg({ type: 'success', text: 'Alert email sent.' });
    } catch (err) {
      setAlertMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send alert' });
    } finally {
      setSendingAlert(false);
    }
  };

  const now = new Date();
  const filtered = consultations.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.service.toLowerCase().includes(search.toLowerCase());
    const matchTime =
      timeFilter === 'all' ||
      (timeFilter === 'upcoming' && c.calendly_start_time && new Date(c.calendly_start_time) > now) ||
      (timeFilter === 'past' && (!c.calendly_start_time || new Date(c.calendly_start_time) <= now));
    return matchSearch && matchTime;
  });

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-secondary/40' },
          { label: 'Upcoming', value: stats.upcoming, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'New / Unreviewed', value: stats.new, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-border`}>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer min-w-[140px]"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {(['all', 'upcoming', 'past'] as FilterTime[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                timeFilter === t ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={fetchConsultations}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Main Grid */}
      <div className={`grid gap-6 ${selected ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Table */}
        <div className={selected ? 'lg:col-span-3' : 'col-span-1'}>
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-secondary animate-pulse rounded mb-1.5" />
                    <div className="w-24 h-3 bg-secondary/70 animate-pulse rounded" />
                  </div>
                  <div className="w-20 h-5 bg-secondary animate-pulse rounded-full hidden sm:block" />
                  <div className="w-16 h-5 bg-secondary animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No consultations match your filters.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Scheduled</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Stage</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(selected?.id === c.id ? null : c)}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          selected?.id === c.id ? 'bg-primary/5' : i % 2 === 0 ? 'hover:bg-secondary/30' : 'bg-secondary/10 hover:bg-secondary/30'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>
                          <p className="text-xs text-muted-foreground/70 mt-0.5 sm:hidden">{c.service}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          {c.calendly_start_time ? (
                            <>
                              <p className="text-xs font-medium text-foreground">
                                {new Date(c.calendly_start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(c.calendly_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' })}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_COLORS[c.booking_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STAGE_LABELS[c.booking_stage] ?? c.booking_stage}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
                Showing {filtered.length} of {consultations.length} consultations
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-28 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-xl text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.firm || selected.service}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  {selected.email}
                </a>
                {selected.calendly_start_time && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {formatDateTime(selected.calendly_start_time)}
                  </div>
                )}
                {selected.calendly_meeting_location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span className="truncate">{selected.calendly_meeting_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Submitted {formatDate(selected.created_at)}
                </div>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        editStatus === s ? STATUS_COLORS[s] : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking Stage */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Booking Stage</p>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none"
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Internal Notes</p>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add internal notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all resize-none"
                />
              </div>

              {/* Save */}
              {saveMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {saveMsg.text}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : null}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-border space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`mailto:${selected.email}?subject=Re: Your Consultation — Maggi May Broussard`}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Reply
                  </a>
                  <button
                    onClick={handleSendAlert}
                    disabled={sendingAlert}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60"
                  >
                    {sendingAlert ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    )}
                    Send Alert
                  </button>
                </div>
                {alertMsg && (
                  <p className={`text-xs font-medium ${alertMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {alertMsg.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
