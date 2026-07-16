'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'deadline' | 'court_date' | 'meeting' | 'milestone';
type EventStatus = 'upcoming' | 'completed' | 'cancelled' | 'overdue';
type ReminderInterval = 'none' | '1_hour' | '24_hours' | '48_hours' | '72_hours' | '1_week';
type FilterType = 'all' | EventType;
type FilterStatus = 'all' | EventStatus;

interface ScheduleEvent {
  id: string;
  case_id: string | null;
  case_name: string | null;
  event_type: EventType;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string | null;
  assigned_to: string | null;
  status: EventStatus;
  reminder_interval: ReminderInterval;
  reminder_sent_at: string | null;
  synced_to_portal: boolean;
  portal_notified: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  google_calendar_event_id?: string | null;
}

interface CaseOption {
  id: string;
  name: string;
  firm: string;
  service: string;
}

interface FormData {
  case_id: string;
  case_name: string;
  event_type: EventType;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  end_date: string;
  end_time: string;
  location: string;
  assigned_to: string;
  reminder_interval: ReminderInterval;
  notes: string;
  synced_to_portal: boolean;
}

interface ReminderSetting {
  id: string;
  event_type: string;
  days_before: number;
  enabled: boolean;
}

interface ReminderLog {
  id: string;
  event_id: string;
  paralegal_email: string;
  paralegal_name: string | null;
  event_type: string;
  event_title: string;
  event_date: string;
  days_before: number;
  sent_at: string;
  status: string;
  error_message: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  deadline: {
    label: 'Deadline',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  court_date: {
    label: 'Court Date',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
      </svg>
    ),
  },
  meeting: {
    label: 'Meeting',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  milestone: {
    label: 'Milestone',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
};

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200' },
};

const REMINDER_OPTIONS: { value: ReminderInterval; label: string }[] = [
  { value: 'none', label: 'No reminder' },
  { value: '1_hour', label: '1 hour before' },
  { value: '24_hours', label: '24 hours before' },
  { value: '48_hours', label: '48 hours before' },
  { value: '72_hours', label: '72 hours before' },
  { value: '1_week', label: '1 week before' },
];

const ACCENT = '#355E3B';

const EMPTY_FORM: FormData = {
  case_id: '',
  case_name: '',
  event_type: 'deadline',
  title: '',
  description: '',
  event_date: '',
  event_time: '09:00',
  end_date: '',
  end_time: '',
  location: '',
  assigned_to: '',
  reminder_interval: 'none',
  notes: '',
  synced_to_portal: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(dateStr: string) {
  let d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(dateStr: string) {
  let d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isOverdue(event: ScheduleEvent) {
  if (event.status === 'completed' || event.status === 'cancelled') return false;
  return new Date(event.event_date) < new Date();
}

function getDaysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-3xl font-semibold text-foreground" style={accent ? { color: accent } : {}}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Reminder Settings Panel ──────────────────────────────────────────────────

function ReminderSettingsPanel() {
  const supabase = createClient();
  const [settings, setSettings] = useState<ReminderSetting[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ message: string; results?: { name: string; email: string; status: string; error?: string }[] } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { data, error } = await supabase.from('reminder_settings').select('*').order('event_type');
      if (error) throw error;
      setSettings((data ?? []) as ReminderSetting[]);
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  }, [supabase]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('schedule_reminder_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setLogs((data ?? []) as ReminderLog[]);
    } catch {
      // non-blocking
    } finally {
      setLoadingLogs(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, [loadSettings, loadLogs]);

  async function handleUpdateSetting(id: string, field: 'days_before' | 'enabled', value: number | boolean) {
    setSavingId(id);
    setSettingsError(null);
    try {
      const { error } = await supabase
        .from('reminder_settings')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
      setSettings((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
      setSettingsSuccess('Settings saved');
      setTimeout(() => setSettingsSuccess(null), 2500);
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  async function handleTriggerNow() {
    setTriggering(true);
    setTriggerResult(null);
    setSettingsError(null);
    try {
      const res = await fetch('/api/admin/trigger-deadline-reminders', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trigger failed');
      setTriggerResult(data.summary ?? { sent: 0, skipped: 0, failed: 0 });
      await loadLogs();
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  async function handleSendTestReminder() {
    setTestSending(true);
    setTestResult(null);
    setSettingsError(null);
    try {
      const res = await fetch('/api/admin/test-paralegal-reminder', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test send failed');
      setTestResult({ message: data.message, results: data.results });
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Test send failed');
    } finally {
      setTestSending(false);
    }
  }

  const EVENT_TYPE_DISPLAY: Record<string, { label: string; dotClass: string }> = {
    deadline:   { label: 'Deadlines',   dotClass: 'bg-red-500'    },
    court_date: { label: 'Court Dates', dotClass: 'bg-purple-500' },
    meeting:    { label: 'Meetings',    dotClass: 'bg-blue-500'   },
    milestone:  { label: 'Milestones',  dotClass: 'bg-amber-500'  },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif text-lg text-foreground">Paralegal Email Reminders</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-send Resend email reminders to assigned paralegals before court dates, deadlines, and milestones.
          </p>
        </div>
        <button
          onClick={handleTriggerNow}
          disabled={triggering}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          style={{ background: ACCENT, color: '#fff' }}
        >
          {triggering ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Running…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Reminders Now
            </>
          )}
        </button>
        <button
          onClick={handleSendTestReminder}
          disabled={testSending}
          title="Send a test reminder email to all paralegals to verify maggimay@broussardlegalservices.com delivery"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 border"
          style={{ borderColor: ACCENT, color: ACCENT, background: 'transparent' }}
        >
          {testSending ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Sending…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Test Send
            </>
          )}
        </button>
      </div>

      {/* Feedback */}
      {settingsError && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {settingsError}
        </div>
      )}
      {settingsSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {settingsSuccess}
        </div>
      )}
      {triggerResult && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>
            Reminder run complete — <strong>{triggerResult.sent} sent</strong>
            {triggerResult.skipped > 0 && <>, {triggerResult.skipped} skipped</>}
            {triggerResult.failed > 0 && <>, <span className="text-red-600">{triggerResult.failed} failed</span></>}
          </span>
        </div>
      )}
      {testResult && (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span><strong>Test reminder sent</strong> — {testResult.message}</span>
          </div>
          {testResult.results && testResult.results.length > 0 && (
            <ul className="ml-5 mt-1 space-y-0.5 text-xs text-blue-600">
              {testResult.results.map((r, i) => (
                <li key={i}>
                  {r.status === 'delivered' ? '✅' : '❌'} {r.name} ({r.email}){r.error ? ` — ${r.error}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Settings grid */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/20">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Days Before — Per Event Type</p>
        </div>
        {loadingSettings ? (
          <div className="p-6 flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {settings.map((setting) => {
              const display = EVENT_TYPE_DISPLAY[setting.event_type] ?? { label: setting.event_type, dotClass: 'bg-muted' };
              return (
                <div key={setting.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${display.dotClass}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{display.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {setting.enabled
                          ? `Send reminder ${setting.days_before} day${setting.days_before !== 1 ? 's' : ''} before`
                          : 'Reminders disabled'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Days before input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={setting.days_before}
                        disabled={!setting.enabled || savingId === setting.id}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(30, parseInt(e.target.value) || 1));
                          setSettings((prev) => prev.map((s) => s.id === setting.id ? { ...s, days_before: v } : s));
                        }}
                        onBlur={(e) => {
                          const v = Math.max(1, Math.min(30, parseInt(e.target.value) || 1));
                          handleUpdateSetting(setting.id, 'days_before', v);
                        }}
                        className="w-16 px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all disabled:opacity-40"
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                    {/* Enable toggle */}
                    <div
                      onClick={() => handleUpdateSetting(setting.id, 'enabled', !setting.enabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${setting.enabled ? 'bg-[#355E3B]' : 'bg-muted'} ${savingId === setting.id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${setting.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-6 py-3 border-t border-border bg-secondary/10">
          <p className="text-xs text-muted-foreground">
            Reminders are sent to the paralegal listed in the <strong>Assigned To</strong> field of each event. The system matches by name against paralegal profiles, or uses the value directly if it contains an email address.
          </p>
        </div>
      </div>

      {/* Recent reminder logs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/20">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Recent Reminder Log</p>
          <button onClick={loadLogs} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Refresh</button>
        </div>
        {loadingLogs ? (
          <div className="p-6 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No reminders sent yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Reminders will appear here after the first run.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const display = EVENT_TYPE_DISPLAY[log.event_type] ?? { label: log.event_type, dotClass: 'bg-muted' };
              return (
                <div key={log.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${display.dotClass}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{log.event_title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        → {log.paralegal_name || log.paralegal_email} · {log.days_before}d before
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      log.status === 'sent' ?'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Google Calendar Sync Panel ───────────────────────────────────────────────

function GoogleCalendarSyncPanel() {
  const supabase = createClient();
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [accountEmail, setAccountEmail] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<ScheduleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = React.useState(true);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<{ synced: number; failed: number; total: number } | null>(null);

  const checkConnection = React.useCallback(async () => {
    try {
      const res = await fetch('/api/google-calendar/status');
      const data = await res.json();
      setConnected(data.connected ?? false);
      setAccountEmail(data.accountEmail ?? null);
    } catch {
      setConnected(false);
    }
  }, []);

  const loadEvents = React.useCallback(async () => {
    setLoadingEvents(true);
    try {
      const { data, error: err } = await supabase
        .from('case_schedule_events')
        .select('*')
        .in('status', ['upcoming'])
        .order('event_date', { ascending: true });
      if (err) throw err;
      setEvents((data ?? []) as ScheduleEvent[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    checkConnection();
    loadEvents();
  }, [checkConnection, loadEvents]);

  async function handleConnect() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google Client ID not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment variables.');
      return;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectUri = `${siteUrl}/api/google-calendar/callback`;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Calendar? Existing synced events will remain on your calendar.')) return;
    try {
      await fetch('/api/google-calendar/status', { method: 'DELETE' });
      setConnected(false);
      setAccountEmail(null);
      setSuccess('Google Calendar disconnected.');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to disconnect.');
    }
  }

  async function handleSyncOne(eventId: string) {
    setSyncingId(eventId);
    setError(null);
    try {
      const res = await fetch('/api/google-calendar/sync-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action: 'create' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSuccess('Event synced to Google Calendar.');
      setTimeout(() => setSuccess(null), 3000);
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRemoveOne(eventId: string) {
    setSyncingId(eventId);
    setError(null);
    try {
      const res = await fetch('/api/google-calendar/sync-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action: 'delete' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Remove failed');
      setSuccess('Event removed from Google Calendar.');
      setTimeout(() => setSuccess(null), 3000);
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleBulkSync() {
    setBulkSyncing(true);
    setBulkResult(null);
    setError(null);
    try {
      const res = await fetch('/api/google-calendar/sync-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Bulk sync failed');
      setBulkResult({ synced: data.synced, failed: data.failed, total: data.total });
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk sync failed');
    } finally {
      setBulkSyncing(false);
    }
  }

  const synced = events.filter((e) => e.google_calendar_event_id);
  const unsynced = events.filter((e) => !e.google_calendar_event_id);

  return (
    <div className="flex flex-col gap-6">
      {/* Connection card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {/* Google Calendar icon */}
            <div className="w-12 h-12 rounded-xl border border-border bg-secondary/30 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-foreground">Google Calendar Sync</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Push court dates, filing deadlines, and case milestones directly to Google Calendar.
              </p>
              {connected && accountEmail && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-700 font-medium">Connected as {accountEmail}</span>
                </div>
              )}
              {connected === false && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-muted" />
                  <span className="text-xs text-muted-foreground">Not connected</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {connected ? (
              <>
                <button
                  onClick={handleBulkSync}
                  disabled={bulkSyncing || events.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: ACCENT, color: '#fff' }}
                >
                  {bulkSyncing ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Syncing…
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                      </svg>
                      Sync All Upcoming
                    </>
                  )}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: ACCENT, color: '#fff' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {success}
        </div>
      )}
      {bulkResult && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>
            Bulk sync complete — <strong>{bulkResult.synced} synced</strong> of {bulkResult.total} events
            {bulkResult.failed > 0 && <>, <span className="text-red-600">{bulkResult.failed} failed</span></>}
          </span>
        </div>
      )}

      {!connected && connected !== null && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-foreground font-medium mb-1">Google Calendar not connected</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Connect your Google account to push court dates, deadlines, and milestones directly to your calendar.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: ACCENT, color: '#fff' }}
          >
            Connect Google Calendar
          </button>
        </div>
      )}

      {connected && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 text-center">
              <p className="text-3xl font-semibold text-foreground">{events.length}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Upcoming Events</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 text-center">
              <p className="text-3xl font-semibold" style={{ color: ACCENT }}>{synced.length}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Synced to Google</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 text-center">
              <p className="text-3xl font-semibold text-amber-600">{unsynced.length}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Not Yet Synced</p>
            </div>
          </div>

          {/* Events list */}
          {loadingEvents ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">No upcoming events to sync.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create schedule events in the List view first.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Upcoming Events — Sync Status</p>
                <p className="text-xs text-muted-foreground">{synced.length}/{events.length} synced</p>
              </div>
              <div className="divide-y divide-border">
                {events.map((event) => {
                  const cfg = EVENT_TYPE_CONFIG[event.event_type];
                  const isSynced = !!event.google_calendar_event_id;
                  const isBusy = syncingId === event.id;
                  return (
                    <div key={event.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${cfg.color}`}>
                          {cfg.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">
                              {formatEventDate(event.event_date)}
                            </p>
                            {event.case_name && (
                              <span className="text-xs text-muted-foreground/60 truncate">· {event.case_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSynced ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              On Google Cal
                            </span>
                            <button
                              onClick={() => handleSyncOne(event.id)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-40"
                              title="Re-sync to Google Calendar"
                            >
                              {isBusy ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleRemoveOne(event.id)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                              title="Remove from Google Calendar"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSyncOne(event.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40"
                          >
                            {isBusy ? (
                              <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                Syncing…
                              </>
                            ) : (
                              <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                </svg>
                                Sync to Google
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/30 border border-border">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-muted-foreground">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Events are synced to the <strong>primary</strong> calendar of the connected Google account. Court dates appear in blueberry, deadlines in tomato, meetings in lavender, and milestones in banana. Each event includes a 24-hour email reminder and a 1-hour popup reminder.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Event Form Modal ─────────────────────────────────────────────────────────

function EventFormModal({
  open,
  onClose,
  onSave,
  initial,
  cases,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => void;
  initial: FormData | null;
  cases: CaseOption[];
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial ?? EMPTY_FORM);

  useEffect(() => {
    setForm(initial ?? EMPTY_FORM);
  }, [initial, open]);

  if (!open) return null;

  function set(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCaseChange(caseId: string) {
    const found = cases.find((c) => c.id === caseId);
    setForm((prev) => ({
      ...prev,
      case_id: caseId,
      case_name: found ? `${found.name} — ${found.firm}` : '',
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-serif text-xl text-foreground">{initial?.title ? 'Edit Event' : 'New Schedule Event'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add a deadline, court date, meeting, or case milestone</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Event Type */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Event Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
                const cfg = EVENT_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('event_type', type)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.event_type === type
                        ? `${cfg.color} border-current`
                        : 'border-border text-muted-foreground hover:border-foreground/30 bg-transparent'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={
                form.event_type === 'deadline' ? 'e.g. File response to motion' :
                form.event_type === 'court_date' ? 'e.g. Hearing on motion to dismiss' :
                form.event_type === 'meeting'? 'e.g. Client intake call' : 'e.g. Discovery phase complete'
              }
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>

          {/* Case */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Linked Case</label>
            <select
              value={form.case_id}
              onChange={(e) => handleCaseChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— No case linked —</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.firm}</option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Date *</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => set('event_date', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Time</label>
              <input
                type="time"
                value={form.event_time}
                onChange={(e) => set('event_time', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>

          {/* End Date (optional) */}
          {(form.event_type === 'meeting' || form.event_type === 'court_date') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">End Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set('end_time', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
            </div>
          )}

          {/* Location & Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Location / Venue</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Courtroom 4B, Zoom link…"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Assigned To</label>
              <input
                type="text"
                value={form.assigned_to}
                onChange={(e) => set('assigned_to', e.target.value)}
                placeholder="Paralegal name or email"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description of this event…"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Reminder Notification</label>
            <select
              value={form.reminder_interval}
              onChange={(e) => set('reminder_interval', e.target.value as ReminderInterval)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Internal Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Internal notes visible only to the team…"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
            />
          </div>

          {/* Sync to Portal */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => set('synced_to_portal', !form.synced_to_portal)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.synced_to_portal ? 'bg-[#355E3B]' : 'bg-muted'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.synced_to_portal ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sync to client portal</p>
              <p className="text-xs text-muted-foreground">Client will see this event in their case status view</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.event_date}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {saving ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Saving…
              </>
            ) : initial?.title ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  event: ScheduleEvent;
  onEdit: (e: ScheduleEvent) => void;
  onStatusChange: (id: string, status: EventStatus) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.event_type];
  const statusCfg = STATUS_CONFIG[event.status];
  const overdue = isOverdue(event);
  const daysUntil = getDaysUntil(event.event_date);

  return (
    <div className={`bg-card border rounded-2xl p-5 transition-all hover:shadow-sm ${overdue && event.status === 'upcoming' ? 'border-red-200' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug">{event.title}</p>
            {event.case_name && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.case_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onEdit(event)}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-all"
            aria-label="Edit event"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-all"
            aria-label="Delete event"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Date & meta */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {formatEventDate(event.event_date)} · {formatEventTime(event.event_date)}
        </div>
        {event.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {event.location}
          </div>
        )}
        {event.assigned_to && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {event.assigned_to}
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-xs text-muted-foreground/80 mb-3 leading-relaxed">{event.description}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            overdue && event.status === 'upcoming' ? STATUS_CONFIG.overdue.color : statusCfg.color
          }`}>
            {overdue && event.status === 'upcoming' ? 'Overdue' : statusCfg.label}
          </span>
          {event.synced_to_portal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Portal
            </span>
          )}
          {event.reminder_interval !== 'none' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-50 text-slate-600 border-slate-200">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Reminder
            </span>
          )}
          {event.reminder_sent_at && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-green-50 text-green-700 border-green-200">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Email Sent
            </span>
          )}
        </div>

        {/* Days until / ago */}
        {event.status === 'upcoming' && (
          <span className={`text-[10px] font-semibold ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
          </span>
        )}

        {/* Quick status toggle */}
        {event.status !== 'completed' && event.status !== 'cancelled' && (
          <button
            onClick={() => onStatusChange(event.id, 'completed')}
            className="text-[10px] font-semibold text-muted-foreground hover:text-emerald-700 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Mark done
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchedulingDashboard() {
  const supabase = createClient();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCase, setFilterCase] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'reminders' | 'gcal'>('list');

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('case_schedule_events')
        .select('*')
        .order('event_date', { ascending: true });
      if (err) throw err;
      setEvents((data ?? []) as ScheduleEvent[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadCases = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('contact_inquiries')
        .select('id, name, firm, service')
        .order('name', { ascending: true });
      setCases((data ?? []) as CaseOption[]);
    } catch {
      // non-blocking
    }
  }, [supabase]);

  useEffect(() => {
    loadEvents();
    loadCases();
  }, [loadEvents, loadCases]);

  // ── Save event ─────────────────────────────────────────────────────────────

  async function handleSave(form: FormData) {
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);
    setError(null);

    const eventDatetime = form.event_time
      ? `${form.event_date}T${form.event_time}:00`
      : `${form.event_date}T09:00:00`;

    const endDatetime = form.end_date
      ? `${form.end_date}T${form.end_time || '17:00'}:00`
      : null;

    const payload = {
      case_id: form.case_id || null,
      case_name: form.case_name || null,
      event_type: form.event_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: eventDatetime,
      end_date: endDatetime,
      location: form.location.trim() || null,
      assigned_to: form.assigned_to.trim() || null,
      reminder_interval: form.reminder_interval,
      notes: form.notes.trim() || null,
      synced_to_portal: form.synced_to_portal,
      portal_notified: false,
    };

    try {
      if (editingEvent) {
        const { error: err } = await supabase
          .from('case_schedule_events')
          .update(payload)
          .eq('id', editingEvent.id);
        if (err) throw err;
        setSuccess('Event updated successfully');
      } else {
        const { error: err } = await supabase
          .from('case_schedule_events')
          .insert([{ ...payload, status: 'upcoming' }]);
        if (err) throw err;
        setSuccess('Event created successfully');
      }
      setShowForm(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save event');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  // ── Status change ──────────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: EventStatus) {
    try {
      const { error: err } = await supabase
        .from('case_schedule_events')
        .update({ status })
        .eq('id', id);
      if (err) throw err;
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
      const { error: err } = await supabase
        .from('case_schedule_events')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete event');
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function handleEdit(event: ScheduleEvent) {
    setEditingEvent(event);
    setShowForm(true);
  }

  function getEditFormData(event: ScheduleEvent): FormData {
    let d = new Date(event.event_date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    let endDateStr = '';
    let endTimeStr = '';
    if (event.end_date) {
      const ed = new Date(event.end_date);
      endDateStr = `${ed.getFullYear()}-${pad(ed.getMonth() + 1)}-${pad(ed.getDate())}`;
      endTimeStr = `${pad(ed.getHours())}:${pad(ed.getMinutes())}`;
    }

    return {
      case_id: event.case_id ?? '',
      case_name: event.case_name ?? '',
      event_type: event.event_type,
      title: event.title,
      description: event.description ?? '',
      event_date: dateStr,
      event_time: timeStr,
      end_date: endDateStr,
      end_time: endTimeStr,
      location: event.location ?? '',
      assigned_to: event.assigned_to ?? '',
      reminder_interval: event.reminder_interval,
      notes: event.notes ?? '',
      synced_to_portal: event.synced_to_portal,
    };
  }

  // ── Filtered events ────────────────────────────────────────────────────────

  const filtered = events.filter((e) => {
    const effectiveStatus: EventStatus = isOverdue(e) && e.status === 'upcoming' ? 'overdue' : e.status;
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    if (filterStatus !== 'all' && effectiveStatus !== filterStatus) return false;
    if (filterCase !== 'all' && e.case_id !== filterCase) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.case_name ?? '').toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.assigned_to ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const upcoming = events.filter((e) => e.status === 'upcoming' && !isOverdue(e));
  const overdueEvents = events.filter((e) => isOverdue(e) && e.status === 'upcoming');
  const thisWeek = upcoming.filter((e) => getDaysUntil(e.event_date) <= 7 && getDaysUntil(e.event_date) >= 0);
  const completed = events.filter((e) => e.status === 'completed');

  // ── Calendar view helpers ──────────────────────────────────────────────────

  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  function getCalendarDays() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }

  function getEventsForDay(day: number) {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    return filtered.filter((e) => {
      let d = new Date(e.event_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const calDays = getCalendarDays();
  const today = new Date();

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Upcoming" value={upcoming.length} sub="Active schedule events" />
        <StatCard label="This Week" value={thisWeek.length} sub="Events in next 7 days" accent={thisWeek.length > 0 ? ACCENT : undefined} />
        <StatCard label="Overdue" value={overdueEvents.length} sub="Past due, not completed" accent={overdueEvents.length > 0 ? '#dc2626' : undefined} />
        <StatCard label="Completed" value={completed.length} sub="All time" />
      </div>

      {/* Overdue alert */}
      {overdueEvents.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">{overdueEvents.length} overdue {overdueEvents.length === 1 ? 'event' : 'events'}</p>
            <p className="text-xs text-red-600 mt-0.5">{overdueEvents.map((e) => e.title).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, cases…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
        >
          <option value="all">All Types</option>
          {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_CONFIG[t].label}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as EventStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Case filter */}
        {cases.length > 0 && (
          <select
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all max-w-48"
          >
            <option value="all">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl border border-border bg-secondary/30">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('reminders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'reminders' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Reminders
          </button>
          <button
            onClick={() => setViewMode('gcal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'gcal' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Google Cal
          </button>
        </div>

        {/* New event */}
        <button
          onClick={() => { setEditingEvent(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 ml-auto"
          style={{ background: ACCENT, color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Event
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {success}
        </div>
      )}

      {/* ── Reminders View ── */}
      {viewMode === 'reminders' && <ReminderSettingsPanel />}

      {/* ── Google Calendar Sync View ── */}
      {viewMode === 'gcal' && <GoogleCalendarSyncPanel />}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-muted/50" />
                    <div className="flex-1">
                      <div className="w-3/4 h-4 bg-muted/60 rounded mb-1.5" />
                      <div className="w-1/2 h-3 bg-muted/40 rounded" />
                    </div>
                  </div>
                  <div className="w-full h-3 bg-muted/40 rounded mb-2" />
                  <div className="w-2/3 h-3 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-foreground font-medium mb-1">No events found</p>
              <p className="text-sm text-muted-foreground mb-5">
                {search || filterType !== 'all' || filterStatus !== 'all' ? 'Try adjusting your filters.' : 'Create your first deadline, court date, meeting, or milestone.'}
              </p>
              {!search && filterType === 'all' && filterStatus === 'all' && (
                <button
                  onClick={() => { setEditingEvent(null); setShowForm(true); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                  style={{ background: ACCENT, color: '#fff' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Create First Event
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Group by type */}
              {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
                const group = filtered.filter((e) => e.event_type === type);
                if (group.length === 0) return null;
                const cfg = EVENT_TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{cfg.label}s</h3>
                      <span className="text-xs text-muted-foreground/60">({group.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onEdit={handleEdit}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ── Calendar View ── */}
      {viewMode === 'calendar' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h3 className="font-serif text-lg text-foreground">
              {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day !== null &&
                today.getFullYear() === calMonth.getFullYear() &&
                today.getMonth() === calMonth.getMonth() &&
                today.getDate() === day;

              return (
                <div
                  key={idx}
                  className={`min-h-24 p-2 border-b border-r border-border last:border-r-0 ${
                    day === null ? 'bg-secondary/20' : 'bg-card hover:bg-secondary/10 transition-colors'
                  }`}
                >
                  {day !== null && (
                    <>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                        isToday ? 'text-white' : 'text-foreground'
                      }`} style={isToday ? { background: ACCENT } : {}}>
                        {day}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const cfg = EVENT_TYPE_CONFIG[e.event_type];
                          return (
                            <button
                              key={e.id}
                              onClick={() => { handleEdit(e); }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${cfg.color} hover:opacity-80 transition-opacity`}
                            >
                              {e.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 py-3 border-t border-border bg-secondary/20">
            {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
              const cfg = EVENT_TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm border ${cfg.color}`} />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form modal */}
      <EventFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingEvent(null); }}
        onSave={handleSave}
        initial={editingEvent ? getEditFormData(editingEvent) : null}
        cases={cases}
        saving={saving}
      />
    </div>
  );
}