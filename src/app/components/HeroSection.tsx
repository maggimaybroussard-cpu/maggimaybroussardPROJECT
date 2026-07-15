'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { trackCTAClick, trackBookConsultationClick, trackViewServicesClick } from '@/lib/analytics';
import BookConsultationModal from '@/components/BookConsultationModal';

export default function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Throttle mousemove via requestAnimationFrame to reduce FID/INP impact
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const hero = heroRef.current;
      if (!hero) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const mx = (clientX / innerWidth - 0.5) * 2;
      const my = (clientY / innerHeight - 0.5) * 2;
      const bg = hero.querySelector('.hero-bg') as HTMLElement;
      if (bg) {
        bg.style.transform = `scale(1.06) translate(${mx * 12}px, ${my * 8}px)`;
      }
    });
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      hero.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleMouseMove]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col justify-end overflow-hidden"
      aria-label="Hero">
      
      {/* Background Image — LCP element: priority + fetchpriority=high */}
      <div className="absolute inset-0 hero-bg transition-transform duration-700 ease-out will-change-transform">
        <AppImage
          src="https://images.unsplash.com/photo-1553714167-d5dddd691160"
          alt="Modern minimal white bookcase with neatly arranged books and clean shelves in a bright airy library"
          fill
          priority
          quality={80}
          className="object-cover object-center"
          sizes="100vw"
          fetchPriority="high"
          decoding="sync" />
        
        {/* Gradient scrim — bottom-heavy for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/45 to-primary/10" />
        {/* Soft warm wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-10 pb-14 sm:pb-20 md:pb-32 pt-24 sm:pt-32 md:pt-44">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <p className="animate-fade-in text-accent text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] md:tracking-[0.4em] mb-4 md:mb-7 flex items-center gap-2 sm:gap-3">
            <span className="w-6 sm:w-8 h-px bg-accent/70 inline-block" />
            Contract Paralegal · Nationwide · Remote
          </p>

          {/* Main Headline — fluid type scale */}
          <h1 className="animate-fade-in-delay-1 text-hero-display mb-4 md:mb-7 text-primary-foreground">
            Precision.
            <br />
            <span className="italic" style={{ opacity: 0.85 }}>Dedication.</span>
            <br />
            Results.
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-delay-2 text-sm sm:text-base md:text-xl font-bold leading-[1.7] max-w-lg mb-8 md:mb-12 tracking-wide" style={{ color: '#355E3B' }}>
            Expert paralegal support for law firms and attorneys
            across all 50 states — remote, reliable, and ready to support your practice.
          </p>

          {/* CTAs — stacked on mobile, row on sm+ */}
          <div className="animate-fade-in-delay-3 flex flex-col xs:flex-row flex-wrap gap-3 sm:gap-4 items-stretch xs:items-center">
            {/* Primary CTA — full width on mobile */}
            <button
              type="button"
              onClick={() => {
                trackCTAClick('Book a Consultation', 'hero', '/book-consultation');
                trackBookConsultationClick('hero');
                setBookingModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-4 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 active:scale-[0.98] transition-all duration-300 hover:gap-4 shadow-lg shadow-accent/20 min-h-[52px] touch-manipulation">
              Book a Consultation
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <Link
              href="/contact"
              onClick={() => {
                trackCTAClick('Work With Me', 'hero', '/contact');
              }}
              className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-4 border border-primary-foreground/35 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/10 hover:border-primary-foreground/60 active:scale-[0.98] transition-all duration-300 min-h-[52px] touch-manipulation">
              Work With Me
            </Link>
            <Link
              href="/services"
              onClick={() => {
                trackCTAClick('View Services', 'hero', '/services');
                trackViewServicesClick('hero');
              }}
              className="hidden sm:inline-flex items-center justify-center gap-2.5 px-8 py-4 border border-primary-foreground/20 text-primary-foreground/80 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/8 hover:border-primary-foreground/40 hover:text-primary-foreground transition-all duration-300 min-h-[52px]">
              View Services
            </Link>
            <Link
              href="/portal/register"
              onClick={() => trackCTAClick('Client Portal', 'hero', '/portal/register')}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-8 py-4 border border-primary-foreground/20 text-primary-foreground/80 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/8 hover:border-primary-foreground/40 hover:text-primary-foreground transition-all duration-300 min-h-[52px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Client Portal
            </Link>
          </div>

          {/* Mobile-only secondary links row */}
          <div className="animate-fade-in-delay-3 flex sm:hidden items-center gap-4 mt-4">
            <Link
              href="/services"
              onClick={() => trackViewServicesClick('hero')}
              className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-[0.15em] hover:text-primary-foreground transition-colors underline underline-offset-4 min-h-[44px] flex items-center">
              View Services
            </Link>
            <span className="text-primary-foreground/30 text-xs">·</span>
            <Link
              href="/portal/register"
              onClick={() => trackCTAClick('Client Portal', 'hero', '/portal/register')}
              className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-[0.15em] hover:text-primary-foreground transition-colors underline underline-offset-4 min-h-[44px] flex items-center">
              Client Portal
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 right-6 md:right-10 hidden md:flex flex-col items-center gap-3">
          <span className="text-primary-foreground/40 text-[10px] uppercase tracking-[0.3em] rotate-90 origin-center">Scroll</span>
          <div className="w-px h-14 bg-gradient-to-b from-primary-foreground/0 via-primary-foreground/30 to-accent relative overflow-hidden">
            <div className="scroll-dot absolute top-0 left-0 w-full h-4 bg-accent" />
          </div>
        </div>
      </div>

      <BookConsultationModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)} />
      
    </section>
  );
}
