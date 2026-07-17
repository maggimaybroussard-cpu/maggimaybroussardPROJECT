'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import CCPALink from '@/components/CCPALink';
import ConsentPreferenceCenter from '@/components/ConsentPreferenceCenter';
import { detectRegion } from '@/lib/consent';
import AttorneyDisclaimer from '@/components/AttorneyDisclaimer';

export default function Footer() {
  const [showPreferences, setShowPreferences] = React.useState(false);
  const [region, setRegion] = React.useState<'gdpr' | 'ccpa' | 'none'>('none');
  const [year, setYear] = React.useState(2025);

  React.useEffect(() => {
    setRegion(detectRegion());
    setYear(new Date()?.getFullYear());
  }, []);

  return (
    <>
      <footer className="border-t border-border/50 bg-background relative overflow-hidden">
        {/* Subtle top gradient */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <div className="max-w-7xl mx-auto px-5 md:px-10 py-12 md:py-14 flex flex-col gap-8">

          {/* Main footer row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">

            {/* Brand column */}
            <div className="flex flex-col gap-4 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 group w-fit">
                <AppLogo size={28} />
                <span className="font-serif text-[15px] tracking-tight transition-colors duration-200 group-hover:text-accent text-foreground/80">
                  Broussard Legal Services
                </span>
              </Link>
              <p className="text-[12.5px] text-muted-foreground/75 leading-relaxed max-w-[220px]">
                Contract paralegal services for law firms and attorneys nationwide.
              </p>
              {/* Social / contact quick links */}
              <div className="flex items-center gap-3 mt-1">
                <a
                  href="tel:+15044582831"
                  className="w-8 h-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-all duration-200"
                  aria-label="Call us"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </a>
                <a
                  href="mailto:broussardlegalservices@gmail.com"
                  className="w-8 h-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-all duration-200"
                  aria-label="Email us"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </a>
                <a
                  href="https://wa.me/18444936819"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-all duration-200"
                  aria-label="WhatsApp"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Explore links */}
            <nav className="flex flex-col gap-2.5" aria-label="Explore navigation">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground/50 mb-1">Explore</p>
              {[
                { label: 'Home', href: '/' },
                { label: 'Services', href: '/services' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Blog', href: '/blog' },
                { label: 'Case Studies', href: '/case-studies' },
                { label: 'Testimonials', href: '/testimonials' },
              ]?.map(link => (
                <Link key={link?.href} href={link?.href} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-200 w-fit">
                  {link?.label}
                </Link>
              ))}
            </nav>

            {/* Work with me links */}
            <nav className="flex flex-col gap-2.5" aria-label="Work with me navigation">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground/50 mb-1">Work With Me</p>
              {[
                { label: 'Book Consultation', href: '/prospect-booking' },
                { label: 'Contact', href: '/contact' },
                { label: 'Availability', href: '/availability' },
                { label: 'Referral Program', href: '/referral' },
                { label: 'Legal Assistant', href: '/legal-assistant' },
                { label: 'Rates', href: '/rates' },
              ]?.map(link => (
                <Link key={link?.href} href={link?.href} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-200 w-fit">
                  {link?.label}
                </Link>
              ))}
            </nav>

            {/* Address + client portal */}
            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground/50">Contact</p>
              <address className="not-italic text-[12.5px] text-muted-foreground/80 leading-relaxed">
                <span className="font-semibold text-foreground/70 block mb-1">Broussard Legal Services</span>
                900 Camp Street Suite 3rd Fl. PMB 70111<br />
                New Orleans, LA 70130<br />
                <a href="tel:+15044582831" className="hover:text-foreground transition-colors duration-200 mt-1 block">1-504-458-2831</a>
              </address>
              <Link
                href="/portal/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-accent/30 text-accent text-[12px] font-semibold hover:bg-accent/8 hover:border-accent/50 transition-all duration-200 w-fit"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Client Login
              </Link>
            </div>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pt-6 border-t border-border/40">
            <p className="text-[12px] text-muted-foreground/60">
              © {year} Broussard Legal Services
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {[
                { label: 'Terms', href: '/terms-of-service' },
                { label: 'Privacy', href: '/privacy-policy' },
                { label: 'Cookies', href: '/cookies' },
                { label: 'Disclaimers', href: '/disclaimers' },
              ]?.map(link => (
                <Link key={link?.href} href={link?.href} className="text-[11px] text-muted-foreground/55 hover:text-foreground transition-colors duration-200 uppercase tracking-wider">
                  {link?.label}
                </Link>
              ))}
              <CCPALink />
              <button
                onClick={() => setShowPreferences(true)}
                aria-label="Open cookie preferences"
                className="text-[11px] text-muted-foreground/55 hover:text-foreground transition-colors duration-200 uppercase tracking-wider bg-transparent border-0 cursor-pointer p-0 focus-visible:outline-none focus-visible:underline"
              >
                Cookie Preferences
              </button>
            </div>
          </div>

          {/* Attorney Disclaimer */}
          <AttorneyDisclaimer variant="footer" className="pt-1" />
        </div>
      </footer>
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