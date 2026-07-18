'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackServiceCardHover, trackViewAllServicesClick, trackViewServicesClick, trackServiceClick, trackBookConsultationClick, trackCTAClick } from '@/lib/analytics';

const services = [
  {
    id: '01',
    title: 'Litigation Support',
    description: 'Comprehensive trial preparation, exhibit organization, and case file management for attorneys in active litigation.',
  },
  {
    id: '02',
    title: 'Legal Research',
    description: 'Thorough statutory, regulatory, and case law research with clear, actionable memoranda delivered on time.',
  },
  {
    id: '03',
    title: 'Document Drafting',
    description: 'Precise drafting of pleadings, motions, contracts, and correspondence tailored to your jurisdiction.',
  },
  {
    id: '04',
    title: 'Contract Review',
    description: 'Detailed review and annotation of contracts, NDAs, and agreements with risk identification summaries.',
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
      { threshold: 0.08 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 md:py-32 bg-secondary/30" id="services-preview" aria-label="Services overview">
      <div className="max-w-7xl mx-auto px-5 md:px-10">

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
              <span className="italic" style={{ opacity: 0.75 }}>for your practice</span>
            </h2>
          </div>
          <p className="text-base text-muted-foreground leading-[1.75] max-w-xs font-light md:text-right">
            Specialized legal support across all practice areas, delivered with precision and confidentiality.
          </p>
        </div>

        {/* Services List */}
        <div className="divide-y divide-border/60">
          {services.map((service, index) => (
            <div
              key={service.id}
              className="scroll-reveal-hidden group py-5 md:py-9 flex flex-col md:flex-row md:items-center gap-3 md:gap-10 px-4 md:px-5 -mx-4 md:-mx-5 rounded-2xl transition-all duration-300 hover:bg-background/70"
              style={{ transitionDelay: `${index * 0.08}s` }}
              onMouseEnter={() => trackServiceCardHover(service.title, 'home_services_preview')}
            >
              {/* Top row on mobile: number + title */}
              <div className="flex items-center gap-3 md:contents">
                {/* Number */}
                <span className="font-serif text-[2rem] md:text-[2.5rem] leading-none text-accent/25 group-hover:text-accent/60 transition-colors duration-300 w-10 md:w-14 shrink-0 select-none">
                  {service.id}
                </span>
                {/* Title */}
                <Link
                  href="/services"
                  onClick={() => trackServiceClick(service.title, 'home_services_preview')}
                  className="font-serif text-lg md:text-[1.75rem] text-foreground group-hover:text-primary transition-colors duration-300 md:w-60 shrink-0 leading-tight hover:underline"
                >
                  {service.title}
                </Link>
              </div>
              {/* Description */}
              <p className="text-muted-foreground leading-[1.75] font-light text-sm md:text-[15px] flex-1 pl-[3.25rem] md:pl-0">
                {service.description}
              </p>
              {/* Schedule Consultation Button — hidden on mobile, visible on md+ */}
              <div className="hidden md:block shrink-0">
                <Link
                  href="/intake"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-xs font-semibold uppercase tracking-[0.12em] hover:bg-accent/90 transition-all duration-300 shadow-sm hover:shadow-md whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackBookConsultationClick(`home_services_preview_${service.title.toLowerCase().replace(/\s+/g, '_')}`);
                    trackCTAClick('Schedule Consultation', `home_services_preview_${service.title.toLowerCase().replace(/\s+/g, '_')}`, '/intake');
                  }}
                >
                  Schedule Consultation
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — includes mobile-friendly "Schedule" button */}
        <div className="scroll-reveal-hidden mt-10 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/services"
            onClick={() => {
              trackViewAllServicesClick('home_services_preview');
              trackViewServicesClick('home_services_preview');
            }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/15 hover:shadow-primary/25 hover:gap-4"
          >
            View All Services
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          {/* Mobile-only schedule CTA */}
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