'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { trackCTAClick } from '@/lib/analytics';

// Working Calendly booking URL — used as the primary scheduling mechanism
const BOOKING_URL = 'https://calendly.com/maggimaybroussard/30min';

interface BookingOption {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const bookingOptions: BookingOption[] = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Instant Booking',
    desc: 'Book directly into the firm\'s calendar — no third-party account needed',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: '15, 30, or 60 Min',
    desc: 'Focused discovery session — discuss your legal support needs',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    title: 'Google Meet Included',
    desc: 'Google Meet link sent to your inbox immediately after booking',
  },
];

export default function GoogleCalendarBookingSection() {
  const [calendlyLoaded, setCalendlyLoaded] = useState(false);

  useEffect(() => {
    const existing = document.getElementById('calendly-widget-script-contact');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'calendly-widget-script-contact';
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.defer = true;
      script.onload = () => setCalendlyLoaded(true);
      document.body?.appendChild(script);
    } else {
      setCalendlyLoaded(true);
    }
  }, []);

  return (
    <section className="py-16 bg-muted/30 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent mb-3">
            <span className="w-5 h-px bg-accent" />
            Schedule a Consultation
            <span className="w-5 h-px bg-accent" />
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Book Your Consultation
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            Choose a time that works for you. You&apos;ll receive an instant confirmation with a
            Google Meet link sent directly to your inbox.
          </p>
        </div>

        {/* Benefits row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {bookingOptions.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 bg-background border border-border rounded-xl p-4"
            >
              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Calendly embed */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-background relative">
          {!calendlyLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center py-20 gap-4 bg-background z-10">
              <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading booking calendar…</p>
            </div>
          )}
          <div
            className="calendly-inline-widget"
            data-url={`${BOOKING_URL}?hide_event_type_details=0&hide_gdpr_banner=1&primary_color=355E3B`}
            style={{ minWidth: '280px', height: '700px' }}
          />
        </div>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackCTAClick('Open Booking Page', 'contact_page_booking_section', BOOKING_URL)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Open Booking Page
          </a>
          <Link
            href="/book-consultation"
            onClick={() => trackCTAClick('Book a Consultation', 'contact_page_booking_section', '/book-consultation')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border text-foreground hover:bg-muted/50 transition-all duration-200"
          >
            Full Booking Page
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          After booking you&apos;ll receive a Google Meet link and confirmation email.
          Questions?{' '}
          <a
            href="mailto:broussardlegalservices@gmail.com"
            onClick={() => trackCTAClick('Email Direct', 'contact_page_booking_section', 'mailto:broussardlegalservices@gmail.com')}
            className="text-accent hover:underline font-medium"
          >
            broussardlegalservices@gmail.com
          </a>
        </p>
      </div>
    </section>
  );
}
