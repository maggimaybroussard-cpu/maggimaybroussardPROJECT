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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Send an Email
            </a>
            <a
              href="https://wa.me/18444936819"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackCTAClick('WhatsApp', 'services_cta', 'https://wa.me/18444936819');
                trackServicesCTAFunnelClick('WhatsApp', 'work_cta');
              }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border text-foreground rounded-full text-sm font-medium tracking-wide hover:border-accent hover:text-accent transition-all duration-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              WhatsApp: 1-844-493-6819
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