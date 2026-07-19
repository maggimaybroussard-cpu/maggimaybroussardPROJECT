'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { trackCTAClick } from '@/lib/analytics';

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
}

interface BookingForm {
  name: string;
  email: string;
  phone: string;
  service: string;
  notes: string;
  date: string;
  time: string;
}

const SERVICES = [
  { value: 'initial_consultation', label: 'Initial Consultation (60 min)', duration: 60 },
  { value: 'follow_up', label: 'Follow-Up Meeting (30 min)', duration: 30 },
  { value: 'document_review', label: 'Document Review (45 min)', duration: 45 },
  { value: 'strategy_session', label: 'Strategy Session (60 min)', duration: 60 },
  { value: 'case_checkin', label: 'Case Check-In (20 min)', duration: 20 },
];

const GOOGLE_WORKSPACE_TOOLS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" fillOpacity="0.15"/>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="1.5"/>
        <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#4285F4"/>
      </svg>
    ),
    name: 'Google Calendar',
    desc: 'Auto-synced to Maggi\'s calendar',
    color: '#4285F4',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="23 7 16 12 23 17 23 7" fill="#00897B" fillOpacity="0.15" stroke="#00897B" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="1" y="5" width="15" height="14" rx="2" fill="#00897B" fillOpacity="0.1" stroke="#00897B" strokeWidth="1.5"/>
      </svg>
    ),
    name: 'Google Meet',
    desc: 'Video link sent on confirmation',
    color: '#00897B',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#4285F4" fillOpacity="0.1" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
        <polyline points="14 2 14 8 20 8" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
        <polyline points="10 9 9 9 8 9" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    name: 'Google Docs',
    desc: 'Intake notes & case documents',
    color: '#4285F4',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" fillOpacity="0.1" stroke="#0F9D58" strokeWidth="1.5"/>
        <line x1="3" y1="9" x2="21" y2="9" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="3" y1="15" x2="21" y2="15" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="9" y1="3" x2="9" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
        <line x1="15" y1="3" x2="15" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
      </svg>
    ),
    name: 'Google Sheets',
    desc: 'Billing & case tracking',
    color: '#0F9D58',
  },
];

function generateTimeSlots(busyPeriods: Array<{ start: string; end: string }>): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const hours = [9, 9.5, 10, 10.5, 11, 11.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5];

  for (const h of hours) {
    const hour = Math.floor(h);
    const min = h % 1 === 0.5 ? 30 : 0;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    const label = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;

    let available = true;
    for (const busy of busyPeriods) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      const slotHour = hour;
      const slotMin = min;
      const slotDate = new Date();
      slotDate.setHours(slotHour, slotMin, 0, 0);
      if (slotDate >= busyStart && slotDate < busyEnd) {
        available = false;
        break;
      }
    }

    slots.push({ time: timeStr, label, available });
  }

  return slots;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function BookingPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>({
    name: '', email: '', phone: '', service: 'initial_consultation', notes: '', date: '', time: '',
  });

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const fetchAvailability = useCallback(async (dateStr: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/consultations/availability?date=${dateStr}`);
      const data = await res.json();
      const busy: Array<{ start: string; end: string }> = data.busySlots ?? [];
      setTimeSlots(generateTimeSlots(busy));
    } catch {
      setTimeSlots(generateTimeSlots([]));
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedTime('');
    setForm(f => ({ ...f, date: dateStr, time: '' }));
    fetchAvailability(dateStr);
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setSelectedTime(slot.time);
    setForm(f => ({ ...f, time: slot.time }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: form.name,
          clientEmail: form.email,
          clientPhone: form.phone,
          bookingType: form.service,
          bookingDate: form.date,
          bookingTime: form.time,
          timezone: 'America/Chicago',
          notes: form.notes,
          meetingLocation: 'Google Meet',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setSubmitted(true);
      trackCTAClick('Book Consultation', 'booking_page', '/booking');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const isDateDisabled = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    const dayOfWeek = d.getDay();
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dayOfWeek === 0 || dateStr < todayStr;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const selectedService = SERVICES.find(s => s.value === form.service);

  if (submitted) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-lg w-full text-center py-20">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-serif text-3xl text-foreground mb-3">Consultation Booked!</h1>
            <p className="text-muted-foreground mb-2">
              Your <strong>{selectedService?.label}</strong> is confirmed for{' '}
              <strong>{formatDateDisplay(form.date)}</strong> at{' '}
              <strong>{timeSlots.find(s => s.time === form.time)?.label ?? form.time}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              A Google Meet link and calendar invite have been sent to <strong>{form.email}</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border border-border text-foreground hover:bg-muted/50 transition-all">
                Back to Home
              </Link>
              <Link href="/portal/dashboard" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: '#355E3B' }}>
                Client Portal
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">

        {/* Hero */}
        <section
          className="relative pt-28 pb-12 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e3d24 0%, #2d5a35 55%, #355E3B 100%)' }}
        >
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="max-w-5xl mx-auto relative z-10">
            <Link href="/services" className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-6 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to Services
            </Link>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                  Book a Consultation
                </span>
                <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-4">
                  Schedule Your<br /><span className="italic opacity-80">Consultation</span>
                </h1>
                <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-lg">
                  Pick a date, choose your time, and get an instant Google Meet link — all synced directly to Maggi's calendar.
                </p>
              </div>
              {/* Google Workspace badges */}
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {GOOGLE_WORKSPACE_TOOLS.map(tool => (
                  <div key={tool.name} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    {tool.icon}
                    <span className="text-xs font-medium text-white/80">{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Step indicator */}
        <div className="bg-background border-b border-border">
          <div className="max-w-5xl mx-auto px-5 md:px-10 py-4">
            <div className="flex items-center gap-2">
              {[
                { n: 1, label: 'Pick Date & Time' },
                { n: 2, label: 'Your Details' },
                { n: 3, label: 'Confirm' },
              ].map((s, i) => (
                <React.Fragment key={s.n}>
                  <button
                    onClick={() => { if (s.n < step || (s.n === 2 && selectedDate && selectedTime)) setStep(s.n as 1 | 2 | 3); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${step === s.n ? 'text-foreground' : step > s.n ? 'text-accent cursor-pointer' : 'text-muted-foreground'}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.n ? 'bg-foreground text-background' : step > s.n ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={step > s.n ? { background: '#355E3B' } : {}}>
                      {step > s.n ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : s.n}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < 2 && <div className={`flex-1 h-px max-w-16 ${step > s.n ? 'bg-accent' : 'bg-border'}`} style={step > s.n ? { background: '#355E3B' } : {}} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10">

          {/* STEP 1: Calendar + Time Slots */}
          {step === 1 && (
            <div className="grid lg:grid-cols-[1fr_320px] gap-8">
              {/* Calendar */}
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <h2 className="font-semibold text-foreground">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
                  <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
                <div className="p-5">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {DAY_NAMES.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
                    ))}
                  </div>
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const disabled = isDateDisabled(day);
                      const isSelected = selectedDate === dateStr;
                      const isToday = dateStr === todayStr;
                      return (
                        <button
                          key={day}
                          disabled={disabled}
                          onClick={() => handleDateSelect(dateStr)}
                          className={`
                            aspect-square rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-center
                            ${disabled ? 'text-muted-foreground/40 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}
                            ${isSelected ? 'text-white shadow-sm' : ''}
                            ${isToday && !isSelected ? 'ring-2 ring-offset-1 font-bold' : ''}
                          `}
                          style={isSelected ? { background: '#355E3B' } : isToday && !isSelected ? { ringColor: '#355E3B' } : {}}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Legend */}
                <div className="px-5 pb-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: '#355E3B' }} /> Selected</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-current" /> Today</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-muted-foreground/20" /> Unavailable</span>
                </div>
              </div>

              {/* Time slots */}
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">
                    {selectedDate ? formatDateDisplay(selectedDate) : 'Select a date to see available times'}
                  </h3>
                  {selectedDate && (
                    <p className="text-xs text-muted-foreground mt-0.5">All times in Central Time (CT)</p>
                  )}
                </div>
                <div className="p-4">
                  {!selectedDate && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <p className="text-sm text-muted-foreground">Pick a date on the calendar to view available time slots</p>
                    </div>
                  )}
                  {selectedDate && loadingSlots && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#355E3B', borderTopColor: 'transparent' }} />
                      <p className="text-sm text-muted-foreground">Checking Maggi's calendar…</p>
                    </div>
                  )}
                  {selectedDate && !loadingSlots && (
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.map(slot => (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => handleTimeSelect(slot)}
                          className={`
                            px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-150
                            ${!slot.available ? 'border-border text-muted-foreground/40 cursor-not-allowed bg-muted/30 line-through' : ''}
                            ${slot.available && selectedTime !== slot.time ? 'border-border text-foreground hover:border-accent hover:bg-accent/5' : ''}
                            ${selectedTime === slot.time ? 'text-white border-transparent' : ''}
                          `}
                          style={selectedTime === slot.time ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedDate && selectedTime && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => setStep(2)}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: '#355E3B' }}
                    >
                      Continue →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Contact Details */}
          {step === 2 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Selected slot summary */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ background: 'rgba(53,94,59,0.04)' }}>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Your Appointment</p>
                    <p className="font-semibold text-foreground text-sm">{formatDateDisplay(selectedDate)} · {timeSlots.find(s => s.time === selectedTime)?.label}</p>
                  </div>
                  <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground underline">Change</button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="p-6 space-y-5">
                  {/* Service type */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Service Type</label>
                    <select
                      value={form.service}
                      onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                      style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                    >
                      {SERVICES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Full Name <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Email Address <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Google Meet link will be sent here</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(555) 000-0000"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Brief Description</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Briefly describe your legal support needs…"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 placeholder:text-muted-foreground resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: '#355E3B' }}
                  >
                    Review Booking →
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="font-semibold text-foreground">Confirm Your Booking</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Review the details below before confirming</p>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { label: 'Date', value: formatDateDisplay(selectedDate) },
                    { label: 'Time', value: `${timeSlots.find(s => s.time === selectedTime)?.label ?? selectedTime} CT` },
                    { label: 'Service', value: selectedService?.label ?? form.service },
                    { label: 'Name', value: form.name },
                    { label: 'Email', value: form.email },
                    ...(form.phone ? [{ label: 'Phone', value: form.phone }] : []),
                    ...(form.notes ? [{ label: 'Notes', value: form.notes }] : []),
                  ].map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground w-24 shrink-0">{item.label}</span>
                      <span className="text-sm font-medium text-foreground text-right">{item.value}</span>
                    </div>
                  ))}

                  {/* Google Workspace confirmation */}
                  <div className="rounded-xl p-4 mt-2" style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.15)' }}>
                    <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-widest">What happens next</p>
                    <div className="space-y-2">
                      {[
                        { icon: '📅', text: 'Google Calendar invite sent to your email' },
                        { icon: '🎥', text: 'Google Meet link included in the invite' },
                        { icon: '📄', text: 'Intake questionnaire link sent via email' },
                        { icon: '🔔', text: '24-hour reminder sent before your appointment' },
                      ].map(item => (
                        <div key={item.text} className="flex items-center gap-2 text-sm text-foreground">
                          <span>{item.icon}</span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {submitError && (
                    <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                      {submitError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted/50 transition-all"
                    >
                      ← Edit Details
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: '#355E3B' }}
                    >
                      {submitting ? 'Booking…' : 'Confirm Booking'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Booking a consultation does not create an attorney-client relationship.{' '}
                <Link href="/disclaimers" className="underline hover:text-foreground">Full disclaimer</Link>
              </p>
            </div>
          )}
        </div>

        {/* Google Workspace integration strip */}
        <section className="border-t border-border bg-muted/30 py-10 px-5 md:px-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-6">Powered by Google Workspace</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {GOOGLE_WORKSPACE_TOOLS.map(tool => (
                <div key={tool.name} className="bg-white rounded-xl border border-border p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tool.color}15` }}>
                    {tool.icon}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
