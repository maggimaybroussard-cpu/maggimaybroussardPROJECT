'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  timezone: string;
  appointment_type: string;
  status: string;
  notes: string | null;
  reminder_sent: boolean;
  google_event_id: string | null;
  created_at: string;
}

type AppointmentView = 'list' | 'book' | 'reschedule';

const APPOINTMENT_TYPES = [
  { id: 'initial_consultation', label: 'Initial Consultation', icon: '🤝', duration: '60 min' },
  { id: 'follow_up', label: 'Follow-Up Meeting', icon: '🔄', duration: '30 min' },
  { id: 'document_review', label: 'Document Review', icon: '📄', duration: '45 min' },
  { id: 'deposition_prep', label: 'Deposition Prep', icon: '🎙️', duration: '90 min' },
  { id: 'strategy_session', label: 'Strategy Session', icon: '⚖️', duration: '60 min' },
  { id: 'signing', label: 'Contract Signing', icon: '✍️', duration: '30 min' },
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
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
    case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'rescheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function getStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isUpcoming(dateStr: string, timeStr: string) {
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt >= new Date();
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getMinDate() {
  return getTodayStr();
}

interface LexiAppointmentsTabProps {
  clientName?: string;
  caseRef?: string;
}

export default function LexiAppointmentsTab({ clientName, caseRef }: LexiAppointmentsTabProps) {
  const [view, setView] = useState<AppointmentView>('list');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Book form state
  const [bookForm, setBookForm] = useState({
    clientName: clientName || '',
    clientEmail: '',
    clientPhone: '',
    appointmentType: 'initial_consultation',
    appointmentDate: '',
    appointmentTime: '',
    timezone: 'America/Chicago',
    notes: '',
  });

  // Reschedule form state
  const [rescheduleForm, setRescheduleForm] = useState({
    appointmentDate: '',
    appointmentTime: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (clientName) params.set('clientName', clientName);
      const res = await fetch(`/api/lexi/appointments?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load appointments');
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [clientName]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Sync clientName into book form when session changes
  useEffect(() => {
    if (clientName) {
      setBookForm(prev => ({ ...prev, clientName }));
    }
  }, [clientName]);

  const handleBook = async () => {
    setFormError(null);
    if (!bookForm.clientName.trim()) { setFormError('Client name is required'); return; }
    if (!bookForm.clientEmail.trim()) { setFormError('Client email is required'); return; }
    if (!bookForm.appointmentDate) { setFormError('Please select a date'); return; }
    if (!bookForm.appointmentTime) { setFormError('Please select a time'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/lexi/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book',
          clientName: bookForm.clientName,
          clientEmail: bookForm.clientEmail,
          clientPhone: bookForm.clientPhone || null,
          appointmentType: bookForm.appointmentType,
          appointmentDate: bookForm.appointmentDate,
          appointmentTime: bookForm.appointmentTime,
          timezone: bookForm.timezone,
          notes: bookForm.notes,
          caseRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      const smsNote = bookForm.clientPhone ? ` Confirmation SMS sent to ${bookForm.clientPhone}.` : '';
      setSuccessMsg(`Appointment booked for ${bookForm.clientName} on ${formatDate(bookForm.appointmentDate)} at ${formatTime(bookForm.appointmentTime)}. Confirmation sent to ${bookForm.clientEmail}.${smsNote}`);
      setView('list');
      fetchAppointments();
      setBookForm(prev => ({ ...prev, appointmentDate: '', appointmentTime: '', notes: '', clientEmail: '', clientPhone: '' }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    setFormError(null);
    if (!rescheduleForm.appointmentDate) { setFormError('Please select a new date'); return; }
    if (!rescheduleForm.appointmentTime) { setFormError('Please select a new time'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/lexi/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          appointmentId: rescheduleTarget.id,
          appointmentDate: rescheduleForm.appointmentDate,
          appointmentTime: rescheduleForm.appointmentTime,
          notes: rescheduleForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reschedule failed');
      setSuccessMsg(`Appointment rescheduled to ${formatDate(rescheduleForm.appointmentDate)} at ${formatTime(rescheduleForm.appointmentTime)}. Updated confirmation sent.`);
      setView('list');
      setRescheduleTarget(null);
      fetchAppointments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Reschedule failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (appt: Appointment) => {
    setActionLoading(appt.id);
    try {
      const res = await fetch('/api/lexi/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', appointmentId: appt.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setSuccessMsg('Appointment cancelled. Client notified.');
      fetchAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (appt: Appointment) => {
    setActionLoading(`reminder-${appt.id}`);
    try {
      const res = await fetch('/api/lexi/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reminder', appointmentId: appt.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reminder failed');
      setSuccessMsg(`Reminder sent to ${appt.client_email}`);
      fetchAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reminder failed');
    } finally {
      setActionLoading(null);
    }
  };

  const upcomingAppts = appointments.filter(a =>
    a.status !== 'cancelled' && isUpcoming(a.appointment_date, a.appointment_time)
  );
  const displayAppts = filter === 'upcoming' ? upcomingAppts : appointments;

  const selectedType = APPOINTMENT_TYPES.find(t => t.id === bookForm.appointmentType);

  // ── BOOK VIEW ──────────────────────────────────────────────────────────────
  if (view === 'book') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Book Appointment</p>
              <p className="text-[10px] text-muted-foreground">Schedule a new client meeting</p>
            </div>
          </div>
          <button
            onClick={() => { setView('list'); setFormError(null); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            ← Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-500 text-sm shrink-0">⚠️</span>
              <p className="text-xs text-red-700">{formError}</p>
            </div>
          )}

          {/* Appointment type */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Appointment Type</p>
            <div className="grid grid-cols-2 gap-2">
              {APPOINTMENT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setBookForm(prev => ({ ...prev, appointmentType: t.id }))}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${bookForm.appointmentType === t.id ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:border-primary/30'}`}
                >
                  <span className="text-base shrink-0">{t.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground leading-tight">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.duration}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client Name *</label>
              <input
                type="text"
                value={bookForm.clientName}
                onChange={e => setBookForm(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="e.g. John Smith"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client Email *</label>
              <input
                type="email"
                value={bookForm.clientEmail}
                onChange={e => setBookForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                placeholder="client@email.com"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
          </div>

          {/* Phone number */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Client Phone <span className="font-normal text-muted-foreground">(optional — for SMS confirmation)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">📱</span>
              <input
                type="tel"
                value={bookForm.clientPhone}
                onChange={e => setBookForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
            {bookForm.clientPhone && (
              <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                <span>✓</span> SMS confirmation will be sent via Twilio
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Date *</label>
              <input
                type="date"
                value={bookForm.appointmentDate}
                min={getMinDate()}
                onChange={e => setBookForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Timezone</label>
              <select
                value={bookForm.timezone}
                onChange={e => setBookForm(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              >
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
              </select>
            </div>
          </div>

          {/* Time slots */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Time *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => setBookForm(prev => ({ ...prev, appointmentTime: slot }))}
                  className={`py-2 rounded-lg text-[11px] font-medium border transition-all ${bookForm.appointmentTime === slot ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5'}`}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea
              value={bookForm.notes}
              onChange={e => setBookForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Client wants to discuss contract terms, bring signed documents"
              rows={2}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          {/* Summary */}
          {bookForm.appointmentDate && bookForm.appointmentTime && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Booking Summary</p>
              <p className="text-xs text-foreground font-medium">{selectedType?.icon} {selectedType?.label} · {selectedType?.duration}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(bookForm.appointmentDate)} at {formatTime(bookForm.appointmentTime)}</p>
              {bookForm.clientName && <p className="text-xs text-muted-foreground">Client: {bookForm.clientName}</p>}
            </div>
          )}

          <button
            onClick={handleBook}
            disabled={submitting}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Booking…</>
            ) : (
              <><span>📅</span>Confirm Booking & Send Confirmation</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── RESCHEDULE VIEW ────────────────────────────────────────────────────────
  if (view === 'reschedule' && rescheduleTarget) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔄</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Reschedule Appointment</p>
              <p className="text-[10px] text-muted-foreground">{rescheduleTarget.client_name}</p>
            </div>
          </div>
          <button
            onClick={() => { setView('list'); setRescheduleTarget(null); setFormError(null); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            ← Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Current appointment info */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-1">Current Appointment</p>
            <p className="text-xs font-medium text-amber-900">{rescheduleTarget.client_name}</p>
            <p className="text-xs text-amber-700">{formatDate(rescheduleTarget.appointment_date)} at {formatTime(rescheduleTarget.appointment_time)}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">{APPOINTMENT_TYPES.find(t => t.id === rescheduleTarget.appointment_type)?.label || rescheduleTarget.appointment_type}</p>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-500 text-sm shrink-0">⚠️</span>
              <p className="text-xs text-red-700">{formError}</p>
            </div>
          )}

          {/* New date */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">New Date *</label>
            <input
              type="date"
              value={rescheduleForm.appointmentDate}
              min={getMinDate()}
              onChange={e => setRescheduleForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* New time */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">New Time *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => setRescheduleForm(prev => ({ ...prev, appointmentTime: slot }))}
                  className={`py-2 rounded-lg text-[11px] font-medium border transition-all ${rescheduleForm.appointmentTime === slot ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5'}`}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Reason / Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea
              value={rescheduleForm.notes}
              onChange={e => setRescheduleForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Client requested earlier time, attorney conflict"
              rows={2}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          <button
            onClick={handleReschedule}
            disabled={submitting}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Rescheduling…</>
            ) : (
              <><span>🔄</span>Confirm Reschedule & Notify Client</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Appointments</p>
              <p className="text-[10px] text-muted-foreground">
                {clientName ? `${clientName}${caseRef ? ` · ${caseRef}` : ''}` : 'All client appointments'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchAppointments}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button
              onClick={() => { setView('book'); setFormError(null); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-semibold hover:opacity-90 transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Book
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Upcoming</p>
              <p className="text-sm font-bold text-foreground">{upcomingAppts.length}</p>
            </div>
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-foreground">{appointments.length}</p>
            </div>
            <div className="bg-background rounded-lg p-2 text-center border border-border">
              <p className="text-[10px] text-muted-foreground">Confirmed</p>
              <p className="text-sm font-bold text-emerald-600">{appointments.filter(a => a.status === 'confirmed').length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setFilter('upcoming')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${filter === 'upcoming' ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Upcoming ({upcomingAppts.length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${filter === 'all' ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
        >
          All ({appointments.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {/* Success message */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-emerald-600 text-sm shrink-0">✅</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-emerald-800 leading-relaxed">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-500 text-sm shrink-0">⚠️</span>
            <p className="text-xs text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading appointments…</p>
          </div>
        ) : displayAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {filter === 'upcoming' ? 'No upcoming appointments' : 'No appointments found'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {filter === 'upcoming' ? 'All clear — no scheduled meetings.' : 'No appointments have been booked yet.'}
              </p>
            </div>
            <button
              onClick={() => setView('book')}
              className="mt-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
            >
              Book First Appointment
            </button>
          </div>
        ) : (
          displayAppts.map(appt => {
            const upcoming = isUpcoming(appt.appointment_date, appt.appointment_time);
            const apptType = APPOINTMENT_TYPES.find(t => t.id === appt.appointment_type);
            const isCancelling = actionLoading === appt.id;
            const isSendingReminder = actionLoading === `reminder-${appt.id}`;

            return (
              <div
                key={appt.id}
                className={`rounded-xl border p-3 transition-all ${appt.status === 'cancelled' ? 'border-border bg-secondary/30 opacity-60' : upcoming ? 'border-primary/20 bg-primary/3' : 'border-border bg-background'}`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{apptType?.icon || '📅'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{appt.client_name}</p>
                      <p className="text-[10px] text-muted-foreground">{apptType?.label || appt.appointment_type}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(appt.status)}`}>
                    {getStatusLabel(appt.status)}
                  </span>
                </div>

                {/* Date/time */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1 text-[11px] text-foreground">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span className="font-medium">{formatDate(appt.appointment_date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{formatTime(appt.appointment_time)}</span>
                  </div>
                  {appt.google_event_id && (
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      GCal
                    </span>
                  )}
                </div>

                {/* Email */}
                <p className="text-[10px] text-muted-foreground mb-2 truncate">{appt.client_email}</p>

                {/* Notes */}
                {appt.notes && (
                  <p className="text-[10px] text-muted-foreground italic mb-2 line-clamp-2">"{appt.notes}"</p>
                )}

                {/* Reminder badge */}
                {appt.reminder_sent && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      Reminder sent
                    </span>
                  </div>
                )}

                {/* Actions */}
                {appt.status !== 'cancelled' && appt.status !== 'completed' && upcoming && (
                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        setRescheduleTarget(appt);
                        setRescheduleForm({ appointmentDate: '', appointmentTime: '', notes: '' });
                        setFormError(null);
                        setView('reschedule');
                      }}
                      className="flex-1 py-1.5 text-[11px] font-semibold border border-border rounded-lg hover:bg-secondary transition-colors text-foreground flex items-center justify-center gap-1"
                    >
                      <span>🔄</span> Reschedule
                    </button>
                    <button
                      onClick={() => handleSendReminder(appt)}
                      disabled={isSendingReminder || appt.reminder_sent}
                      className="flex-1 py-1.5 text-[11px] font-semibold border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isSendingReminder ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><span>🔔</span>{appt.reminder_sent ? 'Reminded' : 'Remind'}</>
                      )}
                    </button>
                    <button
                      onClick={() => handleCancel(appt)}
                      disabled={isCancelling}
                      className="px-2.5 py-1.5 text-[11px] font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {isCancelling ? (
                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
