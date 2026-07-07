'use client';

import React, { useEffect, useRef, useState } from 'react';
import { trackCalendlyBooking, trackCTAClick, trackBookingComplete } from '@/lib/analytics';

interface CalendlyServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceInterest?: string;
}

const CALENDLY_BASE_URL = 'https://calendly.com/maggimaybroussard/30min';

export default function CalendlyServiceModal({
  isOpen,
  onClose,
  serviceInterest,
}: CalendlyServiceModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [booked, setBooked] = useState(false);
  const widgetInitialized = useRef(false);

  // Load Calendly script
  useEffect(() => {
    if (!isOpen) return;
    const existing = document.querySelector(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]'
    );
    if (existing) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [isOpen]);

  // Initialize widget when script is ready and modal is open
  useEffect(() => {
    if (!isOpen || !scriptLoaded || !containerRef.current || widgetInitialized.current) return;

    const timer = setTimeout(() => {
      const win = window as unknown as {
        Calendly?: { initInlineWidget: (opts: object) => void };
      };
      if (win.Calendly && containerRef.current) {
        widgetInitialized.current = true;

        // Build prefill — use the custom question to pass service interest
        const prefill: Record<string, unknown> = {};
        if (serviceInterest) {
          prefill.customAnswers = {
            a1: `I'm interested in: ${serviceInterest}`,
          };
        }

        win.Calendly.initInlineWidget({
          url: CALENDLY_BASE_URL,
          parentElement: containerRef.current,
          prefill,
          utm: {
            utmSource: 'services_page',
            utmMedium: 'modal',
            utmCampaign: 'service_consultation',
            utmContent: serviceInterest ?? 'general',
          },
        });
        setWidgetReady(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, scriptLoaded, serviceInterest]);

  // Reset widget state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setWidgetReady(false);
      widgetInitialized.current = false;
      setBooked(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    }
  }, [isOpen]);

  // Listen for Calendly booking confirmation
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.event === 'calendly.event_scheduled') {
        setBooked(true);
        trackCalendlyBooking('services_page_modal');
        trackBookingComplete({
          source: 'services_page_modal',
          inviteeName: e.data?.payload?.invitee?.name ?? '',
          hasEmail: !!e.data?.payload?.invitee?.email,
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Trap focus and handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule a consultation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-1 flex items-center gap-2">
              <span className="w-4 h-px bg-accent" />
              Free Consultation
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              Schedule a 30-Minute Call
            </h2>
            {serviceInterest && (
              <p className="text-sm text-muted-foreground mt-1">
                Service interest:{' '}
                <span className="font-medium text-foreground">{serviceInterest}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close booking modal"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Benefits strip */}
        {!booked && (
          <div className="flex items-center gap-6 px-6 py-3 bg-muted/40 border-b border-border shrink-0 overflow-x-auto">
            {[
              { icon: '⏱', label: '30 min · no obligation' },
              { icon: '✅', label: 'Instant calendar invite' },
              { icon: '🔒', label: 'Confidential' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {booked ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Consultation Booked!</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                You&apos;ll receive a confirmation email with a calendar invite and a link to
                complete your intake form so we can hit the ground running.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Loading skeleton */}
              {!widgetReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center py-20 gap-4 bg-background z-10">
                  <div className="w-9 h-9 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading calendar…</p>
                </div>
              )}
              {/* Calendly inline widget target */}
              <div
                ref={containerRef}
                style={{
                  minWidth: '320px',
                  height: '620px',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer note */}
        {!booked && (
          <div className="px-6 py-3 border-t border-border bg-muted/20 shrink-0">
            <p className="text-center text-xs text-muted-foreground">
              Prefer email?{' '}
              <a
                href="mailto:broussardlegalservices@gmail.com"
                onClick={() =>
                  trackCTAClick(
                    'Email Direct',
                    'services_modal',
                    'mailto:broussardlegalservices@gmail.com'
                  )
                }
                className="text-accent hover:underline font-medium"
              >
                broussardlegalservices@gmail.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
