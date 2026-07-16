'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConsultationBooking {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  booking_type: string;
  notes: string | null;
  meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

type AttendanceStatus = 'pending' | 'attended' | 'no_show';

const BOOKING_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consultation',
  case_checkin: 'Case Check-In',
  follow_up: 'Follow-Up',
  document_review: 'Document Review',
};

const FOLLOW_UP_TEMPLATES = [
  {
    id: 'thank_you',
    label: 'Thank You',
    subject: 'Thank You for Your Consultation',
    body: `Thank you for taking the time to meet with us. It was a pleasure discussing your legal needs.\n\nIf you have any questions or would like to move forward, please don't hesitate to reach out. We look forward to the opportunity to assist you.`,
  },
  {
    id: 'next_steps',label: 'Next Steps',subject: 'Next Steps After Your Consultation',
    body: `Thank you for your consultation. Based on our discussion, here are the recommended next steps:\n\n1. Review the information we discussed\n2. Gather any relevant documents\n3. Contact us to schedule a follow-up or begin the engagement\n\nPlease feel free to reach out with any questions.`,
  },
  {
    id: 'proposal',label: 'Proposal Ready',subject: 'Your Legal Services Proposal',
    body: `Thank you for your consultation. We have prepared a proposal based on your needs.\n\nPlease review the attached proposal and let us know if you have any questions or would like to discuss further. We are ready to begin as soon as you are.`,
  },
  {
    id: 'no_show',label: 'Missed Appointment',subject: 'We Missed You — Reschedule Your Consultation',
    body: `We noticed you were unable to make your scheduled consultation. We understand that things come up, and we would love to reschedule at a time that works better for you.\n\nPlease reply to this email or visit our website to book a new appointment.`,
  },
  {
    id: 'custom',label: 'Custom Message',subject: '',body: '',
  },
];

function getAttendanceStatus(booking: ConsultationBooking): AttendanceStatus {
  if (booking.status === 'completed') return 'attended';
  if (booking.status === 'no_show') return 'no_show';
  return 'pending';
}

function formatBookingDate(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBookingTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, hour, minute);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isUpcoming(date: string, time: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return d > new Date();
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  attended: { label: 'Attended', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  no_show: { label: 'No-Show', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
};

export default function ScheduledConsultationsDashboard() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'attended' | 'no_show'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ConsultationBooking | null>(null);

  // Follow-up state
  const [followUpTemplate, setFollowUpTemplate] = useState('thank_you');
  const [followUpSubject, setFollowUpSubject] = useState(FOLLOW_UP_TEMPLATES[0].subject);
  const [followUpNote, setFollowUpNote] = useState(FOLLOW_UP_TEMPLATES[0].body);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpMsg, setFollowUpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [followUpSent, setFollowUpSent] = useState<Set<string>>(new Set());

  // Booking alert toggle
  const [bookingAlertsEnabled, setBookingAlertsEnabled] = useState(true);
  const [savingAlertPref, setSavingAlertPref] = useState(false);
  const [alertPrefMsg, setAlertPrefMsg] = useState<string | null>(null);

  // Load alert preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_booking_alerts_enabled');
      if (saved !== null) setBookingAlertsEnabled(saved === 'true');
    } catch {}
  }, []);

  const toggleBookingAlerts = async () => {
    setSavingAlertPref(true);
    const newVal = !bookingAlertsEnabled;
    try {
      localStorage.setItem('admin_booking_alerts_enabled', String(newVal));
      setBookingAlertsEnabled(newVal);
      setAlertPrefMsg(newVal ? 'Booking alerts enabled.' : 'Booking alerts paused.');
      setTimeout(() => setAlertPrefMsg(null), 3000);
    } catch {}
    setSavingAlertPref(false);
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('consultation_bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setBookings((data ?? []) as ConsultationBooking[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const markAttended = async (booking: ConsultationBooking) => {
    setActionLoading(booking.id);
    setActionMsg(null);
    const { error: err } = await supabase
      .from('consultation_bookings')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', booking.id);
    if (err) {
      setActionMsg({ id: booking.id, type: 'error', text: 'Failed to update status.' });
    } else {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'completed' } : b)));
      setActionMsg({ id: booking.id, type: 'success', text: 'Marked as attended.' });
      if (selectedBooking?.id === booking.id) setSelectedBooking({ ...selectedBooking, status: 'completed' });
    }
    setActionLoading(null);
  };

  const markNoShow = async (booking: ConsultationBooking) => {
    setActionLoading(booking.id + '_noshow');
    setActionMsg(null);
    const { error: err } = await supabase
      .from('consultation_bookings')
      .update({ status: 'no_show', updated_at: new Date().toISOString() })
      .eq('id', booking.id);
    if (err) {
      setActionMsg({ id: booking.id, type: 'error', text: 'Failed to update status.' });
    } else {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'no_show' } : b)));
      setActionMsg({ id: booking.id, type: 'success', text: 'Marked as no-show.' });
      if (selectedBooking?.id === booking.id) setSelectedBooking({ ...selectedBooking, status: 'no_show' });
    }
    setActionLoading(null);
  };

  const handleTemplateChange = (templateId: string) => {
    setFollowUpTemplate(templateId);
    const tpl = FOLLOW_UP_TEMPLATES.find((t) => t.id === templateId);
    if (tpl && templateId !== 'custom') {
      setFollowUpSubject(tpl.subject);
      setFollowUpNote(tpl.body);
    } else if (templateId === 'custom') {
      setFollowUpSubject('');
      setFollowUpNote('');
    }
  };

  const sendFollowUp = async () => {
    if (!selectedBooking) return;
    setSendingFollowUp(true);
    setFollowUpMsg(null);
    try {
      const res = await fetch('/api/admin/send-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedBooking.client_email,
          subject: followUpSubject || `Follow-Up: Your Consultation with Broussard Legal Services`,
          message: followUpNote || `Thank you for your consultation on ${formatBookingDate(selectedBooking.booking_date, selectedBooking.booking_time)}.`,
          clientName: selectedBooking.client_name,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setFollowUpMsg({ type: 'success', text: `Follow-up sent to ${selectedBooking.client_email}` });
      setFollowUpSent((prev) => new Set(prev).add(selectedBooking.id));
    } catch {
      setFollowUpMsg({ type: 'error', text: 'Failed to send follow-up email.' });
    } finally {
      setSendingFollowUp(false);
    }
  };

  const filtered = bookings.filter((b) => {
    const attendance = getAttendanceStatus(b);
    if (statusFilter !== 'all' && attendance !== statusFilter) return false;
    const upcoming = isUpcoming(b.booking_date, b.booking_time);
    if (timeFilter === 'upcoming' && !upcoming) return false;
    if (timeFilter === 'past' && upcoming) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.client_name.toLowerCase().includes(q) ||
        b.client_email.toLowerCase().includes(q) ||
        (BOOKING_TYPE_LABELS[b.booking_type] ?? b.booking_type).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCount = bookings.length;
  const attendedCount = bookings.filter((b) => b.status === 'completed').length;
  const noShowCount = bookings.filter((b) => b.status === 'no_show').length;
  const pendingCount = bookings.filter((b) => b.status !== 'completed' && b.status !== 'no_show' && b.status !== 'cancelled').length;
  const upcomingCount = bookings.filter((b) => isUpcoming(b.booking_date, b.booking_time) && b.status !== 'cancelled').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Scheduled Consultations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track attendance, mark outcomes, and send post-consultation follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Booking Alert Toggle */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${bookingAlertsEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-700">Booking Alerts</span>
              {alertPrefMsg && <span className="text-xs text-emerald-600">{alertPrefMsg}</span>}
            </div>
            <button
              onClick={toggleBookingAlerts}
              disabled={savingAlertPref}
              title={bookingAlertsEnabled ? 'Disable new booking alerts' : 'Enable new booking alerts'}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${bookingAlertsEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${bookingAlertsEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          <button
            onClick={fetchBookings}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: totalCount, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Upcoming', value: upcomingCount, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Attended', value: attendedCount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'No-Show', value: noShowCount, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by client name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="all">All Time</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="attended">Attended</option>
          <option value="no_show">No-Show</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 min-w-0 ${selectedBooking ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">No consultations found.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Duration</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((booking) => {
                    const attendance = getAttendanceStatus(booking);
                    const cfg = STATUS_CONFIG[attendance];
                    const upcoming = isUpcoming(booking.booking_date, booking.booking_time);
                    const isSelected = selectedBooking?.id === booking.id;
                    const hasSentFollowUp = followUpSent.has(booking.id);
                    return (
                      <tr
                        key={booking.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedBooking(null);
                          } else {
                            setSelectedBooking(booking);
                            const tpl = FOLLOW_UP_TEMPLATES.find((t) => t.id === (attendance === 'no_show' ? 'no_show' : 'thank_you'));
                            if (tpl) {
                              setFollowUpTemplate(tpl.id);
                              setFollowUpSubject(tpl.subject);
                              setFollowUpNote(tpl.body);
                            }
                            setFollowUpMsg(null);
                          }
                        }}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'bg-amber-50/60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{formatBookingDate(booking.booking_date, booking.booking_time)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{formatBookingTime(booking.booking_time)}</div>
                          {upcoming && attendance === 'pending' && (
                            <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Upcoming</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[140px]">{booking.client_name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[140px]">{booking.client_email}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-gray-700 font-medium">{booking.duration_minutes} min</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-gray-600 text-xs">{BOOKING_TYPE_LABELS[booking.booking_type] ?? booking.booking_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {hasSentFollowUp && (
                            <span className="block text-xs text-emerald-600 mt-0.5">✓ Follow-up sent</span>
                          )}
                          {actionMsg?.id === booking.id && (
                            <p className={`text-xs mt-1 ${actionMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {actionMsg.text}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {attendance !== 'attended' && (
                              <button
                                onClick={() => markAttended(booking)}
                                disabled={actionLoading === booking.id}
                                title="Mark as attended"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                {actionLoading === booking.id ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="hidden sm:inline">Attended</span>
                              </button>
                            )}
                            {attendance !== 'no_show' && (
                              <button
                                onClick={() => markNoShow(booking)}
                                disabled={actionLoading === booking.id + '_noshow'}
                                title="Mark as no-show"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                {actionLoading === booking.id + '_noshow' ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                                <span className="hidden sm:inline">No-Show</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedBooking(null);
                                } else {
                                  setSelectedBooking(booking);
                                  const tpl = FOLLOW_UP_TEMPLATES.find((t) => t.id === (attendance === 'no_show' ? 'no_show' : 'thank_you'));
                                  if (tpl) { setFollowUpTemplate(tpl.id); setFollowUpSubject(tpl.subject); setFollowUpNote(tpl.body); }
                                  setFollowUpMsg(null);
                                }
                              }}
                              title="Send follow-up"
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${hasSentFollowUp ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'}`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="hidden sm:inline">{hasSentFollowUp ? 'Sent' : 'Follow-Up'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail / Follow-Up Panel */}
        {selectedBooking && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden sticky top-4">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Post-Consultation Follow-Up</h3>
                <button
                  onClick={() => { setSelectedBooking(null); setFollowUpMsg(null); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Client Info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-700 font-semibold text-sm">
                      {selectedBooking.client_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedBooking.client_name}</p>
                    <p className="text-xs text-gray-500">{selectedBooking.client_email}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Date</p>
                    <p className="text-xs font-medium text-gray-900">{formatBookingDate(selectedBooking.booking_date, selectedBooking.booking_time)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Status</p>
                    {(() => {
                      const att = getAttendanceStatus(selectedBooking);
                      const cfg = STATUS_CONFIG[att];
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mark Outcome</p>
                  <div className="flex gap-2">
                    {getAttendanceStatus(selectedBooking) !== 'attended' && (
                      <button
                        onClick={() => markAttended(selectedBooking)}
                        disabled={actionLoading === selectedBooking.id}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        ✓ Attended
                      </button>
                    )}
                    {getAttendanceStatus(selectedBooking) !== 'no_show' && (
                      <button
                        onClick={() => markNoShow(selectedBooking)}
                        disabled={actionLoading === selectedBooking.id + '_noshow'}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                      >
                        ✗ No-Show
                      </button>
                    )}
                  </div>
                </div>

                {/* Follow-Up Email Section */}
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Send Follow-Up Email</p>

                  {/* Template Selector */}
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1.5">Email Template</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FOLLOW_UP_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => handleTemplateChange(tpl.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            followUpTemplate === tpl.id
                              ? 'bg-amber-600 text-white border-amber-600' :'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
                          }`}
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">Subject</label>
                    <input
                      type="text"
                      value={followUpSubject}
                      onChange={(e) => setFollowUpSubject(e.target.value)}
                      placeholder="Email subject…"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Message */}
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">Message</label>
                    <textarea
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      placeholder="Your follow-up message…"
                      rows={5}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={sendFollowUp}
                    disabled={sendingFollowUp || !followUpSubject || !followUpNote}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingFollowUp ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Follow-Up
                      </>
                    )}
                  </button>

                  {followUpMsg && (
                    <p className={`text-xs mt-2 ${followUpMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {followUpMsg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
