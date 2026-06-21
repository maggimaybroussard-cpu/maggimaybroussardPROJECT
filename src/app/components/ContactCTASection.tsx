'use client';

import React from 'react';
import Link from 'next/link';
import { trackCTAClick, trackBookConsultationClick } from '@/lib/analytics';

export default function ContactCTASection() {
  return (
    <section className="py-24 md:py-32 bg-primary overflow-hidden relative" id="cta" aria-label="Contact call to action">
      {/* Background radial glows */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(ellipse at 15% 50%, var(--accent) 0%, transparent 55%), radial-gradient(ellipse at 85% 50%, var(--accent) 0%, transparent 55%)' }}
      />
      {/* Top hairline */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-6 md:mb-7 flex items-center justify-center gap-3">
          <span className="w-8 h-px bg-accent/70" />
          Ready to Begin
          <span className="w-8 h-px bg-accent/70" />
        </p>
        <h2 className="text-section-heading text-primary-foreground mb-5 md:mb-7">
          Let's work
          <br />
          <span className="italic" style={{ opacity: 0.8 }}>together</span>
        </h2>
        <p className="text-base md:text-[17px] font-bold leading-[1.8] max-w-md mx-auto mb-10 md:mb-12 tracking-wide" style={{ color: '#355E3B' }}>
          Available for contract engagements with law firms and attorneys nationwide.
          Reach out to discuss how I can support your practice.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/contact"
            onClick={() => {
              trackCTAClick('Get in Touch', 'homepage_cta', '/contact');
              trackBookConsultationClick('homepage_cta');
            }}
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 hover:gap-4 shadow-lg shadow-accent/20"
          >
            Get in Touch
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="mailto:broussardlegalservices@gmail.com"
            onClick={() => trackCTAClick('Email Direct', 'homepage_cta', 'mailto:broussardlegalservices@gmail.com')}
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 border border-primary-foreground/25 text-primary-foreground rounded-full text-xs font-semibold tracking-[0.1em] hover:bg-primary-foreground/10 hover:border-primary-foreground/45 transition-all duration-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Send an Email
          </a>
        </div>

        {/* Prospect-to-client conversion link */}
        <p className="mt-8 text-xs text-primary-foreground/50">
          Already a client?{' '}
          <Link
            href="/portal/login"
            onClick={() => trackCTAClick('Sign In', 'homepage_cta', '/portal/login')}
            className="text-primary-foreground/80 hover:text-primary-foreground underline underline-offset-2 transition-colors font-medium"
          >
            Sign in to your portal
          </Link>
          {' '}·{' '}
          <Link
            href="/portal/register"
            onClick={() => trackCTAClick('Create Account', 'homepage_cta', '/portal/register')}
            className="text-accent hover:text-accent/80 underline underline-offset-2 transition-colors font-medium"
          >
            Create a free account
          </Link>
        </p>
      </div>
    </section>
  );
}