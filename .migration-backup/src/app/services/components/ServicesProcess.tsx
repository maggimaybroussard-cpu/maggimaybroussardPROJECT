'use client';

import React, { useEffect, useRef } from 'react';

const steps = [
  {
    number: '01/',
    title: 'Initial Consultation',
    description: "We discuss your firm's needs, practice areas, and the scope of support required. No obligation, fully confidential.",
  },
  {
    number: '02/',title: 'Engagement Agreement',description: 'A clear, straightforward contract outlining deliverables, timeline, rates, and confidentiality terms.',
  },
  {
    number: '03/',title: 'Active Support',description: 'I integrate into your workflow — using your preferred tools and communication channels — and begin delivering work.',
  },
  {
    number: '04/',title: 'Ongoing Partnership',description: 'Regular check-ins, transparent progress updates, and flexible scaling as your needs evolve.',
  },
];

export default function ServicesProcess() {
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
    <section ref={sectionRef} className="py-16 md:py-28 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="scroll-reveal-hidden mb-12 md:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-accent" />
            How It Works
          </p>
          <h2 className="text-section-heading text-primary-foreground">
            A simple path
            <br />
            <span className="italic opacity-80">to working together</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="scroll-reveal-hidden group space-y-4 md:space-y-5"
              style={{ transitionDelay: `${index * 0.12}s` }}
            >
              <div className="font-serif text-4xl text-primary-foreground/15 italic group-hover:text-accent group-hover:opacity-100 transition-all duration-500">
                {step.number}
              </div>
              <h3 className="text-base font-semibold uppercase tracking-widest text-primary-foreground">
                {step.title}
              </h3>
              <div className="h-px w-full bg-primary-foreground/10 group-hover:bg-accent/40 transition-colors duration-300" />
              <p className="text-sm text-primary-foreground/60 leading-relaxed font-light">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}