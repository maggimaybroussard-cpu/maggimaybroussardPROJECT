'use client';

import React, { useEffect, useState, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaymentModal from '@/components/PaymentModal';
import Link from 'next/link';
import {
  trackBookingPageView,
  trackCalendlyExternalLink,
  trackPaymentModalOpen,
  trackCalendlyBooking,
  trackLeadQuality,
  trackGoogleCalendarBookingClick,
  trackCTAClick,
} from '@/lib/analytics';

const CALENDLY_URL = 'https://calendly.com/maggimaybroussard/30min';
const GOOGLE_CALENDAR_BOOKING_URL =
  'https://calendly.com/maggimaybroussard/30min';

type BookingTab = 'calendly' | 'google' | 'schedule';

interface StaffMember {
  name: string;
  role: string;
  initials: string;
  color: string;
  hours: { day: string; slots: string }[];
  specialties: string[];
}

const STAFF: StaffMember[] = [
  {
    name: 'Maggi May Broussard',
    role: 'Contract Paralegal',
    initials: 'MB',
    color: '#355E3B',
    hours: [
      { day: 'Monday', slots: '9:00 AM – 5:00 PM' },
      { day: 'Tuesday', slots: '9:00 AM – 5:00 PM' },
      { day: 'Wednesday', slots: '9:00 AM – 5:00 PM' },
      { day: 'Thursday', slots: '9:00 AM – 5:00 PM' },
      { day: 'Friday', slots: '9:00 AM – 3:00 PM' },
      { day: 'Saturday', slots: 'By appointment' },
      { day: 'Sunday', slots: 'Closed' },
    ],
    specialties: ['Litigation Support', 'Contract Drafting', 'Legal Research', 'Document Review'],
  },
];

const BOOKING_BENEFITS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: '30-Minute Call',
    desc: 'Focused discovery — no fluff, no obligation',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 10l-4 4l-2-2" /><rect width="18" height="18" x="3" y="3" rx="2" />
      </svg>
    ),
    title: 'Instant Confirmation',
    desc: 'Calendar invite + intake link sent immediately',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    title: 'Google Meet',
    desc: 'Secure video link included with every booking',
  },
];

export default function AvailabilityPage() {
  const [activeTab, setActiveTab] = useState<BookingTab>('calendly');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bookedName, setBookedName] = useState('');
  const [bookedEmail, setBookedEmail] = useState('');
  const [showBookingBanner, setShowBookingBanner] = useState(false);
  const [calendlyScriptLoaded, setCalendlyScriptLoaded] = useState(false);
  const [calendlyWidgetReady, setCalendlyWidgetReady] = useState(false);
  const [gcalIframeLoaded, setGcalIframeLoaded] = useState(false);
  const calendlyContainerRef = useRef<HTMLDivElement>(null);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  useEffect(() => {
    trackBookingPageView();
  }, []);

  // Load Calendly script
  useEffect(() => {
    const existing = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    if (existing) {
      setCalendlyScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setCalendlyScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init Calendly widget when tab is active and script loaded
  useEffect(() => {
    if (!calendlyScriptLoaded || activeTab !== 'calendly' || !calendlyContainerRef.current) return;
    const timer = setTimeout(() => {
      const win = window as unknown as { Calendly?: { initInlineWidget: (opts: object) => void } };
      if (win.Calendly && calendlyContainerRef.current) {
        win.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: calendlyContainerRef.current,
          prefill: {},
          utm: {
            utmSource: 'website',
            utmMedium: 'availability_page',
            utmCampaign: 'consultation_booking',
          },
        });
        setCalendlyWidgetReady(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [calendlyScriptLoaded, activeTab]);

  // Listen for Calendly booking confirmation
  useEffect(() => {
    const handleCalendlyMessage = (e: MessageEvent) => {
      if (e.data?.event === 'calendly.event_scheduled') {
        trackCalendlyBooking('availability_page');
        trackLeadQuality({ source: 'calendly', conversionType: 'booking' });
        const invitee = e.data?.payload?.invitee;
        const name: string = invitee?.name ?? '';
        const email: string = invitee?.email ?? '';
        setBookedName(name);
        setBookedEmail(email);
        setShowBookingBanner(true);
        setTimeout(() => {
          trackPaymentModalOpen('post_booking');
          setPaymentOpen(true);
        }, 1800);
      }
    };
    window.addEventListener('message', handleCalendlyMessage);
    return () => window.removeEventListener('message', handleCalendlyMessage);
  }, []);

  const handlePaymentOpen = () => {
    trackPaymentModalOpen('availability_page');
    setPaymentOpen(true);
  };

  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Availability & Consultation Booking',
            description: 'Schedule a free 30-minute consultation with Maggi May Broussard. View staff schedules and book via Calendly or Google Calendar.',
            url: `${baseUrl}/availability`,
            image: `${baseUrl}/assets/images/og-image.png`,
            publisher: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              logo: { '@type': 'ImageObject', url: `${baseUrl}/assets/images/app_logo.png` },
            },
          }),
        }}
      />
      <Header />
      <main className="min-h-screen bg-background">

        {/* ── Hero ── */}
        <section
          className="relative pt-32 pb-20 px-6 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e3d24 0%, #2d5a35 50%, #355E3B 100%)' }}
        >
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/[0.06] pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-[300px] h-[300px] rounded-full border border-white/[0.06] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-4xl mx-auto relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                  Availability &amp; Booking
                </span>
                <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-4">
                  Schedule a Consultation
                </h1>
                <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-lg">
                  Book a free 30-minute call via Calendly or Google Calendar. View staff hours and pick the time that works for you.
                </p>
              </div>

              {/* Quick stats */}
              <div className="flex gap-4 shrink-0">
                {[
                  { value: '30 min', label: 'Free call' },
                  { value: 'Mon–Fri', label: 'Available' },
                  { value: '2 ways', label: 'To book' },
                ].map((s) => (
                  <div key={s.label} className="text-center px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <p className="font-serif text-xl text-white font-bold">{s.value}</p>
                    <p className="text-xs text-white/60 mt-0.5 uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Benefits row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10">
              {BOOKING_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white/80" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    {b.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="text-xs text-white/55">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Post-booking banner ── */}
        {showBookingBanner && (
          <section className="px-6 md:px-10 py-5 bg-background border-b border-border">
            <div className="max-w-5xl mx-auto">
              <div className="rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.2)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(53,94,59,0.15)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {bookedName ? `Consultation booked, ${bookedName.split(' ')[0]}!` : 'Consultation booked!'}
                    </p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5 leading-relaxed">
                      A confirmation email is on its way{bookedEmail ? ` to ${bookedEmail}` : ''}. Secure your slot with a consultation deposit.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { trackPaymentModalOpen('post_booking_banner'); setPaymentOpen(true); }}
                  className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Pay Deposit Now
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Tab Navigation ── */}
        <section className="sticky top-[60px] z-30 bg-background border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {([
                { id: 'calendly' as BookingTab, label: 'Calendly Booking', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )},
                { id: 'google' as BookingTab, label: 'Google Calendar', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )},
                { id: 'schedule' as BookingTab, label: 'Staff Schedule', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )},
              ] as { id: BookingTab; label: string; icon: React.ReactNode }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-accent text-accent' :'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Calendly Tab ── */}
        {activeTab === 'calendly' && (
          <section className="py-12 px-4 md:px-6 bg-background">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl text-foreground mb-1">Book via Calendly</h2>
                  <p className="text-sm text-muted-foreground">Select a date and time — instant confirmation with intake form link.</p>
                </div>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackCalendlyExternalLink}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open Calendly
                </a>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-background relative">
                {!calendlyWidgetReady && (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading Calendly…</p>
                  </div>
                )}
                <div
                  ref={calendlyContainerRef}
                  style={{ minWidth: '320px', height: calendlyWidgetReady ? '700px' : '0px', overflow: 'hidden' }}
                />
              </div>

              <p className="text-center text-xs text-muted-foreground mt-5">
                After booking you&apos;ll receive a confirmation with a link to complete your intake questionnaire.
              </p>
            </div>
          </section>
        )}

        {/* ── Google Calendar Tab ── */}
        {activeTab === 'google' && (
          <section className="py-12 px-4 md:px-6 bg-background">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl text-foreground mb-1">Book via Google Calendar</h2>
                  <p className="text-sm text-muted-foreground">Book directly into the firm&apos;s Google Calendar — no third-party account needed.</p>
                </div>
                <a
                  href={GOOGLE_CALENDAR_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackGoogleCalendarBookingClick('Open in Google Calendar', 'availability_page_gcal_tab')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shrink-0"
                  style={{ background: '#4285F4', color: '#fff' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Open in Google Calendar
                </a>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-background relative">
                {!gcalIframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center py-24 gap-4 bg-background z-10">
                    <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading Google Calendar…</p>
                  </div>
                )}
                <iframe
                  src={`${GOOGLE_CALENDAR_BOOKING_URL}?gv=true`}
                  title="Book a consultation via Google Calendar"
                  width="100%"
                  height="700"
                  frameBorder="0"
                  style={{ border: 0, display: 'block' }}
                  onLoad={() => setGcalIframeLoaded(true)}
                  allow="camera; microphone"
                />
              </div>

              <p className="text-center text-xs text-muted-foreground mt-5">
                You&apos;ll receive a Google Calendar invite with a Google Meet link after booking. Questions?{' '}
                <a
                  href="mailto:broussardlegalservices@gmail.com"
                  onClick={() => trackCTAClick('Email Direct', 'availability_page_gcal_tab', 'mailto:broussardlegalservices@gmail.com')}
                  className="text-accent hover:underline font-medium"
                >
                  broussardlegalservices@gmail.com
                </a>
              </p>
            </div>
          </section>
        )}

        {/* ── Staff Schedule Tab ── */}
        {activeTab === 'schedule' && (
          <section className="py-12 px-4 md:px-6 bg-background">
            <div className="max-w-5xl mx-auto">
              <div className="mb-10">
                <h2 className="font-serif text-2xl text-foreground mb-2">Staff Availability</h2>
                <p className="text-sm text-muted-foreground">Regular office hours and availability by team member. All times are Central Time (CT).</p>
              </div>

              {STAFF.map((member) => (
                <div key={member.name} className="mb-8">
                  {/* Staff card header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: member.color }}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-foreground">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                    <div className="ml-auto hidden sm:flex flex-wrap gap-2">
                      {member.specialties.map((s) => (
                        <span key={s} className="px-3 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Weekly schedule grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    {member.hours.map((h) => {
                      const isClosed = h.slots === 'Closed';
                      const isAppt = h.slots === 'By appointment';
                      return (
                        <div
                          key={h.day}
                          className={`rounded-xl p-3 border text-center ${
                            isClosed
                              ? 'bg-muted/30 border-border opacity-50'
                              : isAppt
                              ? 'border-dashed border-border bg-muted/20' :'bg-background border-border'
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{h.day.slice(0, 3)}</p>
                          {isClosed ? (
                            <p className="text-xs text-muted-foreground/60">Closed</p>
                          ) : isAppt ? (
                            <p className="text-xs text-muted-foreground italic">By appt.</p>
                          ) : (
                            <p className="text-xs font-medium text-foreground leading-snug">{h.slots}</p>
                          )}
                          {!isClosed && !isAppt && (
                            <div className="mt-2 w-full h-1 rounded-full" style={{ background: `${member.color}30` }}>
                              <div className="h-full rounded-full" style={{ background: member.color, width: '100%' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Specialties mobile */}
                  <div className="flex sm:hidden flex-wrap gap-2 mb-4">
                    {member.specialties.map((s) => (
                      <span key={s} className="px-3 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Timezone note */}
              <div className="rounded-xl p-4 bg-muted/30 border border-border flex items-start gap-3 mb-8">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All hours shown in <strong>Central Time (CT)</strong>. Appointments outside regular hours may be available upon request — please email{' '}
                  <a href="mailto:broussardlegalservices@gmail.com" className="text-accent hover:underline">broussardlegalservices@gmail.com</a> to inquire.
                </p>
              </div>

              {/* CTA to book */}
              <div className="rounded-2xl p-6 md:p-8 border border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Ready to book?</p>
                  <h3 className="font-serif text-xl text-foreground mb-1">Schedule your free consultation</h3>
                  <p className="text-sm text-muted-foreground font-light">Choose Calendly or Google Calendar — both take under 2 minutes.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <button
                    onClick={() => setActiveTab('calendly')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    Book via Calendly
                  </button>
                  <button
                    onClick={() => setActiveTab('google')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                    style={{ background: '#4285F4', color: '#fff' }}
                  >
                    Book via Google
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Combined Booking Options Summary ── */}
        <section className="py-14 px-6 md:px-10 bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">Two Ways to Book</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">Use whichever platform you prefer — both connect directly to the same calendar.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Calendly card */}
              <div className="bg-background border border-border rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,110,255,0.08)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Calendly</h3>
                    <p className="text-xs text-muted-foreground">Streamlined scheduling platform</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {['Automated intake form link after booking', 'Email + SMS reminders', 'Easy rescheduling self-service', 'Works without a Google account'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setActiveTab('calendly')}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 w-full"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Book via Calendly
                </button>
              </div>

              {/* Google Calendar card */}
              <div className="bg-background border border-border rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(66,133,244,0.08)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Google Calendar</h3>
                    <p className="text-xs text-muted-foreground">Book directly into the firm&apos;s calendar</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {['Google Meet link included automatically', 'Syncs with your existing Google Calendar', 'No third-party account required', 'Instant calendar invite to your inbox'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setActiveTab('google')}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 w-full"
                  style={{ background: '#4285F4', color: '#fff' }}
                >
                  Book via Google Calendar
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Deposit CTA ── */}
        <section className="py-12 px-6 md:px-10 bg-background border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="bg-background border border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Ready to move forward?</p>
                <h3 className="font-serif text-xl text-foreground mb-1">Secure your consultation or start a retainer</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-md">
                  Pay a consultation deposit to hold your slot, or set up a monthly retainer for ongoing legal support.
                </p>
              </div>
              <button
                onClick={handlePaymentOpen}
                className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Pay Deposit / Retainer
              </button>
            </div>
          </div>
        </section>

        {/* ── What to Expect ── */}
        <section className="py-16 px-6 md:px-10 bg-muted/20 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl text-foreground text-center mb-10">What to Expect</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Pick Your Slot', body: 'Choose a date and time that fits your schedule from Calendly or Google Calendar above.' },
                { step: '02', title: 'Share Your Needs', body: 'Fill in a brief note about your case or project so we can come prepared to the call.' },
                { step: '03', title: 'We Connect', body: "A Google Meet link is sent automatically. We'll discuss how I can support your firm." },
              ].map((item) => (
                <div key={item.step} className="relative p-6 rounded-2xl bg-background border border-border">
                  <span className="font-serif text-5xl font-bold leading-none" style={{ color: 'rgba(53,94,59,0.12)' }}>{item.step}</span>
                  <h3 className="font-serif text-lg text-foreground mt-2 mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                onClick={() => trackCTAClick('Contact Page', 'availability_page_footer_cta', '/contact')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                Contact Us Directly
              </Link>
              <Link
                href="/intake"
                onClick={() => trackCTAClick('Start Intake', 'availability_page_footer_cta', '/intake')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                Start Intake Form
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        userEmail={bookedEmail}
        userName={bookedName}
      />
    </>
  );
}
