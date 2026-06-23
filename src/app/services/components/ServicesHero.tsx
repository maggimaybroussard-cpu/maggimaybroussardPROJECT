import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

export default function ServicesHero() {
  return (
    <section className="relative min-h-[70vh] flex items-end overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_102787f3d-1772128570053.png"
          alt="Clean organized law office with stacked files, warm desk lamp light, dark wood bookshelves filled with legal volumes"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/65 to-primary/25" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-10 pb-14 md:pb-20 pt-36 md:pt-44">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-end">
          {/* Left — headline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-5 flex items-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Full-Service Paralegal Support
            </p>
            <h1 className="text-hero-display text-primary-foreground max-w-2xl">
              Every service
              <br />
              <span className="italic opacity-85">your firm needs</span>
            </h1>
            <p className="mt-5 text-primary-foreground/60 text-base md:text-lg font-light leading-relaxed max-w-md">
              From litigation support to contract review, Broussard Legal Services delivers
              professional-grade paralegal work — remote, reliable, and nationwide.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book-consultation"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-accent/90 transition-all duration-300"
              >
                Book a Consultation
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-primary-foreground/30 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:border-accent hover:text-accent transition-all duration-300"
              >
                View Pricing
              </Link>
            </div>
          </div>

          {/* Right — stat pills */}
          <div className="flex flex-col gap-4 lg:items-end">
            {[
              { value: '10+', label: 'Practice Areas Covered' },
              { value: '48hr', label: 'Average Turnaround' },
              { value: '100%', label: 'Remote & Nationwide' },
              { value: 'NDA', label: 'Strict Confidentiality' },
            ]?.map((stat) => (
              <div
                key={stat?.label}
                className="flex items-center gap-4 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 rounded-2xl px-6 py-4 lg:min-w-[260px]"
              >
                <span className="font-serif text-3xl text-accent">{stat?.value}</span>
                <span className="text-primary-foreground/70 text-sm font-light">{stat?.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}