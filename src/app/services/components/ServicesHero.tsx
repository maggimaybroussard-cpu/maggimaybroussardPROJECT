'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import BookConsultationModal from '@/components/BookConsultationModal';

export default function ServicesHero() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  return (
    <>
      <section className="relative min-h-[65vh] sm:min-h-[70vh] flex items-end overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <AppImage
            src="https://img.rocket.new/generatedImages/rocket_gen_img_102787f3d-1772128570053.png"
            alt="Clean organized law office with stacked files, warm desk lamp light, dark wood bookshelves filled with legal volumes"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/65 to-primary/25" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-10 pb-10 sm:pb-14 md:pb-20 pt-28 sm:pt-32 md:pt-44">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-end">
            {/* Left — headline */}
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] sm:tracking-[0.35em] text-accent mb-4 sm:mb-5 flex items-center gap-2 sm:gap-3">
                <span className="w-5 sm:w-6 h-px bg-accent" />
                Full-Service Paralegal Support
              </p>
              <h1 className="text-hero-display text-primary-foreground max-w-2xl">
                Every service
                <br />
                <span className="italic opacity-85">your firm needs</span>
              </h1>
              <p className="mt-4 sm:mt-5 text-primary-foreground/60 text-sm sm:text-base md:text-lg font-light leading-relaxed max-w-md">
                From litigation support to contract review, Broussard Legal Services delivers
                professional-grade paralegal work — remote, reliable, and nationwide.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-accent/90 active:scale-[0.98] transition-all duration-300 min-h-[48px] touch-manipulation">
                  Book a Consultation
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 border border-primary-foreground/30 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:border-accent hover:text-accent active:scale-[0.98] transition-all duration-300 min-h-[48px] touch-manipulation">
                  View Pricing
                </Link>
              </div>
            </div>

            {/* Right — stat pills (hidden on small mobile, shown sm+) */}
            <div className="hidden sm:flex flex-col gap-3 sm:gap-4 lg:items-end">
              {[
              { value: '5+', label: 'Practice Areas Covered' },
              { value: '48hr', label: 'Standard Turnaround' },
              { value: '100%', label: 'Remote & Nationwide' },
              { value: 'NDA', label: 'Strict Confidentiality' }]?.
              map((stat) =>
              <div
                key={stat?.label}
                className="flex items-center gap-4 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 rounded-2xl px-5 sm:px-6 py-3 sm:py-4 lg:min-w-[260px]">
                  <span className="font-serif text-2xl sm:text-3xl text-accent">{stat?.value}</span>
                  <span className="text-primary-foreground/70 text-xs sm:text-sm font-light">{stat?.label}</span>
                </div>
              )}
            </div>

            {/* Mobile stat pills — compact 2-col grid */}
            <div className="flex sm:hidden grid grid-cols-2 gap-2">
              {[
              { value: '5+', label: 'Practice Areas' },
              { value: '48hr', label: 'Turnaround' },
              { value: '100%', label: 'Remote' },
              { value: 'NDA', label: 'Confidential' }]?.
              map((stat) =>
              <div
                key={stat?.label}
                className="flex flex-col items-center bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 rounded-xl px-3 py-3 text-center">
                  <span className="font-serif text-xl text-accent">{stat?.value}</span>
                  <span className="text-primary-foreground/70 text-[10px] font-light mt-0.5">{stat?.label}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <BookConsultationModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)} />
    </>);

}