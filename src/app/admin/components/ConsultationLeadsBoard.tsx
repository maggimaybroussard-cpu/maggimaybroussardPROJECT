'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  client_name: string;
  client_email: string;
  booking_type: string;
  booking_date: string;
  booking_time: string;
  timezone: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  meeting_location: string | null;
  source: string | null;
  intake_form_status: string | null;
  intake_sent_at: string | null;
  intake_completed_at: string | null;
  conversion_status: string | null;
  converted_at: string | null;
  follow_up_due_at: string | null;
  follow_up_sent_at: string | null;
  follow_up_notes: string | null;
  calendly_event_uuid: string | null;
  calendly_event_name: string | null;
  calendly_meeting_location: string | null;
  gcal_event_id: string | null;
  gcal_event_title: string | null;
  gcal_html_link: string | null;
  lead_score: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTAKE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  completed: 'Completed',
  skipped: 'Skipped',
};

const INTAKE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  sent: 'bg-blue-50 text-blue-700 border border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  skipped: 'bg-gray-50 text-gray-500 border border-gray-200',
};

const CONVERSION_STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  client: 'Client',
  lost: 'Lost',
};

const CONVERSION_STATUS_COLORS: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-700 border border-blue-200',
  prospect: 'bg-purple-50 text-purple-700 border border-purple-200',
  client: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  lost: 'bg-red-50 text-red-600 border border-red-200',
};

const SOURCE_LABELS: Record<string, string> = {
  calendly: 'Calendly',
  google_calendar: 'Google Calendar',
  direct: 'Direct',
  portal: 'Portal',
  referral: 'Referral',
};

const SOURCE_ICONS: Record<string, string> = {
  calendly: '📅',
  google_calendar: '🗓️',
  direct: '🔗',
  portal: '🏠',
  referral: '👥',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function getBookingDateTime(lead: Lead): string {
  if (!lead.booking_date) return '—';
  const d = new Date(`${lead.booking_date}T${lead.booking_time || '00:00'}:00`);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: lead.timezone || 'America/Chicago',
    timeZoneName: 'short',
  });
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryStats({ leads }: { leads: Lead[] }) {
  const total = leads.length;
  const pendingIntake = leads.filter((l) => l.intake_form_status === 'pending').length;
  const converted = leads.filter((l) => l.conversion_status === 'client').length;
  const overdueFollowUp = leads.filter(
    (l) => l.follow_up_due_at && isOverdue(l.follow_up_due_at) && l.conversion_status !== 'client'
  ).length;
  const fromCalendly = leads.filter((l) => l.source === 'calendly').length;
  const fromGcal = leads.filter((l) => l.source === 'google_calendar').length;

  const stats = [
    { label: 'Total Leads', value: total, color: 'text-slate-700', bg: 'bg-slate-50', icon: '👥' },
    { label: 'Pending Intake', value: pendingIntake, color: 'text-amber-700', bg: 'bg-amber-50', icon: '📋' },
    { label: 'Converted', value: converted, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✅' },
    { label: 'Overdue Follow-ups', value: overdueFollowUp, color: 'text-red-700', bg: 'bg-red-50', icon: '⚠️' },
    { label: 'From Calendly', value: fromCalendly, color: 'text-blue-700', bg: 'bg-blue-50', icon: '📅' },
    { label: 'From Google Cal', value: fromGcal, color: 'text-indigo-700', bg: 'bg-indigo-50', icon: '🗓️' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-xl p-4 flex flex-col gap-1`}>
          <span className="text-xl">{s.icon}</span>
          <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
          <span className="text-xs text-gray-500 leading-tight">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadDetailPanel({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (updated: Partial<Lead>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [intakeStatus, setIntakeStatus] = useState(lead.intake_form_status || 'pending');
  const [conversionStatus, setConversionStatus] = useState(lead.conversion_status || 'lead');
  const [followUpDue, setFollowUpDue] = useState(
    lead.follow_up_due_at ? lead.follow_up_due_at.slice(0, 16) : ''
  );
  const [followUpNotes, setFollowUpNotes] = useState(lead.follow_up_notes || '');

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const supabase = createClient();
      const updates: Partial<Lead> = {
        intake_form_status: intakeStatus,
        conversion_status: conversionStatus,
        follow_up_due_at: followUpDue ? new Date(followUpDue).toISOString() : null,
        follow_up_notes: followUpNotes || null,
      };
      const wasNotCompleted = lead.intake_form_status !== 'completed';
      if (intakeStatus === 'completed' && wasNotCompleted) {
        (updates as Record<string, unknown>).intake_completed_at = new Date().toISOString();
      }
      if (conversionStatus === 'client' && !lead.converted_at) {
        (updates as Record<string, unknown>).converted_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('consultation_bookings')
        .update(updates)
        .eq('id', lead.id);
      if (error) throw error;
      onUpdate(updates);

      // ── Send status-change email when conversion_status changes ──────────
      const statusChanged = conversionStatus !== (lead.conversion_status || 'lead');
      if (statusChanged && lead.client_email) {
        try {
          await fetch('/api/admin/leads/send-status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName: lead.client_name,
              clientEmail: lead.client_email,
              newStatus: conversionStatus,
              previousStatus: lead.conversion_status || 'lead',
              matterName: lead.calendly_event_name || lead.booking_type?.replace(/_/g, ' ') || undefined,
              bookingType: lead.booking_type || undefined,
            }),
          });
        } catch {
          // Non-blocking — status was saved; email failure is logged silently
        }
      }

      // ── Auto-generate matter when intake is marked complete ──────────────
      if (intakeStatus === 'completed' && wasNotCompleted) {
        const matterName = `${lead.client_name} — ${lead.booking_type?.replace(/_/g, ' ') || lead.calendly_event_name || 'Legal Matter'}`;
        const caseType = lead.booking_type?.replace(/_/g, ' ') || lead.calendly_event_name || 'General';
        const generatedAt = new Date().toISOString();
        const { error: matterErr } = await supabase.from('auto_generated_matters').insert({
          booking_id: lead.id,
          matter_name: matterName,
          client_name: lead.client_name,
          client_email: lead.client_email,
          case_type: caseType,
          retainer_amount: null,
          retainer_paid: false,
          matter_status: 'open',
          first_time_log_date: new Date().toISOString().slice(0, 10),
          first_time_log_hours: 0.5,
          first_time_log_desc: 'Initial intake review and matter setup',
          first_time_log_rate: null,
          auto_generated: true,
          generated_from: 'intake_complete',
          notes: lead.notes || null,
        });
        if (!matterErr) {
          // ── Send branded welcome email to client ─────────────────────────
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
            await fetch(`${supabaseUrl}/functions/v1/send-matter-welcome-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
                apikey: supabaseAnonKey,
              },
              body: JSON.stringify({
                client_name: lead.client_name,
                client_email: lead.client_email,
                matter_name: matterName,
                case_type: caseType,
                matter_status: 'open',
                retainer_amount: null,
                generated_at: generatedAt,
              }),
            });
            setSaveMsg({ type: 'success', text: '✓ Lead updated. Matter auto-generated & welcome email sent to client.' });
          } catch {
            setSaveMsg({ type: 'success', text: '✓ Lead updated. Matter auto-generated. (Welcome email could not be sent.)' });
          }
        } else {
          setSaveMsg({ type: 'success', text: 'Lead updated. (Matter generation note: ' + matterErr.message + ')' });
        }
      } else {
        const statusChanged = conversionStatus !== (lead.conversion_status || 'lead');
        setSaveMsg({
          type: 'success',
          text: statusChanged
            ? `✓ Lead updated. Status email sent to ${lead.client_email}.`
            : 'Lead updated successfully.',
        });
      }
    } catch (err) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFollowUpSent = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      await supabase
        .from('consultation_bookings')
        .update({ follow_up_sent_at: now })
        .eq('id', lead.id);
      onUpdate({ follow_up_sent_at: now });
      setSaveMsg({ type: 'success', text: 'Follow-up marked as sent.' });
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendIntakeForm = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      await supabase
        .from('consultation_bookings')
        .update({ intake_form_status: 'sent', intake_sent_at: now })
        .eq('id', lead.id);
      setIntakeStatus('sent');
      onUpdate({ intake_form_status: 'sent', intake_sent_at: now });
      setSaveMsg({ type: 'success', text: 'Intake form marked as sent.' });
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{lead.client_name}</h2>
            <p className="text-sm text-gray-500">{lead.client_email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Booking Info */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Booking Details</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time</span>
                <span className="font-medium text-gray-800">{getBookingDateTime(lead)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-800">{lead.duration_minutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-800 capitalize">{lead.booking_type?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-800">{lead.meeting_location || lead.calendly_meeting_location || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="font-medium text-gray-800">
                  {SOURCE_ICONS[lead.source || 'direct']} {SOURCE_LABELS[lead.source || 'direct'] || lead.source}
                </span>
              </div>
              {lead.calendly_event_uuid && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Calendly Event</span>
                  <span className="font-medium text-gray-800 text-xs truncate max-w-[200px]">{lead.calendly_event_name || lead.calendly_event_uuid}</span>
                </div>
              )}
              {lead.gcal_html_link && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Google Calendar</span>
                  <a
                    href={lead.gcal_html_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {lead.gcal_event_title || 'View Event →'}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Intake Form Status */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Intake Form</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <select
                  value={intakeStatus}
                  onChange={(e) => setIntakeStatus(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(INTAKE_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {intakeStatus === 'pending' && (
                  <button
                    onClick={handleSendIntakeForm}
                    disabled={saving}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    Mark Sent
                  </button>
                )}
              </div>
              {lead.intake_sent_at && (
                <p className="text-xs text-gray-500">Sent: {formatDateTime(lead.intake_sent_at)}</p>
              )}
              {lead.intake_completed_at && (
                <p className="text-xs text-emerald-600">✓ Completed: {formatDateTime(lead.intake_completed_at)}</p>
              )}
            </div>
          </section>

          {/* Conversion Status */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conversion Status</h3>
            <select
              value={conversionStatus}
              onChange={(e) => setConversionStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CONVERSION_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {lead.converted_at && (
              <p className="text-xs text-emerald-600 mt-1">✓ Converted: {formatDateTime(lead.converted_at)}</p>
            )}
          </section>

          {/* Follow-up Reminder */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Follow-up Reminder</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due Date & Time</label>
                <input
                  type="datetime-local"
                  value={followUpDue}
                  onChange={(e) => setFollowUpDue(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {followUpDue && isOverdue(followUpDue) && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Overdue</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
                  placeholder="Follow-up notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {lead.follow_up_sent_at ? (
                <p className="text-xs text-emerald-600">✓ Follow-up sent: {formatDateTime(lead.follow_up_sent_at)}</p>
              ) : (
                <button
                  onClick={handleMarkFollowUpSent}
                  disabled={saving}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  Mark follow-up as sent
                </button>
              )}
            </div>
          </section>

          {lead.notes && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{lead.notes}</p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          {saveMsg && (
            <p className={`text-xs mb-2 ${saveMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {saveMsg.text}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConsultationLeadsBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [intakeFilter, setIntakeFilter] = useState('all');
  const [conversionFilter, setConversionFilter] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('consultation_bookings')
        .select('*')
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false });
      if (err) throw err;
      setLeads((data as Lead[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Sync from Calendly via existing webhook data already stored in contact_inquiries
  const handleSyncCalendly = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      // Pull Calendly-sourced contact inquiries that have calendly_event_uuid
      // and upsert them as consultation_bookings leads
      const supabase = createClient();
      const { data: inquiries, error: err } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, calendly_event_uuid, calendly_invitee_uuid, calendly_start_time, calendly_end_time, calendly_event_name, calendly_meeting_location, created_at')
        .not('calendly_event_uuid', 'is', null)
        .limit(50);
      if (err) throw err;

      if (!inquiries || inquiries.length === 0) {
        setSyncMsg('No Calendly bookings found in contact inquiries.');
        return;
      }

      let upserted = 0;
      for (const inq of inquiries as Record<string, unknown>[]) {
        if (!inq.calendly_start_time) continue;
        const startDate = new Date(inq.calendly_start_time as string);
        const bookingDate = startDate.toISOString().slice(0, 10);
        const bookingTime = startDate.toTimeString().slice(0, 5);

        const { error: upsertErr } = await supabase
          .from('consultation_bookings')
          .upsert(
            {
              inquiry_id: inq.id,
              client_name: inq.name,
              client_email: inq.email,
              booking_type: 'initial_consultation',
              booking_date: bookingDate,
              booking_time: bookingTime,
              timezone: 'America/Chicago',
              duration_minutes: 30,
              status: 'confirmed',
              source: 'calendly',
              calendly_event_uuid: inq.calendly_event_uuid,
              calendly_invitee_uuid: inq.calendly_invitee_uuid,
              calendly_event_name: inq.calendly_event_name,
              calendly_meeting_location: inq.calendly_meeting_location,
              intake_form_status: 'pending',
              conversion_status: 'lead',
            },
            { onConflict: 'inquiry_id', ignoreDuplicates: false }
          );
        if (!upsertErr) upserted++;
      }
      setSyncMsg(`Synced ${upserted} Calendly booking(s) into leads table.`);
      await fetchLeads();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  // Sync from Google Calendar events already stored in contact_inquiries / consultation_bookings
  const handleSyncGoogleCalendar = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/google-calendar/upcoming-events');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const events: Array<{
        id: string;
        summary?: string;
        htmlLink?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string };
        attendees?: Array<{ email: string; displayName?: string }>;
        description?: string;
      }> = json.events || [];

      if (events.length === 0) {
        setSyncMsg('No upcoming Google Calendar events found.');
        return;
      }

      const supabase = createClient();
      let upserted = 0;

      for (const ev of events) {
        const startRaw = ev.start?.dateTime || ev.start?.date;
        if (!startRaw) continue;
        const startDate = new Date(startRaw);
        const bookingDate = startDate.toISOString().slice(0, 10);
        const bookingTime = startDate.toTimeString().slice(0, 5);

        // Try to extract client email from attendees (first non-organizer)
        const attendee = ev.attendees?.find((a) => a.email !== 'maggimaybroussard@gmail.com');
        const clientEmail = attendee?.email || 'unknown@gcal.import';
        const clientName = attendee?.displayName || ev.summary || 'Google Calendar Lead';

        // Check if already exists by gcal_event_id
        const { data: existing } = await supabase
          .from('consultation_bookings')
          .select('id')
          .eq('gcal_event_id', ev.id)
          .maybeSingle();

        const payload = {
          client_name: clientName,
          client_email: clientEmail,
          booking_type: 'initial_consultation',
          booking_date: bookingDate,
          booking_time: bookingTime,
          timezone: 'America/Chicago',
          duration_minutes: 30,
          status: 'confirmed',
          source: 'google_calendar',
          gcal_event_id: ev.id,
          gcal_event_title: ev.summary || null,
          gcal_html_link: ev.htmlLink || null,
          intake_form_status: 'pending',
          conversion_status: 'lead',
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from('consultation_bookings')
            .update({ gcal_event_title: ev.summary || null, gcal_html_link: ev.htmlLink || null })
            .eq('id', existing.id);
          if (!updateErr) upserted++;
        } else {
          const { error: insertErr } = await supabase
            .from('consultation_bookings')
            .insert(payload);
          if (!insertErr) upserted++;
        }
      }
      setSyncMsg(`Synced ${upserted} Google Calendar event(s) into leads table.`);
      await fetchLeads();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Google Calendar sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  // Filter leads
  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    if (q && !l.client_name.toLowerCase().includes(q) && !l.client_email.toLowerCase().includes(q)) return false;
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
    if (intakeFilter !== 'all' && l.intake_form_status !== intakeFilter) return false;
    if (conversionFilter !== 'all' && l.conversion_status !== conversionFilter) return false;
    if (showOverdueOnly && (!l.follow_up_due_at || !isOverdue(l.follow_up_due_at))) return false;
    return true;
  });

  const handleLeadUpdate = (id: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Consultation Leads</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Centralized view of all booked consultations from Calendly &amp; Google Calendar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncCalendly}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <span>📅</span>
            {syncing ? 'Syncing…' : 'Sync Calendly'}
          </button>
          <button
            onClick={handleSyncGoogleCalendar}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <span>🗓️</span>
            {syncing ? 'Syncing…' : 'Sync Google Cal'}
          </button>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
          {syncMsg}
        </div>
      )}

      {/* Stats */}
      {!loading && <SummaryStats leads={leads} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Sources</option>
          <option value="calendly">📅 Calendly</option>
          <option value="google_calendar">🗓️ Google Calendar</option>
          <option value="direct">🔗 Direct</option>
          <option value="portal">🏠 Portal</option>
        </select>
        <select
          value={intakeFilter}
          onChange={(e) => setIntakeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Intake</option>
          <option value="pending">Pending Intake</option>
          <option value="sent">Intake Sent</option>
          <option value="completed">Intake Completed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={conversionFilter}
          onChange={(e) => setConversionFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Conversions</option>
          <option value="lead">Lead</option>
          <option value="prospect">Prospect</option>
          <option value="client">Client</option>
          <option value="lost">Lost</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={(e) => setShowOverdueOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Overdue follow-ups only
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-600">No leads found</p>
          <p className="text-sm mt-1">
            {leads.length === 0
              ? 'Click "Sync Calendly" or "Sync Google Cal" to import bookings.' :'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Booking</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Intake</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Conversion</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Follow-up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((lead) => {
                const followUpOverdue =
                  lead.follow_up_due_at &&
                  isOverdue(lead.follow_up_due_at) &&
                  !lead.follow_up_sent_at &&
                  lead.conversion_status !== 'client';

                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${followUpOverdue ? 'bg-red-50/30' : ''}`}
                    onClick={() => setSelected(lead)}
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.client_name}</div>
                      <div className="text-xs text-gray-400">{lead.client_email}</div>
                    </td>

                    {/* Booking */}
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{formatDate(lead.booking_date)}</div>
                      <div className="text-xs text-gray-400">
                        {lead.booking_time
                          ? new Date(`1970-01-01T${lead.booking_time}`).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : '—'}
                        {' · '}
                        {lead.duration_minutes}m
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {SOURCE_ICONS[lead.source || 'direct']}
                        {SOURCE_LABELS[lead.source || 'direct'] || lead.source}
                      </span>
                    </td>

                    {/* Intake */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
                          INTAKE_STATUS_COLORS[lead.intake_form_status || 'pending']
                        }`}
                      >
                        {INTAKE_STATUS_LABELS[lead.intake_form_status || 'pending']}
                      </span>
                    </td>

                    {/* Conversion */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
                          CONVERSION_STATUS_COLORS[lead.conversion_status || 'lead']
                        }`}
                      >
                        {CONVERSION_STATUS_LABELS[lead.conversion_status || 'lead']}
                      </span>
                    </td>

                    {/* Follow-up */}
                    <td className="px-4 py-3">
                      {lead.follow_up_sent_at ? (
                        <span className="text-xs text-emerald-600">✓ Sent</span>
                      ) : lead.follow_up_due_at ? (
                        <span className={`text-xs ${followUpOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {followUpOverdue ? '⚠️ ' : ''}
                          {formatDate(lead.follow_up_due_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(lead);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <LeadDetailPanel
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={(updates) => handleLeadUpdate(selected.id, updates)}
        />
      )}
    </div>
  );
}
