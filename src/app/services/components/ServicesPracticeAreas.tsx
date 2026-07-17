'use client';

import React, { useEffect, useRef, useState } from 'react';
import CalendlyServiceModal from './CalendlyServiceModal';

const practiceAreas = [
  'Civil Litigation',
  'Family Law',
  'Real Estate',
  'Estate Planning & Probate',
  'Business & Corporate',
  'Employment Law',
  'Personal Injury',
  'Criminal Defense',
  'Immigration',
  'Intellectual Property',
  'Healthcare & Medical',
  'Environmental Law',
];

export default function ServicesPracticeAreas() {
  const sectionRef = useRef<HTMLElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(undefined);

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

  const handleAreaClick = (area: string) => {
    setSelectedArea(area);
    setModalOpen(true);
  };

  return (
    <>
      <section ref={sectionRef} className="py-16 md:py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="scroll-reveal-hidden mb-10 md:mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Practice Areas
            </p>
            <h2 className="text-section-heading text-primary-foreground max-w-xl">
              Support across
              <br />
              <span className="italic opacity-80">every practice area</span>
            </h2>
            <p className="mt-4 text-primary-foreground/55 text-sm md:text-base font-light max-w-lg leading-relaxed">
              Whether you're a solo practitioner or a multi-attorney firm, Broussard Legal Services
              has the expertise to support your specific practice area.
            </p>
            <p className="mt-3 text-primary-foreground/65 text-xs font-light">
              Tap any practice area to book a consultation with that service pre-selected.
            </p>
          </div>

          {/* Pill grid — each area is now a clickable button */}
          <div className="flex flex-wrap gap-3">
            {practiceAreas.map((area, index) => (
              <button
                key={area}
                onClick={() => handleAreaClick(area)}
                className="scroll-reveal-hidden group flex items-center gap-2.5 bg-primary-foreground/8 border border-primary-foreground/15 rounded-full px-5 py-2.5 hover:bg-accent/20 hover:border-accent/40 transition-all duration-300 cursor-pointer text-left"
                style={{ transitionDelay: `${index * 0.04}s` }}
                aria-label={`Book consultation for ${area}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 group-hover:bg-accent transition-colors duration-300" />
                <span className="text-sm text-primary-foreground/70 group-hover:text-primary-foreground font-light transition-colors duration-300">
                  {area}
                </span>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-0 group-hover:opacity-60 transition-opacity duration-300 text-accent -ml-0.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
            <div className="scroll-reveal-hidden flex items-center gap-2.5 bg-accent/20 border border-accent/40 rounded-full px-5 py-2.5" style={{ transitionDelay: '0.5s' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-sm text-accent font-semibold">+ More on request</span>
            </div>
          </div>

          {/* CTA nudge below pills */}
          <div className="scroll-reveal-hidden mt-10 flex items-center gap-4" style={{ transitionDelay: '0.55s' }}>
            <button
              onClick={() => { setSelectedArea(undefined); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Book a Free Consultation
            </button>
            <span className="text-primary-foreground/35 text-xs">30 min · no obligation</span>
          </div>
        </div>
      </section>

      <CalendlyServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        serviceInterest={selectedArea}
      />
    </>
  );
}
