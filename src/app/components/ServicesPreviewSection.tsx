'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackServiceCardHover, trackViewAllServicesClick, trackViewServicesClick, trackServiceClick, trackBookConsultationClick, trackCTAClick } from '@/lib/analytics';

const services = [
  {
    id: '01',
    title: 'Litigation Support',
    description: 'Comprehensive trial preparation, exhibit organization, and case file management for attorneys in active litigation.',
    tag: 'Most Requested',
  },
  {
    id: '02',
    title: 'Legal Research',
    description: 'Thorough statutory, regulatory, and case law research with clear, actionable memoranda delivered on time.',
    tag: null,
  },
  {
    id: '03',
    title: 'Document Drafting',
    description: 'Precise drafting of pleadings, motions, contracts, and correspondence tailored to your jurisdiction.',
    tag: null,
  },
  {
    id: '04',
    title: 'Contract Review',
    description: 'Detailed review and annotation of contracts, NDAs, and agreements with risk identification summaries.',
    tag: null,
  },
];

export default function ServicesPreviewSection() {
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
      { threshold: 0.07 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 md:py-36 bg-secondary/25 relative overflow-hidden" id="services-preview" aria-label="Services overview">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 20% 80%, var(--primary) 0%, transparent 50%)' }} />

      <div className="max-w-7xl mx-auto px-5 md:px-10 relative z-10">

        {/* Header */}
        <div className="scroll-reveal-hidden flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14 md:mb-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 md:mb-5 flex items-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              What I Do
            </p>
            <h2 className="text-section-heading text-foreground">
              Services built
              <br />
              <span className="italic text-accent/75">for your practice</span>
            </h2>
          </div>
          <p className="text-base text-muted-foreground leading-[1.8] max-w-xs font-light md:text-right">
            Specialized legal support across all practice areas, delivered with precision and confidentiality.
          </p>
        </div>

        {/* Services List */}
        <div className="divide-y divide-border/50">
          {services.map((service, index) => (
            <div
              key={service.id}
              className="scroll-reveal-hidden group py-6 md:py-10 flex flex-col md:flex-row md:items-center gap-3 md:gap-10 px-5 md:px-6 -mx-5 md:-mx-6 rounded-2xl transition-all duration-400 hover:bg-card/80 hover:shadow-sm"
              style={{ transitionDelay: `${index * 0.08}s` }}
              onMouseEnter={() => trackServiceCardHover(service.title, 'home_services_preview')}
            >
              {/* Top row on mobile: number + title */}
              <div className="flex items-center gap-3 md:contents">
                {/* Number */}
                <span className="font-serif text-[2rem] md:text-[2.75rem] leading-none text-accent/20 group-hover:text-accent/50 transition-all duration-400 w-10 md:w-16 shrink-0 select-none">
                  {service.id}
                </span>
                {/* Title + tag */}
                <div className="flex items-center gap-2.5 md:w-64 shrink-0">
                  <Link
                    href="/services"
                    onClick={() => trackServiceClick(service.title, 'home_services_preview')}
                    className="font-serif text-lg md:text-[1.8rem] text-foreground group-hover:text-accent transition-colors duration-300 leading-tight hover:underline"
                  >
                    {service.title}
                  </Link>
                  {service.tag && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-accent/12 text-accent border border-accent/20 whitespace-nowrap">
                      {service.tag}
                    </span>
                  )}
                </div>
              </div>
              {/* Description */}
              <p className="text-muted-foreground leading-[1.8] font-light text-sm md:text-[15px] flex-1 pl-[3.25rem] md:pl-0">
                {service.description}
              </p>
              {/* Arrow indicator */}
              <div className="hidden md:flex shrink-0 items-center gap-3">
                <Link
                  href="/intake"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.12em] hover:bg-accent/90 transition-all duration-300 shadow-sm hover:shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackBookConsultationClick(`home_services_preview_${service.title.toLowerCase().replace(/\s+/g, '_')}`);
                    trackCTAClick('Schedule Consultation', `home_services_preview_${service.title.toLowerCase().replace(/\s+/g, '_')}`, '/intake');
                  }}
                >
                  Schedule
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="scroll-reveal-hidden mt-12 md:mt-18 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/services"
            onClick={() => {
              trackViewAllServicesClick('home_services_preview');
              trackViewServicesClick('home_services_preview');
            }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/15 hover:shadow-primary/25 hover:gap-4"
          >
            View All Services
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/intake"
            onClick={() => {
              trackBookConsultationClick('home_services_preview_bottom');
              trackCTAClick('Schedule Consultation', 'home_services_preview_bottom', '/intake');
            }}
            className="sm:hidden inline-flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 shadow-sm"
          >
            Schedule Consultation
          </Link>
        </div>
      </div>
    </section>
  );
}