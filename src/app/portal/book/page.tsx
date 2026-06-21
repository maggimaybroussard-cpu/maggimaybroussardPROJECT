'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inquiry {
  id: string;
  name: string;
  service: string;
  booking_stage: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
}

interface ExistingBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  booking_type: string;
  status: string;
  client_name: string;
  meeting_location: string;
}

type BookingType = 'initial_consultation' | 'case_checkin' | 'follow_up' | 'document_review';
type Step = 'type' | 'date' | 'time' | 'confirm' | 'success';

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/documents', label: 'Documents' },
  { href: '/portal/book', label: 'Book Appointment' },
];

const BOOKING_TYPES: { type: BookingType; label: string; desc: string; duration: string }[] = [
  { type: 'initial_consultation', label: 'Initial Consultation', desc: 'First meeting to discuss your legal matter and explore options.', duration: '30 min' },
  { type: 'case_checkin', label: 'Case Check-In', desc: 'Progress update on your active case with your paralegal.', duration: '20 min' },
  { type: 'follow_up', label: 'Follow-Up Meeting', desc: 'Review next steps, documents, or outstanding questions.', duration: '30 min' },
  { type: 'document_review', label: 'Document Review', desc: 'Walk through prepared documents or filings together.', duration: '45 min' },
];

// Available time slots (9am–5pm CT, Mon–Fri)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatExistingBookingDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function getBookingTypeLabel(type: string) {
  return BOOKING_TYPES.find((b) => b.type === type)?.label ?? type;
}

// Build calendar days for a given month
function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookAppointmentPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Booking flow state
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<BookingType>('initial_consultation');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ExistingBooking | null>(null);
  const [googleEventLink, setGoogleEventLink] = useState<string | null>(null);

  // Calendar navigation
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessData?.inquiry_id) {
        const { data: inq } = await supabase
          .from('contact_inquiries')
          .select('id,name,service,booking_stage,calendly_start_time,calendly_event_name')
          .eq('id', accessData.inquiry_id)
          .single();
        if (inq) setInquiry(inq);
      }

      // Fetch existing portal bookings
      const { data: bookings } = await supabase
        .from('consultation_bookings')
        .select('id,booking_date,booking_time,booking_type,status,client_name,meeting_location')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .order('booking_date', { ascending: true });
      setExistingBookings((bookings as ExistingBooking[]) ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  // Calendar helpers
  const calDays = buildCalendarDays(calYear, calMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function isDateDisabled(day: number) {
    let d = new Date(calYear, calMonth, day);
    const dow = d.getDay();
    // Disable weekends and past dates
    if (dow === 0 || dow === 6) return true;
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr < todayStr;
  }

  function buildDateStr(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  // Prevent navigating to past months
  const isPrevDisabled = calYear === today.getFullYear() && calMonth <= today.getMonth();

  async function handleSubmit() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const clientName = inquiry?.name ?? user?.email?.split('@')[0] ?? 'Client';
      const clientEmail = user?.email ?? '';

      const res = await fetch('/api/portal/book-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail,
          bookingType: selectedType,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          timezone: 'America/Chicago',
          notes: notes || null,
          userId: user?.id ?? null,
          inquiryId: inquiry?.id ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Booking failed');

      setConfirmedBooking({
        id: json.booking.id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        booking_type: selectedType,
        status: 'confirmed',
        client_name: clientName,
        meeting_location: 'Google Meet',
      });
      setGoogleEventLink(json.googleEventLink ?? null);
      setStep('success');
      fetchData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#355E3B' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                    item.href === '/portal/book' ?'border-current text-white' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                  style={item.href === '/portal/book' ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">{user?.email}</span>
              <button
                onClick={() => setMobileNavOpen((o) => !o)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Menu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <div className="lg:hidden border-t border-border/60 py-3 flex flex-wrap gap-2 pb-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Client Portal</p>
          <h1 className="text-2xl md:text-3xl font-serif tracking-tight text-foreground">Book an Appointment</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Schedule a consultation or case check-in with Maggi May Broussard directly from your portal.
          </p>
        </div>

        {/* Existing upcoming bookings */}
        {existingBookings.length > 0 && step !== 'success' && (
          <div className="mb-6 p-4 rounded-xl border flex items-start gap-3" style={{ borderColor: 'rgba(53,94,59,0.25)', background: 'rgba(53,94,59,0.05)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#355E3B' }}>
                Upcoming Appointment{existingBookings.length > 1 ? 's' : ''}
              </p>
              {existingBookings.map((b) => (
                <div key={b.id} className="mb-1 last:mb-0">
                  <p className="text-sm font-semibold text-foreground">{getBookingTypeLabel(b.booking_type)}</p>
                  <p className="text-xs text-muted-foreground font-light">
                    {formatExistingBookingDate(b.booking_date)} at {formatTime(b.booking_time)} CT · {b.meeting_location}
                  </p>
                </div>
              ))}
              <p className="text-xs mt-1.5" style={{ color: '#355E3B' }}>You can still book an additional appointment below.</p>
            </div>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {step === 'success' && confirmedBooking && (
          <div className="max-w-lg mx-auto">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(53,94,59,0.1)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-serif text-foreground mb-2">Appointment Confirmed!</h2>
                <p className="text-sm text-muted-foreground font-light mb-6">
                  A confirmation email has been sent to <strong>{user?.email}</strong>
                </p>

                <div className="bg-secondary/30 rounded-xl p-5 text-left mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-semibold text-foreground">{formatDate(confirmedBooking.booking_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="text-sm font-semibold text-foreground">{formatTime(confirmedBooking.booking_time)} CT</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-semibold text-foreground">{getBookingTypeLabel(confirmedBooking.booking_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-sm font-semibold text-foreground">Google Meet (link in email)</p>
                    </div>
                  </div>
                </div>

                {/* Google Calendar link */}
                {googleEventLink && (
                  <a
                    href={googleEventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-sm font-medium mb-4 transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'rgba(53,94,59,0.05)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    View in Google Calendar
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setStep('type');
                      setSelectedDate('');
                      setSelectedTime('');
                      setNotes('');
                      setConfirmedBooking(null);
                      setGoogleEventLink(null);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    Book Another
                  </button>
                  <Link
                    href="/portal/dashboard"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:opacity-90"
                    style={{ background: '#355E3B' }}
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKING FLOW ── */}
        {step !== 'success' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Steps sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Progress steps */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Booking Steps</p>
                <div className="space-y-3">
                  {[
                    { key: 'type', label: 'Appointment Type', num: 1 },
                    { key: 'date', label: 'Select Date', num: 2 },
                    { key: 'time', label: 'Select Time', num: 3 },
                    { key: 'confirm', label: 'Confirm & Book', num: 4 },
                  ].map(({ key, label, num }) => {
                    const stepOrder = ['type', 'date', 'time', 'confirm'];
                    const currentIdx = stepOrder.indexOf(step);
                    const thisIdx = stepOrder.indexOf(key);
                    const isDone = thisIdx < currentIdx;
                    const isActive = key === step;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                          style={{
                            background: isDone ? '#355E3B' : isActive ? 'rgba(53,94,59,0.12)' : 'var(--secondary)',
                            color: isDone ? '#fff' : isActive ? '#355E3B' : 'var(--muted-foreground)',
                          }}
                        >
                          {isDone ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : num}
                        </div>
                        <p className={`text-xs font-medium ${isActive ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                          {label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What to expect */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What to Expect</p>
                <div className="space-y-3">
                  {[
                    { icon: '📋', label: 'Confirmation email', desc: 'Sent immediately after booking' },
                    { icon: '🔔', label: 'Reminder', desc: '24 hours before your appointment' },
                    { icon: '📹', label: 'Google Meet', desc: 'Link included in your email' },
                    { icon: '📎', label: 'Prep materials', desc: 'Bring any relevant documents' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground font-light">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact alternative */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Prefer to message?</p>
                <p className="text-xs text-muted-foreground font-light mb-3">Send a message through the portal and we will respond within 1 business day.</p>
                <Link
                  href="/portal/messages"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ color: '#355E3B' }}
                >
                  Go to Messages
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: Main booking panel */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Panel header */}
                <div className="px-5 py-4 border-b border-border/60 flex items-center gap-3" style={{ background: 'rgba(53,94,59,0.04)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
                      {step === 'type' && 'Choose Appointment Type'}
                      {step === 'date' && 'Select a Date'}
                      {step === 'time' && 'Select a Time'}
                      {step === 'confirm' && 'Confirm Your Booking'}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-light mt-0.5">
                      {selectedDate && step !== 'type' ? formatDateShort(selectedDate) : 'Maggi May Broussard · Google Meet'}
                      {selectedTime && step === 'confirm' ? ` · ${formatTime(selectedTime)} CT` : ''}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  {/* ── STEP 1: Type ── */}
                  {step === 'type' && (
                    <div className="space-y-3">
                      {BOOKING_TYPES.map(({ type, label, desc, duration }) => (
                        <button
                          key={type}
                          onClick={() => setSelectedType(type)}
                          className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                            selectedType === type ? 'border-current' : 'border-border hover:border-border/80 hover:bg-muted/20'
                          }`}
                          style={selectedType === type ? { borderColor: '#355E3B', background: 'rgba(53,94,59,0.05)' } : {}}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold" style={selectedType === type ? { color: '#355E3B' } : {}}>
                              {label}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{duration}</span>
                              {selectedType === type && (
                                <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#355E3B' }}>
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground font-light">{desc}</p>
                        </button>
                      ))}
                      <button
                        onClick={() => setStep('date')}
                        className="w-full mt-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#355E3B' }}
                      >
                        Continue — Select Date →
                      </button>
                    </div>
                  )}

                  {/* ── STEP 2: Date (Calendar) ── */}
                  {step === 'date' && (
                    <div>
                      {/* Month navigation */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={prevMonth}
                          disabled={isPrevDisabled}
                          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[calMonth]} {calYear}</p>
                        <button
                          onClick={nextMonth}
                          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground py-1">{d}</div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {calDays.map((day, i) => {
                          if (!day) return <div key={`empty-${i}`} />;
                          const dateStr = buildDateStr(day);
                          const disabled = isDateDisabled(day);
                          const isSelected = dateStr === selectedDate;
                          const isToday = dateStr === todayStr;
                          return (
                            <button
                              key={dateStr}
                              onClick={() => !disabled && setSelectedDate(dateStr)}
                              disabled={disabled}
                              className={`aspect-square rounded-lg text-xs font-medium transition-all duration-150 ${
                                disabled
                                  ? 'text-muted-foreground/30 cursor-not-allowed'
                                  : isSelected
                                  ? 'text-white font-bold'
                                  : isToday
                                  ? 'border font-bold' :'hover:bg-secondary/50 text-foreground'
                              }`}
                              style={
                                isSelected
                                  ? { background: '#355E3B' }
                                  : isToday && !disabled
                                  ? { borderColor: '#355E3B', color: '#355E3B' }
                                  : {}
                              }
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-3 mt-5">
                        <button
                          onClick={() => setStep('type')}
                          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={() => selectedDate && setStep('time')}
                          disabled={!selectedDate}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: '#355E3B' }}
                        >
                          Continue — Select Time →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 3: Time ── */}
                  {step === 'time' && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Available times for <strong className="text-foreground">{formatDate(selectedDate)}</strong> (Central Time)
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTime(slot)}
                            className={`py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                              selectedTime === slot
                                ? 'text-white border-transparent' :'border-border text-foreground hover:border-current hover:bg-secondary/30'
                            }`}
                            style={selectedTime === slot ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                          >
                            {formatTime(slot)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setStep('date')}
                          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={() => selectedTime && setStep('confirm')}
                          disabled={!selectedTime}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: '#355E3B' }}
                        >
                          Continue — Review →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 4: Confirm ── */}
                  {step === 'confirm' && (
                    <div>
                      {/* Summary */}
                      <div className="bg-secondary/30 rounded-xl p-5 mb-5 space-y-3">
                        {[
                          { label: 'Type', value: getBookingTypeLabel(selectedType) },
                          { label: 'Date', value: formatDate(selectedDate) },
                          { label: 'Time', value: `${formatTime(selectedTime)} Central Time` },
                          { label: 'Duration', value: BOOKING_TYPES.find((b) => b.type === selectedType)?.duration ?? '30 min' },
                          { label: 'Location', value: 'Google Meet (link in confirmation email)' },
                          { label: 'With', value: 'Maggi May Broussard' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-start justify-between gap-4">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
                            <span className="text-xs font-semibold text-foreground text-right">{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Optional notes */}
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-foreground mb-2">
                          Notes <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Brief description of what you'd like to discuss…"
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 resize-none"
                          style={{ focusRingColor: '#355E3B' } as React.CSSProperties}
                        />
                      </div>

                      {/* Confirmation email notice */}
                      <div className="flex items-start gap-2.5 p-3.5 rounded-xl mb-5" style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <p className="text-xs text-muted-foreground font-light">
                          A confirmation email will be sent to <strong className="text-foreground">{user?.email}</strong> with your Google Meet link and appointment details.
                        </p>
                      </div>

                      {submitError && (
                        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                          {submitError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => setStep('time')}
                          disabled={submitting}
                          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                          style={{ background: '#355E3B' }}
                        >
                          {submitting ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                              Booking…
                            </>
                          ) : (
                            'Confirm Booking'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
