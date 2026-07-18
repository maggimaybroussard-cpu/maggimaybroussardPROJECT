'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CalendlyWidgetProps {
  /** Calendly URL — defaults to env var or the 30-min meeting */
  url?: string;
  /** Compact inline embed height (default 630px) */
  height?: number;
  /** Optional heading shown above the widget */
  heading?: string;
  /** Optional subheading */
  subheading?: string;
}

const DEFAULT_CALENDLY_URL =
  process.env.NEXT_PUBLIC_CALENDLY_URL ?? 'https://calendly.com/maggimaybroussard/30min';

export default function CalendlyWidget({
  url = DEFAULT_CALENDLY_URL,
  height = 630,
  heading,
  subheading,
}: CalendlyWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [booked, setBooked] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Calendly widget script once
  useEffect(() => {
    const existing = document.getElementById('calendly-widget-script');
    if (existing) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'calendly-widget-script';
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Listen for booking confirmation
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.event === 'calendly.event_scheduled') {
        setBooked(true);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const embedUrl = `${url}?hide_gdpr_banner=1&hide_event_type_details=0&background_color=ffffff&text_color=1B2A4A&primary_color=B76E79`;

  return (
    <div className="w-full">
      {(heading || subheading) && (
        <div className="text-center mb-6">
          {heading && (
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-sm text-muted-foreground font-light">{subheading}</p>
          )}
        </div>
      )}

      {booked ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-emerald-800 mb-2">Consultation Booked!</h3>
          <p className="text-sm text-emerald-700">
            Check your email for confirmation details. Maggi will be in touch soon.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="calendly-inline-widget rounded-2xl overflow-hidden border border-border/30 shadow-sm"
          data-url={embedUrl}
          style={{ minWidth: '100%', height: `${height}px` }}
        />
      )}
    </div>
  );
}
