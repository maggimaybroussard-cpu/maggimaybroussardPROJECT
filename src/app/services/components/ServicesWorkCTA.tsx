'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { trackCTAClick, trackBookConsultationClick, trackServicesCTAFunnelClick } from '@/lib/analytics';
import CalendlyServiceModal from './CalendlyServiceModal';

export default function ServicesWorkCTA() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section className="py-16 md:py-24 bg-secondary/40 border-t border-border">
        <div className="max-w-4xl mx-auto px-5 md:px-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 md:mb-5 flex items-center justify-center gap-3">
            <span className="w-6 h-px bg-accent" />
            Available Nationwide
            <span className="w-6 h-px bg-accent" />
          </p>
          <h2 className="text-section-heading text-foreground mb-5 md:mb-6">
            Ready to strengthen
            <br />
            <span className="italic opacity-80">your practice?</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg font-light leading-relaxed max-w-lg mx-auto mb-8 md:mb-10">
            Whether you need ongoing legal support or project-based assistance,
            I'm available to discuss how I can serve your firm's unique needs.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/services/purchase"
              onClick={() => {
                trackCTAClick('Purchase a Service', 'services_cta', '/services/purchase');
                trackServicesCTAFunnelClick('Purchase a Service', 'work_cta');
              }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-all duration-300 hover:gap-3"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Purchase a Service
            </Link>
            <button
              onClick={() => {
                setModalOpen(true);
                trackCTAClick('Schedule a Consultation', 'services_cta', 'calendly_modal');
                trackBookConsultationClick('services_work_cta');
                trackServicesCTAFunnelClick('Schedule a Consultation', 'work_cta');
              }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border text-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:border-primary hover:text-primary transition-all duration-300"
            >
              Schedule a Consultation
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <a
              href="mailto:broussardlegalservices@gmail.com"
              onClick={() => {
                trackCTAClick('Email Direct', 'services_cta', 'mailto:broussardlegalservices@gmail.com');
                trackServicesCTAFunnelClick('Email Direct', 'work_cta');
              }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border text-foreground rounded-full text-sm font-medium tracking-wide hover:border-accent hover:text-accent transition-all duration-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Send an Email
            </a>
          </div>
        </div>
      </section>

      <CalendlyServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}