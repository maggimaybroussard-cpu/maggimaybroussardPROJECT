'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import CCPALink from '@/components/CCPALink';
import ConsentPreferenceCenter from '@/components/ConsentPreferenceCenter';
import { detectRegion } from '@/lib/consent';

export default function Footer() {
  const [showPreferences, setShowPreferences] = useState(false);
  const [region, setRegion] = React.useState<'gdpr' | 'ccpa' | 'none'>('none');
  const [year, setYear] = useState(2025);

  React.useEffect(() => {
    setRegion(detectRegion());
    setYear(new Date()?.getFullYear());
  }, []);

  return (
    <>
      <footer className="border-t border-border/60 bg-background">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-10 flex flex-col gap-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start">
            {/* Logo + Name */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} />
              <span className="font-serif text-[15px] tracking-tight transition-colors duration-200 group-hover:text-accent" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            {/* Business Address */}
            <address className="not-italic text-[12px] text-muted-foreground/80 leading-relaxed sm:text-left">
              <span className="font-semibold text-muted-foreground">Broussard Legal Services</span><br />
              900 Camp St FL 3<br />
              New Orleans, LA 70130<br />
              <a href="tel:+15044582831" className="hover:text-foreground transition-colors duration-200">1-504-458-2831</a>
            </address>

            {/* Primary Links — two columns on mobile, row on sm+ */}
            <nav className="flex items-start flex-wrap gap-x-6 gap-y-3 sm:gap-x-5 sm:gap-y-2" aria-label="Footer navigation">
              <Link href="/" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Home</Link>
              <Link href="/services" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Services</Link>
              <Link href="/pricing" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Pricing</Link>
              <Link href="/blog" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Blog</Link>
              <Link href="/case-studies" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Case Studies</Link>
              <Link href="/testimonials" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Testimonials</Link>
              <Link href="/availability" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Availability</Link>
              <Link href="/contact" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Contact</Link>
              <Link href="/referral" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">Referral Program</Link>
              <Link
                href="/portal/login"
                className="text-[13px] font-semibold text-[#355E3B] hover:text-[#355E3B]/80 transition-colors duration-200 flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Client Login
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-[13px] text-muted-foreground/70 sm:text-right shrink-0">
              © {year} Maggi May Broussard
            </p>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-5 border-t border-border/50">
            <Link href="/terms-of-service" className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider">
              Cookie Policy
            </Link>
            <Link href="/disclaimers" className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider">
              Disclaimers
            </Link>
            <CCPALink />
            <button
              onClick={() => setShowPreferences(true)}
              aria-label="Open cookie preferences"
              className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors duration-200 uppercase tracking-wider bg-transparent border-0 cursor-pointer p-0 focus-visible:outline-none focus-visible:underline"
            >
              Cookie Preferences
            </button>
          </div>
        </div>
      </footer>

      {/* Preference Center Modal */}
      {showPreferences && (
        <ConsentPreferenceCenter
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          region={region}
        />
      )}
    </>
  );
}