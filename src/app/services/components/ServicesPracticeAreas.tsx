'use client';

import React, { useEffect, useRef } from 'react';

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
        </div>

        {/* Pill grid */}
        <div className="flex flex-wrap gap-3">
          {practiceAreas.map((area, index) => (
            <div
              key={area}
              className="scroll-reveal-hidden group flex items-center gap-2.5 bg-primary-foreground/8 border border-primary-foreground/15 rounded-full px-5 py-2.5 hover:bg-accent/20 hover:border-accent/40 transition-all duration-300 cursor-default"
              style={{ transitionDelay: `${index * 0.04}s` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 group-hover:bg-accent transition-colors duration-300" />
              <span className="text-sm text-primary-foreground/70 group-hover:text-primary-foreground font-light transition-colors duration-300">
                {area}
              </span>
            </div>
          ))}
          <div className="scroll-reveal-hidden flex items-center gap-2.5 bg-accent/20 border border-accent/40 rounded-full px-5 py-2.5" style={{ transitionDelay: '0.5s' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-sm text-accent font-semibold">+ More on request</span>
          </div>
        </div>
      </div>
    </section>
  );
}
