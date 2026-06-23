'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LexiCalendlyEmbedProps {
  onBooked?: () => void;
  onDismiss?: () => void;
}

const CALENDLY_URL = 'https://calendly.com/maggimaybroussard/30min';

export default function LexiCalendlyEmbed({ onBooked, onDismiss }: LexiCalendlyEmbedProps) {
  const [expanded, setExpanded] = useState(false);
  const [booked, setBooked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for Calendly booking confirmation event
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.event === 'calendly.event_scheduled') {
        setBooked(true);
        onBooked?.();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onBooked]);

  // Load Calendly widget script once when expanded
  useEffect(() => {
    if (!expanded) return;
    const existing = document.getElementById('calendly-widget-script');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'calendly-widget-script';
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);
  }, [expanded]);

  if (booked) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
        <div className="text-emerald-600 text-lg mb-1">✓</div>
        <p className="text-xs font-semibold text-emerald-700">Consultation booked!</p>
        <p className="text-xs text-emerald-600 mt-0.5">Maggi will be in touch soon. Check your email for confirmation.</p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-[#1B2A4A]/5 border border-[#1B2A4A]/15">
        <p className="text-xs text-gray-700 font-medium mb-2">📅 Book a free 30-min consultation with Maggi</p>
        <p className="text-xs text-gray-500 mb-3">Pick a time that works for you — no phone tag needed.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 px-3 py-2 rounded-lg bg-[#1B2A4A] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            See Available Times →
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
            >
              Later
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[#1B2A4A]/20 overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1B2A4A] text-white">
        <span className="text-xs font-semibold">📅 Book with Maggi</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-white/60 hover:text-white text-xs transition-colors"
          aria-label="Collapse booking widget"
        >
          ✕
        </button>
      </div>
      <div
        ref={containerRef}
        className="calendly-inline-widget"
        data-url={`${CALENDLY_URL}?hide_gdpr_banner=1&hide_event_type_details=0&background_color=ffffff&text_color=1B2A4A&primary_color=1B2A4A`}
        style={{ minWidth: '100%', height: '420px' }}
      />
    </div>
  );
}
