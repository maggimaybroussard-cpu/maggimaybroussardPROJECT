'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { trackCTAClick, trackBookConsultationClick } from '@/lib/analytics';
import BookConsultationModal from '@/components/BookConsultationModal';

export default function ContactCTASection() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  return (
    <>
      <section className="py-20 sm:py-28 md:py-36 bg-primary overflow-hidden relative noise-overlay" id="cta" aria-label="Contact call to action">
        {/* Multi-layer background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.06]"
            style={{ background: 'radial-gradient(ellipse at 10% 40%, var(--accent) 0%, transparent 50%), radial-gradient(ellipse at 90% 60%, var(--accent) 0%, transparent 50%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #C8965A 0%, transparent 70%)' }} />
        </div>
        {/* Top hairline */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        {/* Bottom hairline */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 md:px-10 text-center">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.35em] sm:tracking-[0.4em] text-accent mb-5 sm:mb-6 md:mb-8 flex items-center justify-center gap-2 sm:gap-3">
            <span className="w-6 sm:w-10 h-px bg-accent/60" />
            Ready to Begin
            <span className="w-6 sm:w-10 h-px bg-accent/60" />
          </p>
          <h2 className="text-section-heading text-primary-foreground mb-5 sm:mb-6 md:mb-8">
            Let&apos;s work
            <br />
            <span className="italic shimmer-text">together</span>
          </h2>
          <p className="text-sm sm:text-base md:text-[17px] font-medium leading-[1.8] max-w-md mx-auto mb-10 sm:mb-12 md:mb-14 text-primary-foreground/80">
            Available for contract engagements with law firms and attorneys nationwide.
            Reach out to discuss how I can support your practice.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-3.5">
            <button
              type="button"
              onClick={() => {
                trackCTAClick('Book a Consultation', 'homepage_cta', '/book-consultation');
                trackBookConsultationClick('homepage_cta');
                setBookingModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 active:scale-[0.98] transition-all duration-300 hover:gap-4 shadow-xl shadow-accent/25 min-h-[52px] touch-manipulation pulse-glow"
            >
              Book a Consultation
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <Link
              href="/contact"
              onClick={() => trackCTAClick('Get in Touch', 'homepage_cta', '/contact')}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 border border-primary-foreground/25 text-primary-foreground rounded-full text-xs font-semibold tracking-[0.1em] hover:bg-primary-foreground/10 hover:border-primary-foreground/45 active:scale-[0.98] transition-all duration-300 min-h-[52px] touch-manipulation backdrop-blur-sm"
            >
              Get in Touch
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="mailto:broussardlegalservices@gmail.com"
              onClick={() => trackCTAClick('Email Direct', 'homepage_cta', 'mailto:broussardlegalservices@gmail.com')}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 border border-primary-foreground/20 text-primary-foreground/85 rounded-full text-xs font-semibold tracking-[0.1em] hover:bg-primary-foreground/8 hover:border-primary-foreground/40 hover:text-primary-foreground active:scale-[0.98] transition-all duration-300 min-h-[52px] touch-manipulation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Send an Email
            </a>
            <a
              href="https://wa.me/18444936819"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCTAClick('WhatsApp', 'homepage_cta', 'https://wa.me/18444936819')}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 border border-primary-foreground/20 text-primary-foreground/85 rounded-full text-xs font-semibold tracking-[0.1em] hover:bg-primary-foreground/8 hover:border-primary-foreground/40 hover:text-primary-foreground active:scale-[0.98] transition-all duration-300 min-h-[52px] touch-manipulation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              WhatsApp Us
            </a>
          </div>

          {/* Divider + portal links */}
          <div className="mt-10 sm:mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
            <p className="text-xs text-primary-foreground/55">
              Already a client?{' '}
              <Link
                href="/portal/login"
                onClick={() => trackCTAClick('Sign In', 'homepage_cta', '/portal/login')}
                className="text-primary-foreground/75 hover:text-primary-foreground underline underline-offset-2 transition-colors font-medium"
              >
                Sign in to your portal
              </Link>
            </p>
            <span className="hidden sm:block text-primary-foreground/20 text-xs">·</span>
            <p className="text-xs text-primary-foreground/55">
              New client?{' '}
              <Link
                href="/portal/register"
                onClick={() => trackCTAClick('Create Account', 'homepage_cta', '/portal/register')}
                className="text-accent hover:text-accent/80 underline underline-offset-2 transition-colors font-medium"
              >
                Create a free account
              </Link>
            </p>
          </div>
        </div>
      </section>

      <BookConsultationModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
      />
    </>
  );
}