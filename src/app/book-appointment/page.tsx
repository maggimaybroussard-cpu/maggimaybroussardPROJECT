'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface FormData {
  serviceType: string;
  duration: 15 | 30 | 60;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  {
    id: 'initial_consultation',
    label: 'Initial Consultation',
    description: 'First meeting to discuss your legal matter, explore your options, and determine next steps.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'case_review',
    label: 'Case Review',
    description: 'In-depth review of your existing case materials, documents, and legal strategy.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'document_drafting',
    label: 'Document Drafting',
    description: 'Consultation to discuss drafting pleadings, motions, contracts, or legal correspondence.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    id: 'legal_research',
    label: 'Legal Research',
    description: 'Targeted research session on statutory, regulatory, or case law questions for your matter.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 'litigation_support',
    label: 'Litigation Support',
    description: 'Trial prep, exhibit organization, deposition summaries, and deadline tracking support.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'general_inquiry',
    label: 'General Inquiry',
    description: 'Not sure where to start? Let\'s talk through your needs and find the right path forward.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
];

const DURATIONS: { value: 15 | 30 | 60; label: string; note: string }[] = [
  { value: 15, label: '15 min', note: 'Quick question or follow-up' },
  { value: 30, label: '30 min', note: 'Standard consultation' },
  { value: 60, label: '60 min', note: 'In-depth case review' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookAppointmentPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    serviceType: '',
    duration: 30,
    date: '',
    time: '',
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<{ date: string; time: string; meetingLink?: string } | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calDays = buildCalendarDays(calYear, calMonth);
  const isPrevDisabled = calYear === today.getFullYear() && calMonth <= today.getMonth();

  function buildDateStr(day: number): string {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isDateDisabled(day: number): boolean {
    const dow = new Date(calYear, calMonth, day).getDay();
    if (dow === 0 || dow === 6) return true;
    return buildDateStr(day) < todayStr;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const fetchAvailability = useCallback(async (date: string, duration: number) => {
    if (!date) return;
    setLoadingSlots(true);
    setAvailableSlots([]);
    try {
      const res = await fetch(`/api/consultations/availability?date=${date}&duration=${duration}`);
      const data = await res.json();
      setAvailableSlots(data.available ?? []);
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (form.date) {
      fetchAvailability(form.date, form.duration);
      setForm(f => ({ ...f, time: '' }));
    }
  }, [form.date, form.duration, fetchAvailability]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: form.name,
          clientEmail: form.email,
          clientPhone: form.phone || null,
          bookingType: form.serviceType,
          bookingDate: form.date,
          bookingTime: form.time,
          durationMinutes: form.duration,
          timezone: 'America/Chicago',
          notes: form.notes || null,
          source: 'book_appointment_page',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Booking failed. Please try again.');
      setConfirmedBooking({
        date: form.date,
        time: form.time,
        meetingLink: json.meetingLink ?? json.booking?.meeting_location ?? undefined,
      });
      setStep(4);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedService = SERVICE_TYPES.find(s => s.id === form.serviceType);
  const canStep1 = !!form.serviceType;
  const canStep2 = !!form.date && !!form.time;
  const canStep3 = !!form.name.trim() && !!form.email.trim() && form.email.includes('@');

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          className="relative pt-28 pb-14 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 55%, #4a7c52 100%)' }}
        >
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-2xl mx-auto text-center relative z-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-6 transition-colors duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to Services
            </Link>

            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
            >
              Schedule an Appointment
            </span>

            <h1 className="font-serif text-3xl md:text-5xl text-white leading-tight mb-4">
              Book Your
              <br />
              <span className="italic opacity-80">Appointment</span>
            </h1>
            <p className="text-white/75 text-base md:text-lg leading-relaxed max-w-lg mx-auto">
              Select your service type, choose a date and time that works for you, and receive instant confirmation.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {[
                { label: 'Real-time availability' },
                { label: 'Instant confirmation' },
                { label: 'Google Meet included' },
              ].map(item => (
                <span
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Step Progress ─────────────────────────────────────────────────── */}
        {step !== 4 && (
          <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="max-w-3xl mx-auto px-5 py-4">
              <div className="flex items-center gap-1">
                {(['Service', 'Date & Time', 'Your Details'] as const).map((label, i) => {
                  const stepNum = (i + 1) as Step;
                  const isActive = step === stepNum;
                  const isDone = step > stepNum;
                  return (
                    <React.Fragment key={label}>
                      <button
                        onClick={() => isDone && setStep(stepNum)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                          isActive
                            ? 'bg-accent text-white'
                            : isDone
                            ? 'text-accent cursor-pointer hover:bg-accent/10' :'text-muted-foreground cursor-default'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            isActive
                              ? 'bg-white text-accent border-white'
                              : isDone
                              ? 'bg-accent text-white border-accent' :'border-border text-muted-foreground'
                          }`}
                        >
                          {isDone ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : stepNum}
                        </span>
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                      {i < 2 && (
                        <div className={`flex-1 h-px mx-1 transition-colors duration-300 ${step > stepNum ? 'bg-accent' : 'bg-border'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-5 py-10 md:py-14">

          {/* ── Step 1: Service Selection ──────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">What can we help you with?</h2>
                <p className="text-muted-foreground text-sm">Select the type of appointment that best fits your needs.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {SERVICE_TYPES.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setForm(f => ({ ...f, serviceType: service.id }))}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-200 group ${
                      form.serviceType === service.id
                        ? 'border-accent bg-accent/5' :'border-border hover:border-accent/40 bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                          form.serviceType === service.id ? 'bg-accent text-white' : 'bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent'
                        }`}
                      >
                        {service.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold text-sm ${form.serviceType === service.id ? 'text-accent' : 'text-foreground'}`}>
                            {service.label}
                          </p>
                          {form.serviceType === service.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{service.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Duration selector */}
              <div className="mb-8">
                <p className="text-sm font-semibold text-foreground mb-3 uppercase tracking-widest">Session Length</p>
                <div className="flex gap-3">
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setForm(f => ({ ...f, duration: d.value }))}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all duration-200 ${
                        form.duration === d.value
                          ? 'border-accent bg-accent/5' :'border-border hover:border-accent/40 bg-card'
                      }`}
                    >
                      <p className={`font-bold text-base ${form.duration === d.value ? 'text-accent' : 'text-foreground'}`}>{d.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.note}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canStep1}
                className="w-full py-3.5 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canStep1 ? '#355E3B' : undefined, color: canStep1 ? '#fff' : undefined, backgroundColor: !canStep1 ? 'var(--muted)' : undefined }}
              >
                Continue — Choose Date & Time
              </button>
            </div>
          )}

          {/* ── Step 2: Date & Time ────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div className="mb-8">
                <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">Pick a date and time</h2>
                <p className="text-muted-foreground text-sm">Available Monday–Friday, 9 AM–5 PM CST. Weekends excluded.</p>
              </div>

              <div className="grid md:grid-cols-[1fr_auto] gap-6 mb-8">
                {/* Calendar */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={prevMonth}
                      disabled={isPrevDisabled}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <p className="font-semibold text-sm text-foreground">{MONTH_NAMES[calMonth]} {calYear}</p>
                    <button
                      onClick={nextMonth}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-border hover:bg-muted transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground py-1">{d}</div>
                    ))}
                  </div>

                  {/* Days */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {calDays.map((day, idx) => {
                      if (!day) return <div key={`empty-${idx}`} />;
                      const dateStr = buildDateStr(day);
                      const disabled = isDateDisabled(day);
                      const isSelected = form.date === dateStr;
                      const isToday = dateStr === todayStr;
                      return (
                        <button
                          key={day}
                          onClick={() => !disabled && setForm(f => ({ ...f, date: dateStr }))}
                          disabled={disabled}
                          className={`aspect-square rounded-lg text-xs font-medium transition-all duration-150 ${
                            isSelected
                              ? 'bg-accent text-white font-bold'
                              : isToday && !disabled
                              ? 'border-2 border-accent text-accent font-bold hover:bg-accent/10'
                              : disabled
                              ? 'text-muted-foreground/30 cursor-not-allowed'
                              : 'text-foreground hover:bg-accent/10 hover:text-accent cursor-pointer'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div className="md:w-52">
                  {!form.date ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground">Select a date to see available times</p>
                    </div>
                  ) : loadingSlots ? (
                    <div className="h-full flex items-center justify-center py-10 md:py-0">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-muted-foreground">Loading times…</p>
                      </div>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-0">
                      <p className="text-sm font-medium text-foreground mb-1">No availability</p>
                      <p className="text-xs text-muted-foreground">Please select a different date.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                        {new Date(form.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                        {availableSlots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => setForm(f => ({ ...f, time: slot }))}
                            className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-center transition-all duration-150 border ${
                              form.time === slot
                                ? 'bg-accent text-white border-accent' :'border-border text-foreground hover:border-accent/60 hover:bg-accent/5'
                            }`}
                          >
                            {formatTime(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected summary */}
              {form.date && form.time && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl mb-6 border"
                  style={{ background: 'rgba(53,94,59,0.06)', borderColor: 'rgba(53,94,59,0.2)' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatDateDisplay(form.date)} at {formatTime(form.time)}</p>
                    <p className="text-xs text-muted-foreground">{form.duration} min · {selectedService?.label ?? form.serviceType}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canStep2}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: canStep2 ? '#355E3B' : 'var(--muted)', color: canStep2 ? '#fff' : undefined }}
                >
                  Continue — Your Details
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Contact Details ────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <div className="mb-8">
                <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">Your contact details</h2>
                <p className="text-muted-foreground text-sm">We'll send your confirmation and Google Meet link to this email.</p>
              </div>

              {/* Booking summary card */}
              <div
                className="p-4 rounded-xl border mb-8"
                style={{ background: 'rgba(53,94,59,0.04)', borderColor: 'rgba(53,94,59,0.18)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#355E3B' }}>Booking Summary</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Service', value: selectedService?.label ?? form.serviceType },
                    { label: 'Date', value: form.date ? new Date(form.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                    { label: 'Time', value: form.time ? `${formatTime(form.time)} CST` : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="jane@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Phone Number <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 000-0000"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Brief Description <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Share a brief overview of your legal matter or any questions you'd like to address…"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors resize-none"
                  />
                </div>
              </div>

              {submitError && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canStep3 || submitting}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: canStep3 && !submitting ? '#355E3B' : 'var(--muted)', color: canStep3 && !submitting ? '#fff' : undefined }}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Confirming…
                    </>
                  ) : (
                    'Confirm Appointment'
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                By booking, you agree to our{' '}
                <Link href="/terms-of-service" className="underline hover:text-foreground transition-colors">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy-policy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
              </p>
            </div>
          )}

          {/* ── Step 4: Confirmation ───────────────────────────────────────── */}
          {step === 4 && confirmedBooking && (
            <div className="text-center py-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(53,94,59,0.12)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <span
                className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
                style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
              >
                Appointment Confirmed
              </span>

              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
                You're all set, {form.name.split(' ')[0]}!
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 leading-relaxed">
                A confirmation email with your Google Meet link has been sent to <strong>{form.email}</strong>. We look forward to speaking with you.
              </p>

              {/* Booking details */}
              <div
                className="max-w-sm mx-auto p-5 rounded-2xl border text-left mb-8"
                style={{ background: 'rgba(53,94,59,0.04)', borderColor: 'rgba(53,94,59,0.18)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#355E3B' }}>Appointment Details</p>
                <div className="space-y-3">
                  {[
                    { label: 'Service', value: selectedService?.label ?? form.serviceType },
                    { label: 'Date', value: formatDateDisplay(confirmedBooking.date) },
                    { label: 'Time', value: `${formatTime(confirmedBooking.time)} CST` },
                    { label: 'Duration', value: `${form.duration} minutes` },
                    { label: 'Format', value: 'Google Meet (link in email)' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest flex-shrink-0">{item.label}</p>
                      <p className="text-sm font-medium text-foreground text-right">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/portal/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Access Client Portal
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
