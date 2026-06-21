'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PaymentModal from '@/components/PaymentModal';
import {
  trackBookingPageView, trackPaymentModalOpen, trackCalendlyBooking, trackLeadQuality, trackBookingComplete, trackCTAClick, trackConsultationFunnelEntry, trackConsultationCalendlyEngaged, trackConsultationBooked, trackConsultationServiceSelected, getTrafficAttribution, trackBookingPageFunnelEntry,
} from '@/lib/analytics';
import QRCodeImage from '@/components/ui/QRCodeImage';
import ConsultationCalendar from '@/components/ConsultationCalendar';
import ConsultationDepositField from '@/components/ConsultationDepositField';
import ConsultationScheduler from '@/components/ConsultationScheduler';

const CALENDLY_URL = 'https://calendly.com/maggimaybroussard/30min';

const WHAT_TO_EXPECT = [
  {
    step: '01',
    title: 'Choose Your Time',
    body: 'Select a date and time that works for your schedule. Instant confirmation — no back-and-forth.',
  },
  {
    step: '02',
    title: 'Describe Your Case',
    body: 'Share a brief overview of your legal support needs so the consultation is focused and productive.',
  },
  {
    step: '03',
    title: 'We Connect',
    body: 'A Google Meet link is sent automatically. We discuss your firm\'s needs and how I can help.',
  },
];

const SERVICES_COVERED = [
  'Litigation Support',
  'Legal Research & Memos',
  'Document Drafting',
  'Discovery Assistance',
  'Case Management',
  'Trial Preparation',
];

export default function BookConsultationPage() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bookedName, setBookedName] = useState('');
  const [bookedEmail, setBookedEmail] = useState('');
  const [showBookingBanner, setShowBookingBanner] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState('');
  const [inquiryId, setInquiryId] = useState('');
  const [calendarDate, setCalendarDate] = useState('');
  const [calendarTime, setCalendarTime] = useState('');
  const [depositPaid, setDepositPaid] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [attribution, setAttribution] = useState<ReturnType<typeof getTrafficAttribution> | null>(null);
  const [schedulerBooked, setSchedulerBooked] = useState(false);

  useEffect(() => {
    trackBookingPageView();
    trackBookingPageFunnelEntry('book_consultation');
    const attr = getTrafficAttribution();
    setAttribution(attr);
    trackConsultationFunnelEntry({
      trafficSource: attr.trafficSource,
      utmMedium: attr.utmMedium,
      utmCampaign: attr.utmCampaign,
      referrer: attr.referrer,
    });

    const loadCalendly = () => {
      const existing = document.getElementById('calendly-widget-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'calendly-widget-script';
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.async = true;
        script.defer = true;
        document.body?.appendChild(script);
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadCalendly, { timeout: 3000 });
    } else {
      setTimeout(loadCalendly, 500);
    }

    const handleCalendlyMessage = (e: MessageEvent) => {
      if (e.data?.event === 'calendly.event_scheduled') {
        trackCalendlyBooking('book_consultation_page');
        trackLeadQuality({ source: 'calendly', conversionType: 'booking' });

        const invitee = e.data?.payload?.invitee;
        const event = e.data?.payload?.event;
        const name: string = invitee?.name ?? '';
        const email: string = invitee?.email ?? '';
        const eventName: string = event?.name ?? '';
        const startTime: string = event?.start_time ?? '';
        const calendlyEventUuid: string = e.data?.payload?.event?.uri?.split('/').pop() ?? '';

        trackBookingComplete({
          source: 'book_consultation_page',
          inviteeName: name,
          hasEmail: !!email,
        });

        // Consultation funnel: booking confirmed
        const currentAttr = attribution ?? getTrafficAttribution();
        trackConsultationBooked({
          serviceType: selectedService || 'general',
          trafficSource: currentAttr.trafficSource,
          utmCampaign: currentAttr.utmCampaign,
          hasDeposit: false,
        });

        setBookedName(name);
        setBookedEmail(email);
        setShowBookingBanner(true);

        // Persist inquiry_id from Calendly webhook if available
        if (calendlyEventUuid) {
          setInquiryId(calendlyEventUuid);
        }

        // Build intake workflow URL
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const params = new URLSearchParams({
          name,
          email,
          event: eventName,
          start: startTime,
        });
        setIntakeUrl(`${siteUrl}/post-booking-intake?${params.toString()}`);

        setTimeout(() => {
          trackPaymentModalOpen('post_booking');
          setPaymentOpen(true);
        }, 1800);
      }
    };

    window.addEventListener('message', handleCalendlyMessage);
    return () => window.removeEventListener('message', handleCalendlyMessage);
  }, []);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">

        {/* Hero */}
        <section
          className="relative pt-28 pb-12 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 55%, #4a7c52 100%)' }}
        >
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-3xl mx-auto text-center relative z-10">
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
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
            >
              Schedule a Consultation
            </span>

            <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-white leading-tight mb-4 md:mb-5">
              Book Your
              <br />
              <span className="italic opacity-80">Consultation</span>
            </h1>
            <p className="text-white/75 text-base md:text-xl leading-relaxed max-w-xl mx-auto mb-6 md:mb-8">
              Choose 15, 30, or 60 minutes. Pick your time — instant confirmation with a Google Meet link sent directly to your inbox.
            </p>

            <div className="flex flex-wrap justify-center gap-2 md:gap-3">
              {[
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  ),
                  label: '15, 30, or 60 min',
                },
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  ),
                  label: 'Google Meet',
                },
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  ),
                  label: 'Auto-confirmation email',
                },
                {
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ),
                  label: 'No obligation',
                },
              ]?.map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── NEW: Direct Scheduler ─────────────────────────────────────────── */}
        <section className="py-10 md:py-14 px-4 md:px-6 bg-background">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6 md:gap-8 items-start">

            {/* Left: Scheduler */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                  <span className="w-4 h-px bg-accent" />
                  Book Directly — Instant Confirmation
                </span>
              </div>
              <ConsultationScheduler
                onBookingComplete={(booking) => {
                  setSchedulerBooked(true);
                  setBookedName(booking.clientName);
                  setBookedEmail(booking.clientEmail);
                  setShowBookingBanner(true);
                  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
                  const params = new URLSearchParams({
                    name: booking.clientName,
                    email: booking.clientEmail,
                    event: `${booking.durationMinutes}-min Consultation`,
                    start: `${booking.bookingDate}T${booking.bookingTime}`,
                  });
                  setIntakeUrl(`${siteUrl}/post-booking-intake?${params.toString()}`);
                  trackBookingComplete({ source: 'direct_scheduler', inviteeName: booking.clientName, hasEmail: true });
                }}
              />
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-5 md:gap-6">

              {/* Services covered */}
              <div className="bg-secondary/40 border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">Services Covered</p>
                <ul className="space-y-2.5">
                  {SERVICES_COVERED.map((svc) => (
                    <li
                      key={svc}
                      className="flex items-center gap-3 text-sm text-foreground font-light cursor-pointer hover:text-accent transition-colors duration-150"
                      onClick={() => {
                        setSelectedService(svc);
                        trackConsultationServiceSelected(svc, 'sidebar_services_list');
                      }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedService === svc ? 'bg-primary' : 'bg-accent'}`} />
                      {svc}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/services"
                  onClick={() => trackCTAClick('View all services', 'book_consultation_sidebar', '/services')}
                  className="inline-flex items-center gap-1.5 mt-5 text-xs font-semibold uppercase tracking-widest text-accent hover:opacity-70 transition-opacity"
                >
                  View all services
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Deposit CTA */}
              <div className="bg-background border border-border rounded-2xl p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">After booking</p>
                <h3 className="font-serif text-lg text-foreground mb-2">Secure your slot</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-4">
                  Pay a consultation deposit to hold your time, or set up a monthly retainer for ongoing support.
                </p>
                <button
                  onClick={() => {
                    trackPaymentModalOpen('book_consultation_sidebar');
                    setPaymentOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Pay Deposit / Retainer
                </button>
                <Link
                  href="/checkout"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 border mt-2"
                  style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'transparent' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  Go to Checkout Page
                </Link>
              </div>

              {/* Inline Consultation Deposit Field */}
              {!depositPaid && (
                <ConsultationDepositField
                  clientName={bookedName}
                  clientEmail={bookedEmail}
                  inquiryId={inquiryId || undefined}
                  onDepositPaid={() => {
                    setDepositPaid(true);
                  }}
                />
              )}
              {depositPaid && (
                <div
                  className="rounded-2xl p-5 flex items-center gap-3"
                  style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.2)' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(53,94,59,0.15)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Deposit paid</p>
                    <p className="text-xs text-muted-foreground font-light">$150 applied toward your first invoice</p>
                  </div>
                </div>
              )}

              {/* Direct contact */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#355E3B' }}>Prefer email?</p>
                <a
                  href="mailto:broussardlegalservices@gmail.com"
                  className="text-sm font-medium text-foreground hover:text-accent transition-colors duration-200 break-all"
                >
                  broussardlegalservices@gmail.com
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Divider with "or use Calendly" */}
        <div className="px-5 md:px-10">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest px-3">or book via Calendly</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>

        {/* Post-booking success banner */}
        {showBookingBanner && (
          <section className="px-5 md:px-10 py-4 md:py-5 bg-background border-b border-border">
            <div className="max-w-5xl mx-auto">
              <div
                className="rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.2)' }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(53,94,59,0.15)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {bookedName ? `Consultation booked, ${bookedName.split(' ')[0]}!` : 'Consultation booked!'}
                    </p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5 leading-relaxed">
                      A confirmation email is on its way{bookedEmail ? ` to ${bookedEmail}` : ''}.
                      Complete your intake to confirm case assignment.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                  {intakeUrl && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(53,94,59,0.15)' }}>
                      <QRCodeImage
                        value={intakeUrl}
                        size={44}
                        fgColor="#2C1F14"
                        bgColor="transparent"
                        level="M"
                      />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#355E3B' }}>Scan to</p>
                        <p className="text-xs" style={{ color: '#7A6B5D' }}>complete intake</p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <a
                      href={intakeUrl || '/post-booking-intake'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                      style={{ background: '#355E3B', color: '#fff' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      Complete Intake
                    </a>
                    <button
                      onClick={() => {
                        trackPaymentModalOpen('post_booking_banner');
                        setPaymentOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                      style={{ background: 'transparent', color: '#355E3B', border: '1px solid rgba(53,94,59,0.4)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      Pay Deposit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Calendly section */}
        <section className="py-8 md:py-12 px-4 md:px-6 bg-background">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6 md:gap-8 items-start">
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                    <span className="w-4 h-px bg-accent" />
                    Calendly — Preview Availability
                  </span>
                </div>
                <ConsultationCalendar
                  selectedDate={calendarDate}
                  selectedTime={calendarTime}
                  onDateTimeSelect={(date, time) => {
                    setCalendarDate(date);
                    setCalendarTime(time);
                  }}
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                    <span className="w-4 h-px bg-accent" />
                    Confirm via Calendly
                  </span>
                </div>
                <div
                  className="calendly-inline-widget rounded-2xl overflow-hidden shadow-lg border border-border"
                  data-url={`${CALENDLY_URL}?hide_event_type_details=0&hide_gdpr_banner=1&primary_color=355E3B`}
                  style={{ minWidth: '280px', height: '700px' }}
                  onMouseEnter={() => trackConsultationCalendlyEngaged(selectedService || 'general')}
                />
              </div>
            </div>

            {/* Sidebar (right column — kept for Calendly section) */}
            <div className="flex flex-col gap-5">
              <div className="bg-secondary/40 border border-border rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">Why book directly?</p>
                <ul className="space-y-3">
                  {[
                    'Instant confirmation — no waiting',
                    'Auto-email with Google Meet link',
                    'Prep instructions sent immediately',
                    'Choose 15, 30, or 60 minutes',
                    'Real-time availability',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-foreground font-light">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What to expect */}
        <section className="py-12 md:py-16 px-5 md:px-10 bg-secondary/30 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-accent" />
              How It Works
            </p>
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-8 md:mb-10">
              What to expect
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 md:gap-6">
              {WHAT_TO_EXPECT.map((item) => (
                <div key={item.step} className="bg-background border border-border rounded-2xl p-5 md:p-6">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 block">{item.step}</span>
                  <h3 className="font-serif text-lg text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        clientName={bookedName}
        clientEmail={bookedEmail}
        inquiryId={inquiryId || undefined}
      />
    </>
  );
}
