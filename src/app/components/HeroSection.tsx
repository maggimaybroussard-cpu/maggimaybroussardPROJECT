'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { trackCTAClick, trackBookConsultationClick, trackViewServicesClick } from '@/lib/analytics';

export default function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);

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
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-10 pb-20 md:pb-32 pt-36 md:pt-44">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <p className="animate-fade-in text-accent text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.3em] md:tracking-[0.4em] mb-5 md:mb-7 flex items-center gap-3">
            <span className="w-8 h-px bg-accent/70 inline-block" />
            Contract Paralegal · Nationwide · Remote
          </p>

          {/* Main Headline */}
          <h1 className="animate-fade-in-delay-1 text-hero-display mb-5 md:mb-7 text-primary-foreground">
            Precision.
            <br />
            <span className="italic" style={{ opacity: 0.85 }}>Dedication.</span>
            <br />
            Results.
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-delay-2 text-base md:text-xl font-bold leading-[1.7] max-w-lg mb-10 md:mb-12 tracking-wide" style={{ color: '#355E3B' }}>
            Expert paralegal support for law firms and attorneys
            across all 50 states — remote, reliable, and ready to support your practice.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-delay-3 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
            <Link
              href="/contact"
              onClick={() => {
                trackCTAClick('Work With Me', 'hero', '/contact');
                trackBookConsultationClick('hero');
              }}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 hover:gap-4 shadow-lg shadow-accent/20">
              
              Work With Me
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/services"
              onClick={() => {
                trackCTAClick('View Services', 'hero', '/services');
                trackViewServicesClick('hero');
              }}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 border border-primary-foreground/35 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/10 hover:border-primary-foreground/60 transition-all duration-300">
              
              View Services
            </Link>
            <Link
              href="/portal/register"
              onClick={() => trackCTAClick('Client Portal', 'hero', '/portal/register')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-primary-foreground/20 text-primary-foreground/80 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary-foreground/8 hover:border-primary-foreground/40 hover:text-primary-foreground transition-all duration-300">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Client Portal
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 right-10 hidden md:flex flex-col items-center gap-3">
          <span className="text-primary-foreground/40 text-[10px] uppercase tracking-[0.3em] rotate-90 origin-center">Scroll</span>
          <div className="w-px h-14 bg-gradient-to-b from-primary-foreground/0 via-primary-foreground/30 to-accent relative overflow-hidden">
            <div className="scroll-dot absolute top-0 left-0 w-full h-4 bg-accent" />
          </div>
        </div>
      </div>
    </section>);

}