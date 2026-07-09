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
                Broussard Legal Services
              </span>
            </Link>
            {/* Business Address */}
            <address className="not-italic text-[12px] text-muted-foreground/80 leading-relaxed sm:text-left">
              <span className="font-semibold text-muted-foreground">Broussard Legal Services</span><br />
              900 Camp Street Suite 3rd Fl. PMB 70111<br />
              New Orleans, LA 70130<br />
              <a href="tel:+15044582831" className="hover:text-foreground transition-colors duration-200">1-504-458-2831</a><br />
              <a
                href="https://wa.me/18444936819"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors duration-200"
                aria-label="Chat on WhatsApp"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                WhatsApp: 1-844-493-6819
              </a>
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
              © {year} Broussard Legal Services
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