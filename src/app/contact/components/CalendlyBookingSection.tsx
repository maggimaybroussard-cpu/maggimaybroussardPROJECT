'use client';

import React, { useEffect, useRef, useState } from 'react';
import { trackCalendlyBooking, trackCTAClick, trackLeadQuality, trackBookingComplete,  } from '@/lib/analytics';

const CALENDLY_URL = 'https://calendly.com/maggimaybroussard/30min';

export default function CalendlyBookingSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    // Check if script already loaded
    const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove — may be used elsewhere
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) return;

    // Small delay to ensure Calendly global is available
    const timer = setTimeout(() => {
      const win = window as unknown as { Calendly?: { initInlineWidget: (opts: object) => void } };
      if (win.Calendly && containerRef.current) {
        win.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: containerRef.current,
          prefill: {},
          utm: {
            utmSource: 'website',
            utmMedium: 'contact_page',
            utmCampaign: 'consultation_booking',
          },
        });
        setWidgetReady(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [scriptLoaded]);

  // Listen for Calendly booking confirmation
  useEffect(() => {
    const handleCalendlyMessage = (e: MessageEvent) => {
      if (e.data?.event === 'calendly.event_scheduled') {
        trackCalendlyBooking('contact_page_calendly_section');
        trackLeadQuality({ source: 'calendly', conversionType: 'booking' });
        const invitee = e.data?.payload?.invitee;
        const event = e.data?.payload?.event;
        trackBookingComplete({
          source: 'contact_page_calendly_section',
          inviteeName: invitee?.name ?? '',
          hasEmail: !!invitee?.email,
        });
      }
    };
    window.addEventListener('message', handleCalendlyMessage);
    return () => window.removeEventListener('message', handleCalendlyMessage);
  }, []);

  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent mb-3">
            <span className="w-5 h-px bg-accent" />
            Book a Consultation
            <span className="w-5 h-px bg-accent" />
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Schedule a Free 30-Minute Call
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            Select a time that works for you. After booking, you&apos;ll receive a confirmation
            with a link to complete your intake form so we can hit the ground running.
          </p>
        </div>

        {/* Benefits row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              ),
              title: '30 Minutes',
              desc: 'Focused discovery call — no fluff',
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l-4 4l-2-2" /><rect width="18" height="18" x="3" y="3" rx="2" />
                </svg>
              ),
              title: 'Instant Confirmation',
              desc: 'Calendar invite + intake form link sent immediately',
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
              title: 'No Obligation',
              desc: 'Explore fit before any commitment',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-4"
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

        {/* Calendly widget container */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-background relative">
          {/* Loading skeleton */}
          {!widgetReady && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading calendar…</p>
            </div>
          )}
          {/* Calendly inline widget target */}
          <div
            ref={containerRef}
            style={{ minWidth: '320px', height: widgetReady ? '700px' : '0px', overflow: 'hidden' }}
          />
        </div>

        {/* Post-booking note */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          After booking you&apos;ll be redirected to a short intake questionnaire. Prefer email?{' '}
          <a
            href="mailto:broussardlegalservices@gmail.com"
            onClick={() => trackCTAClick('Email Direct', 'contact_page_calendly_section', 'mailto:broussardlegalservices@gmail.com')}
            className="text-accent hover:underline font-medium"
          >
            broussardlegalservices@gmail.com
          </a>
        </p>
      </div>
    </section>
  );
}
