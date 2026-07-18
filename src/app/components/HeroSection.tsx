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
        bg.style.transform = `scale(1.07) translate(${mx * 14}px, ${my * 9}px)`;
      }
    });
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      hero.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col justify-end overflow-hidden"
      aria-label="Hero">

      {/* Background Image */}
      <div className="absolute inset-0 hero-bg transition-transform duration-700 ease-out will-change-transform">
        <AppImage
          src="https://images.unsplash.com/photo-1553714167-d5dddd691160"
          alt="Modern minimal white bookcase with neatly arranged books and clean shelves in a bright airy library"
          fill
          priority
          quality={85}
          className="object-cover object-center"
          sizes="100vw"
          fetchPriority="high"
          decoding="sync" />

        {/* Multi-layer gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/55 to-primary/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent/6 via-transparent to-transparent" />
        {/* Vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(27,42,74,0.5) 100%)' }} />
      </div>

      {/* Animated accent orbs */}
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full opacity-[0.06] blur-3xl pointer-events-none"
      style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
      <div className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full opacity-[0.04] blur-3xl pointer-events-none"
      style={{ background: 'radial-gradient(circle, #C8965A 0%, transparent 70%)' }} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-10 pb-16 sm:pb-24 md:pb-36 pt-28 sm:pt-36 md:pt-48">
        <div className="max-w-3xl">

          {/* Floating credential badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6 md:mb-8 border border-primary-foreground/15 glass-dark">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary-foreground/80">
              NALA · NFPA Certified · Available Nationwide
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="animate-fade-in-delay-1 text-hero-display mb-5 md:mb-8 text-primary-foreground">
            Precision.
            <br />
            <span className="italic text-gradient-accent" style={{ WebkitTextFillColor: undefined }}>
              <span className="shimmer-text">Dedication.</span>
            </span>
            <br />
            Results.
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-delay-2 text-sm sm:text-base md:text-[18px] font-medium leading-[1.75] max-w-lg mb-9 md:mb-14 text-primary-foreground/85 tracking-wide">
            Expert paralegal support for law firms and attorneys
            across all 50 states — remote, reliable, and ready to support your practice.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-delay-3 flex flex-col xs:flex-row flex-wrap gap-3 sm:gap-4 items-stretch xs:items-center">
            <button
              type="button"
              onClick={() => {
                trackCTAClick('Book a Consultation', 'hero', '/book-consultation');
                trackBookConsultationClick('hero');
                setBookingModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 active:scale-[0.98] transition-all duration-300 hover:gap-4 shadow-xl shadow-accent/25 min-h-[52px] touch-manipulation pulse-glow">
              Book a Consultation
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <Link
              href="/contact"
              onClick={() => trackCTAClick('Work With Me', 'hero', '/contact')}
              className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-4 border border-primary-foreground/30 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/12 hover:border-primary-foreground/55 active:scale-[0.98] transition-all duration-300 min-h-[52px] touch-manipulation backdrop-blur-sm">
              Work With Me
            </Link>
            <Link
              href="/services"
              onClick={() => {
                trackCTAClick('View Services', 'hero', '/services');
                trackViewServicesClick('hero');
              }}
              className="hidden sm:inline-flex items-center justify-center gap-2.5 px-8 py-4 border border-primary-foreground/15 text-primary-foreground/75 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/8 hover:border-primary-foreground/35 hover:text-primary-foreground transition-all duration-300 min-h-[52px]">
              View Services
            </Link>
            <Link
              href="/portal/register"
              onClick={() => trackCTAClick('Client Portal', 'hero', '/portal/register')}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-8 py-4 border border-primary-foreground/15 text-primary-foreground/75 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/8 hover:border-primary-foreground/35 hover:text-primary-foreground transition-all duration-300 min-h-[52px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Client Portal
            </Link>
          </div>

          {/* Mobile-only secondary links */}
          <div className="animate-fade-in-delay-3 flex sm:hidden items-center gap-4 mt-5">
            <Link
              href="/services"
              onClick={() => trackViewServicesClick('hero')}
              className="text-primary-foreground/65 text-xs font-semibold uppercase tracking-[0.15em] hover:text-primary-foreground transition-colors underline underline-offset-4 min-h-[44px] flex items-center">
              View Services
            </Link>
            <span className="text-primary-foreground/25 text-xs">·</span>
            <Link
              href="/portal/register"
              onClick={() => trackCTAClick('Client Portal', 'hero', '/portal/register')}
              className="text-primary-foreground/65 text-xs font-semibold uppercase tracking-[0.15em] hover:text-primary-foreground transition-colors underline underline-offset-4 min-h-[44px] flex items-center">
              Client Portal
            </Link>
          </div>

          {/* Social proof micro-bar */}
          <div className="animate-fade-in-delay-3 hidden md:flex items-center gap-5 mt-10 pt-8 border-t border-primary-foreground/10">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) =>
                <div key={i} className="w-7 h-7 rounded-full bg-accent/20 border-2 border-primary/80 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent/60">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-primary-foreground/55 font-medium">Trusted by attorneys nationwide</span>
            </div>
            <span className="text-primary-foreground/20">·</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) =>
              <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#C8965A" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
              <span className="text-[11px] text-primary-foreground/55 font-medium ml-1">5.0 rated</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 right-6 md:right-10 hidden md:flex flex-col items-center gap-3">
          <span className="text-primary-foreground/35 text-[9px] uppercase tracking-[0.35em] rotate-90 origin-center">Scroll</span>
          <div className="w-px h-16 bg-gradient-to-b from-primary-foreground/0 via-primary-foreground/25 to-accent relative overflow-hidden">
            <div className="scroll-dot absolute top-0 left-0 w-full h-5 bg-accent" />
          </div>
        </div>
      </div>

      <BookConsultationModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)} />
    </section>);

}