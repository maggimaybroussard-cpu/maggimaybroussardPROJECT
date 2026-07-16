'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  htmlLink: string;
  attendees: Array<{ email: string; displayName?: string }>;
}

interface BookingRecord {
  id: string;
  client_name: string;
  client_email: string;
  booking_type: string;
  booking_date: string;
  booking_time: string;
  timezone: string;
  status: string;
  notes: string | null;
  google_event_id: string | null;
  meeting_location: string | null;
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consultation',
  follow_up: 'Follow-Up Meeting',
  document_review: 'Document Review',
  case_checkin: 'Case Check-In',
};

function formatDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
}

function formatDateOnly(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
    case 'rescheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export default function GoogleCalendarBookingPanel() {
  const [tab, setTab] = useState<'bookings' | 'calendar'>('bookings');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [calLoading, setCalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30',
  ];

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/book-consultation?status=confirmed');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bookings');
      setBookings(data.bookings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/google-calendar/status');
      const data = await res.json();
      setGcalConnected(data.connected ?? false);
      setGcalEmail(data.accountEmail ?? null);
    } catch {
      setGcalConnected(false);
    }
  }, []);

  const fetchCalendarEvents = useCallback(async () => {
    if (!gcalConnected) return;
    setCalLoading(true);
    setCalError(null);
    try {
      const res = await fetch('/api/google-calendar/upcoming-events');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load calendar events');
      setCalEvents(data.events ?? []);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setCalLoading(false);
    }
  }, [gcalConnected]);

  useEffect(() => {
    fetchBookings();
    fetchCalendarStatus();
  }, [fetchBookings, fetchCalendarStatus]);

  useEffect(() => {
    if (tab === 'calendar' && gcalConnected) {
      fetchCalendarEvents();
    }
  }, [tab, gcalConnected, fetchCalendarEvents]);

  const handleCancel = async (booking: BookingRecord) => {
    if (!confirm(`Cancel appointment for ${booking.client_name} on ${formatDateOnly(booking.booking_date)}?`)) return;
    try {
      const res = await fetch('/api/portal/book-consultation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setSuccessMsg(`Appointment for ${booking.client_name} cancelled and removed from Google Calendar.`);
      fetchBookings();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  const openReschedule = (booking: BookingRecord) => {
    setRescheduleTarget(booking);
    setRescheduleDate('');
    setRescheduleTime('');
    setRescheduleNotes(booking.notes ?? '');
    setRescheduleError(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select a new date and time.');
      return;
    }
    setRescheduleSubmitting(true);
    setRescheduleError(null);
    try {
      const res = await fetch('/api/portal/book-consultation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rescheduleTarget.id,
          status: 'confirmed',
          bookingDate: rescheduleDate,
          bookingTime: rescheduleTime,
          timezone: rescheduleTarget.timezone,
          notes: rescheduleNotes || rescheduleTarget.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reschedule failed');
      setSuccessMsg(`Appointment for ${rescheduleTarget.client_name} rescheduled and Google Calendar updated.`);
      setRescheduleTarget(null);
      fetchBookings();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : 'Reschedule failed');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#1a2744] to-[#2a3a5c]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Google Calendar Bookings</h2>
            <p className="text-white/60 text-xs">
              {gcalConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Connected · {gcalEmail}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Not connected — connect via Admin → Integrations
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setTab('bookings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'bookings' ? 'bg-white text-[#1a2744]' : 'text-white/70 hover:text-white'}`}
          >
            Bookings
          </button>
          <button
            onClick={() => setTab('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'calendar' ? 'bg-white text-[#1a2744]' : 'text-white/70 hover:text-white'}`}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-emerald-700 text-sm">{successMsg}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Bookings Tab */}
      {tab === 'bookings' && (
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#1a2744] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No confirmed bookings found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">{booking.client_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(booking.status)}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                        {booking.google_event_id && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.5 3h-3V1.5h-1.5V3h-9V1.5H4.5V3h-3C.675 3 0 3.675 0 4.5v15C0 20.325.675 21 1.5 21h18c.825 0 1.5-.675 1.5-1.5v-15C21 3.675 20.325 3 19.5 3zM19.5 19.5h-18V9h18v10.5z" />
                            </svg>
                            Synced
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{booking.client_email}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDateOnly(booking.booking_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(booking.booking_time)} CT
                        </span>
                        <span className="font-medium text-[#1a2744]">
                          {BOOKING_TYPE_LABELS[booking.booking_type] ?? booking.booking_type}
                        </span>
                      </div>
                      {booking.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic truncate">"{booking.notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openReschedule(booking)}
                        className="px-3 py-1.5 text-xs font-medium text-[#1a2744] border border-[#1a2744]/20 rounded-lg hover:bg-[#1a2744]/5 transition-colors"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => handleCancel(booking)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar View Tab */}
      {tab === 'calendar' && (
        <div className="p-6">
          {!gcalConnected ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium text-sm mb-1">Google Calendar Not Connected</p>
              <p className="text-gray-500 text-xs">Connect via Admin → Integrations → Google Calendar to view live calendar events.</p>
            </div>
          ) : calLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#1a2744] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{calError}</p>
            </div>
          ) : calEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No upcoming events found in Google Calendar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calEvents.map((event) => (
                <div key={event.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm mb-1">{event.summary}</p>
                      <p className="text-xs text-gray-500 mb-2">{formatDateTime(event.start)}</p>
                      {event.attendees?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {event.attendees.slice(0, 3).map((att) => (
                            <span key={att.email} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {att.displayName ?? att.email}
                            </span>
                          ))}
                          {event.attendees.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                              +{event.attendees.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Reschedule Appointment</h3>
              <p className="text-sm text-gray-500 mt-1">
                {rescheduleTarget.client_name} · {BOOKING_TYPE_LABELS[rescheduleTarget.booking_type] ?? rescheduleTarget.booking_type}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {rescheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{rescheduleError}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">New Date</label>
                <input
                  type="date"
                  min={todayStr}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20 focus:border-[#1a2744]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">New Time (CT)</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setRescheduleTime(slot)}
                      className={`py-2 text-xs rounded-lg border transition-colors ${
                        rescheduleTime === slot
                          ? 'bg-[#1a2744] text-white border-[#1a2744]'
                          : 'border-gray-200 text-gray-700 hover:border-[#1a2744]/30'
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20 focus:border-[#1a2744] resize-none"
                  placeholder="Any notes for the rescheduled appointment..."
                />
              </div>
              {gcalConnected && (
                <p className="text-xs text-blue-600 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Google Calendar event will be updated automatically.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setRescheduleTarget(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={rescheduleSubmitting || !rescheduleDate || !rescheduleTime}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-[#1a2744] rounded-xl hover:bg-[#2a3a5c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rescheduleSubmitting ? 'Rescheduling…' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
