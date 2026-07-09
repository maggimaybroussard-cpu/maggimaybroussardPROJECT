'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const stats = [
{ number: '4+', label: 'Years Experience' },
{ number: 'All 50', label: 'States — Remote' },
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
      { threshold: 0.12 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} suppressHydrationWarning className="py-20 md:py-36 bg-background overflow-hidden" id="about" aria-label="About Broussard Legal Services">
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-5 md:px-10">
        <div suppressHydrationWarning className="grid lg:grid-cols-2 gap-12 lg:gap-28 items-center">

          {/* Left — Photo */}
          <div suppressHydrationWarning className="scroll-reveal-hidden relative">
            <div suppressHydrationWarning className="relative card-rounded overflow-hidden aspect-[4/5] max-w-sm mx-auto lg:mx-0 shadow-2xl shadow-primary/10">
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_114ba7068-1776777309074.png"
                alt="Professional woman in business attire seated at a bright, well-organized desk with legal documents"
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 100vw, 384px" />
              {/* Warm overlay tint */}
              <div suppressHydrationWarning className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent" />
              {/* Accent border ring */}
              <div suppressHydrationWarning className="absolute inset-0 rounded-[2rem] ring-1 ring-accent/25 pointer-events-none" />
            </div>

            {/* Decorative dot grid */}
            <div
              suppressHydrationWarning
              className="absolute -top-10 -left-10 w-36 h-36 opacity-15 hidden md:block"
              style={{ backgroundImage: 'radial-gradient(circle, var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }} />

            {/* Accent corner accent */}
            <div suppressHydrationWarning className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-accent/8 blur-2xl hidden md:block" />
          </div>

          {/* Right — Bio + Stats */}
          <div suppressHydrationWarning className="flex flex-col gap-8 md:gap-10">

            {/* Section label + heading */}
            <div suppressHydrationWarning className="scroll-reveal-hidden">
              <p suppressHydrationWarning className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 md:mb-5 flex items-center gap-3">
                <span suppressHydrationWarning className="w-8 h-px bg-accent/70" />
                About Maggi May
              </p>
              <h2 suppressHydrationWarning className="text-section-heading text-foreground leading-[0.95]">
                Your dedicated
                <br />
                <span suppressHydrationWarning className="italic" style={{ opacity: 0.75 }}>legal partner</span>
              </h2>
            </div>

            {/* Bio paragraphs */}
            <div suppressHydrationWarning className="flex flex-col gap-4 md:gap-5">
              <div suppressHydrationWarning className="scroll-reveal-hidden" style={{ transitionDelay: '0.1s' }}>
                <p suppressHydrationWarning className="text-base md:text-[17px] text-muted-foreground leading-[1.8] font-light">
                  With over 4+ years of experience supporting attorneys and law firms nationwide,
                  I bring meticulous attention to detail, deep legal knowledge, and unwavering
                  professionalism to every engagement.
                </p>
              </div>
              <div suppressHydrationWarning className="scroll-reveal-hidden" style={{ transitionDelay: '0.18s' }}>
                <p suppressHydrationWarning className="text-base text-muted-foreground leading-[1.8] font-light">
                  As a contracted, remote legal services provider, I offer flexible support tailored to your
                  firm&apos;s needs — from complex litigation assistance to routine document management —
                  without the overhead of a full-time hire. Based in Louisiana, available everywhere.
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div
              suppressHydrationWarning
              className="scroll-reveal-hidden grid grid-cols-2 gap-x-6 gap-y-5 pt-6 md:pt-8 border-t border-border/60"
              style={{ transitionDelay: '0.25s' }}>
              {stats.map((stat) =>
              <div suppressHydrationWarning key={stat.label} className="space-y-1.5">
                  <p suppressHydrationWarning className="stat-number">{stat.number}</p>
                  <p suppressHydrationWarning className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">{stat.label}</p>
                </div>
              )}
            </div>

            {/* Quote */}
            <div suppressHydrationWarning className="scroll-reveal-hidden flex items-start gap-4 pt-2" style={{ transitionDelay: '0.35s' }}>
              <div suppressHydrationWarning className="w-0.5 h-12 bg-accent/50 shrink-0 mt-1 rounded-full" />
              <p suppressHydrationWarning className="font-serif text-[1.2rem] md:text-[1.4rem] italic text-accent leading-snug">
                &ldquo;Every deadline met. Every detail covered.&rdquo;
              </p>
            </div>

            {/* CTA */}
            <div suppressHydrationWarning className="scroll-reveal-hidden" style={{ transitionDelay: '0.42s' }}>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:gap-4 transition-all duration-300 group">
                Work With Me
                <svg suppressHydrationWarning width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>);

}