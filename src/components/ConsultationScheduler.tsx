'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  trackConsultationBooked,
  trackConsultationCalendlyEngaged,
  trackBookConsultationClick,
  trackLeadQuality,
  trackConsultationBookingComplete,
} from '@/lib/analytics';

interface ConsultationSchedulerProps {
  onBookingComplete?: (booking: BookingResult) => void;
  defaultDuration?: 15 | 30 | 60;
}

interface BookingResult {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  meetingLink: string;
  emailSent: boolean;
  googleCalendarUrl?: string;
  icsDownloadUrl?: string;
}

const DURATION_OPTIONS: { value: 15 | 30 | 60; label: string; desc: string; price: string }[] = [
  { value: 15, label: '15 Min', desc: 'Quick question or status check', price: 'Free' },
  { value: 30, label: '30 Min', desc: 'Initial consultation — most popular', price: 'Free' },
  { value: 60, label: '60 Min', desc: 'In-depth case review', price: 'Free' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function isWeekend(year: number, month: number, day: number) {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
}
function isPast(year: number, month: number, day: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(year, month, day) < today;
}
function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function formatDisplayTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Booking-funnel step tracker ────────────────────────────────────────────────
function trackSchedulerStep(step: string, extra: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'consultation_scheduler_step', {
      event_category: 'consultation_funnel',
      scheduler_step: step,
      ...extra,
    });
  }
}

type Step = 'duration' | 'datetime' | 'details' | 'confirm' | 'success';

export default function ConsultationScheduler({
  onBookingComplete,
  defaultDuration = 30,
}: ConsultationSchedulerProps) {
  const today = new Date();
  const [step, setStep] = useState<Step>('duration');
  const [duration, setDuration] = useState<15 | 30 | 60>(defaultDuration);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch availability when date or duration changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedTime('');
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(`/api/consultations/availability?date=${selectedDate}&duration=${duration}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setAvailableSlots(data.available || []);
          setLoadingSlots(false);
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoadingSlots(false);
      });

    return () => ctrl.abort();
  }, [selectedDate, duration]);

  const handleDayClick = useCallback(
    (day: number) => {
      if (isWeekend(viewYear, viewMonth, day) || isPast(viewYear, viewMonth, day)) return;
      setSelectedDate(toDateString(viewYear, viewMonth, day));
    },
    [viewYear, viewMonth]
  );

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      setSubmitError('Please enter your name and email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      setSubmitError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    // Track form submission attempt
    trackSchedulerStep('booking_submit_attempt', { duration_minutes: duration });

    try {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          durationMinutes: duration,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      const result: BookingResult = {
        bookingId: data.bookingId,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        durationMinutes: duration,
        meetingLink: data.meetingLink,
        emailSent: data.emailSent,
        googleCalendarUrl: data.googleCalendarUrl,
        icsDownloadUrl: data.icsDownloadUrl,
      };

      // ── Conversion tracking ──────────────────────────────────────────────
      const trafficSource =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('utm_source') ?? document.referrer ? 'referral' : 'direct'
          : 'direct';

      // Primary booking conversion event
      trackConsultationBooked({
        serviceType: 'consultation',
        trafficSource,
        hasDeposit: false,
      });

      // Definitive ROI booking completion event
      trackConsultationBookingComplete({
        bookingId: data.bookingId,
        durationMinutes: duration,
        bookingDate: selectedDate,
        emailSent: data.emailSent,
        source: 'scheduler',
      });

      // Scheduler-specific confirmation step
      trackSchedulerStep('booking_confirmed', {
        booking_id: data.bookingId,
        duration_minutes: duration,
        booking_date: selectedDate,
        email_sent: data.emailSent,
      });

      // Lead quality signal
      trackLeadQuality({
        source: 'calendly',
        service: 'consultation',
        conversionType: 'booking',
      });
      // ────────────────────────────────────────────────────────────────────

      setBookingResult(result);
      setStep('success');
      onBookingComplete?.(result);
    } catch (err) {
      trackSchedulerStep('booking_error', {
        error: err instanceof Error ? err.message : 'unknown',
        duration_minutes: duration,
      });
      setSubmitError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step: Duration ─────────────────────────────────────────────────────────
  if (step === 'duration') {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <h3 className="font-serif text-xl text-foreground">Book a Consultation</h3>
          <p className="text-sm text-muted-foreground mt-1">Choose your consultation length to get started.</p>
        </div>
        <div className="p-6 grid sm:grid-cols-3 gap-4">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setDuration(opt.value);
                // Track funnel entry + duration selection
                trackBookConsultationClick('consultation_scheduler');
                trackConsultationCalendlyEngaged('consultation');
                trackSchedulerStep('duration_selected', { duration_minutes: opt.value });
                setStep('datetime');
              }}
              className="group flex flex-col items-start p-5 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md"
              style={{
                borderColor: duration === opt.value ? '#355E3B' : 'var(--border)',
                background: duration === opt.value ? 'rgba(53,94,59,0.06)' : 'var(--card)',
              }}
            >
              <span
                className="text-2xl font-serif font-semibold mb-1"
                style={{ color: '#355E3B' }}
              >
                {opt.label}
              </span>
              <span className="text-sm text-foreground font-medium mb-1">{opt.desc}</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full mt-auto"
                style={{ background: 'rgba(200,150,90,0.15)', color: '#C8965A' }}
              >
                {opt.price}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step: Date & Time ──────────────────────────────────────────────────────
  if (step === 'datetime') {
    const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null;
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setStep('duration')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Back
              </button>
              <span className="text-xs text-muted-foreground/40">·</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
              >
                {duration} min
              </span>
            </div>
            <h3 className="font-serif text-lg text-foreground">Pick a Date &amp; Time</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Weekdays only · CST</p>
          </div>
          {selectedDate && selectedTime && (
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {selectedDateObj?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatDisplayTime(selectedTime)}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-[1fr_auto] divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Calendar */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                disabled={!canGoPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous month"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className="text-sm font-semibold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
                aria-label="Next month"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className={`text-center text-[11px] font-semibold uppercase tracking-wider py-1 ${d === 'Sun' || d === 'Sat' ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} />;
                const ds = toDateString(viewYear, viewMonth, day);
                const weekend = isWeekend(viewYear, viewMonth, day);
                const past = isPast(viewYear, viewMonth, day);
                const disabled = weekend || past;
                const isSelected = ds === selectedDate;
                const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className={`relative aspect-square rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-center ${disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'cursor-pointer hover:bg-secondary/60'} ${isSelected ? 'text-white shadow-sm' : ''} ${isToday && !isSelected ? 'ring-1 ring-accent/50 text-accent font-semibold' : ''} ${!disabled && !isSelected ? 'text-foreground' : ''}`}
                    style={isSelected ? { background: '#355E3B' } : undefined}
                    aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                    aria-pressed={isSelected}
                  >
                    {day}
                    {isToday && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="p-5 md:w-52">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {selectedDate
                ? selectedDateObj?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : 'Select a date first'}
            </p>
            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 mb-2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p className="text-xs text-muted-foreground/50">Pick a weekday to see available times</p>
              </div>
            ) : loadingSlots ? (
              <div className="flex flex-col gap-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-secondary/50 animate-pulse" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-muted-foreground">No available slots on this day.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Please choose another date.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                {availableSlots.map((slot) => {
                  const isSelected = slot === selectedTime;
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${isSelected ? 'text-white shadow-sm' : 'text-foreground border border-border hover:border-accent/50 hover:bg-secondary/40'}`}
                      style={isSelected ? { background: '#355E3B', border: 'none' } : undefined}
                      aria-pressed={isSelected}
                    >
                      <span className="flex items-center justify-between">
                        {formatDisplayTime(slot)}
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Confirmation bar */}
        {selectedDate && selectedTime && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3" style={{ background: 'rgba(53,94,59,0.05)' }}>
            <div>
              <p className="text-xs font-semibold text-foreground">{formatDisplayDate(selectedDate)}</p>
              <p className="text-xs text-muted-foreground">{formatDisplayTime(selectedTime)} CST · {duration} minutes</p>
            </div>
            <button
              onClick={() => {
                trackSchedulerStep('datetime_selected', {
                  duration_minutes: duration,
                  booking_date: selectedDate,
                });
                setStep('details');
              }}
              className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest text-white transition-all hover:opacity-90"
              style={{ background: '#355E3B' }}
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Step: Contact Details ──────────────────────────────────────────────────
  if (step === 'details') {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <button
            onClick={() => setStep('datetime')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <h3 className="font-serif text-lg text-foreground">Your Details</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDisplayDate(selectedDate)} · {formatDisplayTime(selectedTime)} CST · {duration} min
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Full Name *</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email Address *</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Brief Description <span className="font-normal normal-case tracking-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Briefly describe your legal support needs or questions..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all resize-none"
            />
          </div>
          {submitError && (
            <p className="text-xs text-red-500 font-medium">{submitError}</p>
          )}
          <button
            onClick={() => {
              if (!clientName.trim() || !clientEmail.trim()) {
                setSubmitError('Please enter your name and email.');
                return;
              }
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
                setSubmitError('Please enter a valid email address.');
                return;
              }
              setSubmitError('');
              setStep('confirm');
            }}
            className="w-full py-3 rounded-full text-sm font-semibold uppercase tracking-widest text-white transition-all hover:opacity-90"
            style={{ background: '#355E3B' }}
          >
            Review Booking →
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Confirm ──────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <button
            onClick={() => setStep('details')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <h3 className="font-serif text-lg text-foreground">Confirm Your Booking</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Review your details before confirming.</p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="rounded-xl border border-border overflow-hidden">
            {[
              { label: 'Date', value: formatDisplayDate(selectedDate) },
              { label: 'Time', value: `${formatDisplayTime(selectedTime)} CST` },
              { label: 'Duration', value: `${duration} minutes` },
              { label: 'Name', value: clientName },
              { label: 'Email', value: clientEmail },
              ...(notes ? [{ label: 'Notes', value: notes }] : []),
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-start gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-16 shrink-0 pt-0.5">{row.label}</span>
                <span className="text-sm text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4 text-sm text-muted-foreground" style={{ background: 'rgba(200,150,90,0.08)', border: '1px solid rgba(200,150,90,0.2)' }}>
            <span className="font-semibold text-foreground">A confirmation email</span> with your Google Meet link and prep instructions will be sent to <span className="font-medium">{clientEmail}</span>.
          </div>
          {submitError && (
            <p className="text-xs text-red-500 font-medium">{submitError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-full text-sm font-semibold uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#355E3B' }}
          >
            {submitting ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Confirming…
              </>
            ) : (
              'Confirm Booking →'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Success ──────────────────────────────────────────────────────────
  if (step === 'success' && bookingResult) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-8 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(53,94,59,0.12)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 className="font-serif text-2xl text-foreground mb-2">
            You&apos;re booked, {bookingResult.clientName.split(' ')[0]}!
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
            Your {bookingResult.durationMinutes}-minute consultation is confirmed for{' '}
            <strong className="text-foreground">{formatDisplayDate(bookingResult.bookingDate)}</strong> at{' '}
            <strong className="text-foreground">{formatDisplayTime(bookingResult.bookingTime)} CST</strong>.
          </p>

          {bookingResult.emailSent && (
            <div
              className="w-full rounded-xl p-4 mb-5 text-sm text-left"
              style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
            >
              <p className="font-semibold mb-1" style={{ color: '#355E3B' }}>
                ✓ Confirmation email sent to {bookingResult.clientEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                Check your inbox for your Google Meet link, prep instructions, and calendar invite.
              </p>
            </div>
          )}

          <div className="w-full rounded-xl border border-border p-4 mb-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Google Meet Link</p>
            <a
              href={bookingResult.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium break-all"
              style={{ color: '#C8965A' }}
            >
              {bookingResult.meetingLink}
            </a>
          </div>

          {/* Calendar add buttons */}
          <div className="w-full flex flex-col gap-2 mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-left mb-1">Add to Your Calendar</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {bookingResult.googleCalendarUrl && (
                <a
                  href={bookingResult.googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: '#1a73e8' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Google Calendar
                </a>
              )}
              {bookingResult.icsDownloadUrl && (
                <a
                  href={bookingResult.icsDownloadUrl}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: '#0078d4' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Outlook / Apple Calendar
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <a
              href={bookingResult.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-full text-sm font-semibold uppercase tracking-widest text-white text-center transition-all hover:opacity-90"
              style={{ background: '#355E3B' }}
            >
              Join Meeting
            </a>
            <button
              onClick={() => {
                setStep('duration');
                setSelectedDate('');
                setSelectedTime('');
                setClientName('');
                setClientEmail('');
                setNotes('');
                setBookingResult(null);
              }}
              className="flex-1 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 border"
              style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'transparent' }}
            >
              Book Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
