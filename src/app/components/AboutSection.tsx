'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const stats = [
{ number: '3+', label: 'Years Experience' },
{ number: '50', label: 'States Served' },
{ number: '100%', label: 'Remote & Flexible' },
{ number: 'Flat-Rate', label: 'Transparent Pricing' }];


export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const elements = sectionRef.current?.querySelectorAll('.scroll-reveal-hidden');
    if (!elements) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} suppressHydrationWarning className="py-20 sm:py-28 md:py-40 bg-background overflow-hidden" id="about" aria-label="About Broussard Legal Services">
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
        <div suppressHydrationWarning className="grid lg:grid-cols-2 gap-12 sm:gap-16 lg:gap-32 items-center">

          {/* Left — Photo */}
          <div suppressHydrationWarning className="scroll-reveal-hidden relative">
            {/* Decorative background shape */}
            <div suppressHydrationWarning className="absolute -inset-4 rounded-[3rem] opacity-[0.04] hidden lg:block"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, var(--accent) 0%, transparent 70%)' }} />

            <div suppressHydrationWarning className="relative card-rounded overflow-hidden aspect-[4/5] max-w-xs sm:max-w-sm mx-auto lg:mx-0 shadow-2xl shadow-primary/15">
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_114ba7068-1776777309074.png"
                alt="Professional woman in business attire seated at a bright, well-organized desk with legal documents"
                fill
                className="object-cover object-top transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 640px) 100vw, 384px" />
              {/* Warm overlay tint */}
              <div suppressHydrationWarning className="absolute inset-0 bg-gradient-to-t from-primary/25 via-transparent to-transparent" />
              {/* Accent border ring */}
              <div suppressHydrationWarning className="absolute inset-0 rounded-[2rem] ring-1 ring-accent/20 pointer-events-none" />
            </div>

            {/* Floating credential card */}
            <div suppressHydrationWarning className="absolute -bottom-5 -right-3 md:-right-8 glass rounded-2xl px-4 py-3.5 shadow-xl shadow-primary/10 hidden md:flex items-center gap-3 animate-float">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight">NALA Certified</p>
                <p className="text-[10px] text-muted-foreground">Paralegal Professional</p>
              </div>
            </div>

            {/* Decorative dot grid */}
            <div
              suppressHydrationWarning
              className="absolute -top-10 -left-10 w-36 h-36 opacity-10 hidden md:block"
              style={{ backgroundImage: 'radial-gradient(circle, var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }} />
          </div>

          {/* Right — Bio + Stats */}
          <div suppressHydrationWarning className="flex flex-col gap-7 sm:gap-9 md:gap-11">

            {/* Section label + heading */}
            <div suppressHydrationWarning className="scroll-reveal-hidden">
              <p suppressHydrationWarning className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.35em] sm:tracking-[0.4em] text-accent mb-3 sm:mb-4 md:mb-5 flex items-center gap-2 sm:gap-3">
                <span suppressHydrationWarning className="w-6 sm:w-8 h-px bg-accent/70" />
                About Maggi May
              </p>
              <h2 suppressHydrationWarning className="text-section-heading text-foreground leading-[0.95]">
                Your dedicated
                <br />
                <span suppressHydrationWarning className="italic text-accent/80">legal partner</span>
              </h2>
            </div>

            {/* Bio paragraphs */}
            <div suppressHydrationWarning className="flex flex-col gap-4 md:gap-5">
              <div suppressHydrationWarning className="scroll-reveal-hidden" style={{ transitionDelay: '0.1s' }}>
                <p suppressHydrationWarning className="text-sm sm:text-base md:text-[17px] text-muted-foreground leading-[1.85] font-light">
                  With a background supporting attorneys and law firms across multiple practice areas,
                  I bring meticulous attention to detail, solid legal knowledge, and unwavering
                  professionalism to every engagement.
                </p>
              </div>
              <div suppressHydrationWarning className="scroll-reveal-hidden" style={{ transitionDelay: '0.18s' }}>
                <p suppressHydrationWarning className="text-sm sm:text-base text-muted-foreground leading-[1.85] font-light">
                  As a contracted, remote legal services provider, I offer flexible support tailored to your
                  firm&apos;s needs — from litigation assistance to document management —
                  without the overhead of a full-time hire. Based in Louisiana, available remotely.
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div
              suppressHydrationWarning
              className="scroll-reveal-hidden grid grid-cols-2 gap-x-5 sm:gap-x-7 gap-y-5 sm:gap-y-6 pt-6 sm:pt-7 md:pt-9 border-t border-border/50"
              style={{ transitionDelay: '0.25s' }}>
              {stats.map((stat) =>
              <div suppressHydrationWarning key={stat.label} className="space-y-1.5 group">
                  <p suppressHydrationWarning className="stat-number transition-colors duration-300 group-hover:text-[#8B3A45]">{stat.number}</p>
                  <p suppressHydrationWarning className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">{stat.label}</p>
                </div>
              )}
            </div>

            {/* Quote */}
            <div suppressHydrationWarning className="scroll-reveal-hidden flex items-start gap-3 sm:gap-4 pt-2" style={{ transitionDelay: '0.35s' }}>
              <div suppressHydrationWarning className="w-0.5 h-12 sm:h-14 bg-gradient-to-b from-accent/70 to-accent/20 shrink-0 mt-1 rounded-full" />
              <p suppressHydrationWarning className="font-serif text-[1.1rem] sm:text-[1.25rem] md:text-[1.45rem] italic text-accent leading-snug">
                &ldquo;Every deadline met. Every detail covered.&rdquo;
              </p>
            </div>

            {/* CTA */}
            <div suppressHydrationWarning className="scroll-reveal-hidden flex items-center gap-4" style={{ transitionDelay: '0.42s' }}>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-accent/20 min-h-[44px]">
                Work With Me
                <svg suppressHydrationWarning width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/services"
                className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-accent transition-colors duration-300 min-h-[44px] flex items-center gap-1.5">
                View Services
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>);

}