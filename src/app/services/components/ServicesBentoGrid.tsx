'use client';

import React, { useEffect, useRef } from 'react';
import { trackServiceImpression, trackServiceCardHover, trackServiceCardClick, trackServiceCardFunnelClick } from '@/lib/analytics';

/* BENTO AUDIT
   Array has 6 cards: [Litigation Support, Contract Review, Legal Research, Document Drafting, Case Management, Deposition Prep]

   3-col grid:
   Row 1: [col-1,2: Litigation Support cs-2 rs-1] [col-3: Contract Review cs-1 rs-2]
   Row 2: [col-1: Legal Research cs-1 rs-1]       [col-2: Document Drafting cs-1 rs-1] [col-3: FILLED by Contract Review row-span]
   Row 3: [col-1,2: Case Management cs-2 rs-1]    [col-3: Deposition Prep cs-1 rs-1]

   Placed 6/6 ✓
*/

const services = [
  {
    id: '01',
    title: 'Litigation Support',
    description: 'End-to-end trial preparation including exhibit organization, binder assembly, deposition summaries, and deadline tracking. I integrate seamlessly into your litigation team to keep every moving part on schedule.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    colSpan: 'md:col-span-2',
    featured: true,
  },
  {
    id: '02',
    title: 'Contract Review',
    description: 'Detailed review of agreements, NDAs, and commercial contracts. I identify risk clauses, missing provisions, and ambiguous language, delivering annotated documents with a concise risk summary.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    colSpan: 'md:col-span-1',
    rowSpan: 'md:row-span-2',
    featured: false,
  },
  {
    id: '03',
    title: 'Legal Research',
    description: 'Targeted statutory, regulatory, and case law research with clear memoranda and citations.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
  },
  {
    id: '04',
    title: 'Document Drafting',
    description: "Precise drafting of pleadings, motions, and correspondence to your firm's standards.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
  },
  {
    id: '05',title: 'Case Management',description: 'Comprehensive case file organization, deadline calendaring, and status tracking to keep your practice running smoothly across multiple concurrent matters.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/>
      </svg>
    ),
    colSpan: 'md:col-span-2',
    featured: false,
  },
  {
    id: '06',title: 'Deposition Prep',description: 'Witness preparation materials, deposition outlines, and post-deposition summaries for efficient discovery.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
  },
];

export default function ServicesBentoGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackedRef = useRef<Set<string>>(new Set());

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

    // Track service card impressions
    const cardElements = sectionRef.current?.querySelectorAll('[data-service-title]');
    if (cardElements) {
      const impressionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const title = (entry.target as HTMLElement).dataset.serviceTitle;
              if (title && !trackedRef.current.has(title)) {
                trackedRef.current.add(title);
                trackServiceImpression(title, 'services_bento_grid');
              }
            }
          });
        },
        { threshold: 0.3 }
      );
      cardElements.forEach((el) => impressionObserver.observe(el));
      return () => {
        observer.disconnect();
        impressionObserver.disconnect();
      };
    }

    return () => observer.disconnect();
  }, []);

  const handleCardClick = (serviceTitle: string) => {
    trackServiceCardClick(serviceTitle, 'services_bento_grid');
    trackServiceCardFunnelClick(serviceTitle);
  };

  return (
    <section ref={sectionRef} className="py-16 md:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="scroll-reveal-hidden mb-10 md:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-accent" />
            Core Expertise
          </p>
          <h2 className="text-section-heading text-foreground max-w-xl">
            Specialized support
            <br />
            <span className="italic opacity-80">across every stage</span>
          </h2>
        </div>

        {/* BENTO GRID — single col on mobile, 3-col on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {/* Card 01 — Litigation Support — col-span-2 */}
          <div
            data-service-title={services[0].title}
            className={`scroll-reveal-hidden service-card-hover ${services[0].colSpan} bg-primary text-primary-foreground card-rounded p-8 md:p-10 flex flex-col gap-6 min-h-[260px] cursor-pointer`}
            onMouseEnter={() => trackServiceCardHover(services[0].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[0].title)}
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                {services[0].icon}
              </div>
              <span className="font-serif text-5xl text-primary-foreground/15 leading-none">{services[0].id}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-2xl md:text-3xl text-primary-foreground mb-3">{services[0].title}</h3>
              <p className="text-primary-foreground/65 leading-relaxed text-sm md:text-base font-light">{services[0].description}</p>
            </div>
          </div>

          {/* Card 02 — Contract Review — col-span-1, row-span-2 */}
          <div
            data-service-title={services[1].title}
            className={`scroll-reveal-hidden service-card-hover ${services[1].colSpan} ${services[1].rowSpan} bg-secondary border border-border card-rounded p-8 flex flex-col gap-5 cursor-pointer`}
            style={{ transitionDelay: '0.1s' }}
            onMouseEnter={() => trackServiceCardHover(services[1].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[1].title)}
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center text-accent">
              {services[1].icon}
            </div>
            <div className="flex-1 flex flex-col">
              <span className="font-serif text-4xl text-foreground/10 leading-none mb-2">{services[1].id}</span>
              <h3 className="font-serif text-2xl text-foreground mb-4">{services[1].title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm font-light flex-1">{services[1].description}</p>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-accent font-semibold">Risk-focused review</p>
            </div>
          </div>

          {/* Card 03 — Legal Research — col-span-1 */}
          <div
            data-service-title={services[2].title}
            className={`scroll-reveal-hidden service-card-hover ${services[2].colSpan} bg-secondary border border-border card-rounded p-8 flex flex-col gap-4 min-h-[220px] cursor-pointer`}
            style={{ transitionDelay: '0.15s' }}
            onMouseEnter={() => trackServiceCardHover(services[2].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[2].title)}
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                {services[2].icon}
              </div>
              <span className="font-serif text-4xl text-foreground/10 leading-none">{services[2].id}</span>
            </div>
            <h3 className="font-serif text-xl text-foreground">{services[2].title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed font-light flex-1">{services[2].description}</p>
          </div>

          {/* Card 04 — Document Drafting — col-span-1 */}
          <div
            data-service-title={services[3].title}
            className={`scroll-reveal-hidden service-card-hover ${services[3].colSpan} bg-secondary border border-border card-rounded p-8 flex flex-col gap-4 min-h-[220px] cursor-pointer`}
            style={{ transitionDelay: '0.2s' }}
            onMouseEnter={() => trackServiceCardHover(services[3].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[3].title)}
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                {services[3].icon}
              </div>
              <span className="font-serif text-4xl text-foreground/10 leading-none">{services[3].id}</span>
            </div>
            <h3 className="font-serif text-xl text-foreground">{services[3].title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed font-light flex-1">{services[3].description}</p>
          </div>

          {/* Card 05 — Case Management — col-span-2 */}
          <div
            data-service-title={services[4].title}
            className={`scroll-reveal-hidden service-card-hover ${services[4].colSpan} bg-secondary border border-border card-rounded p-8 flex flex-col gap-4 min-h-[220px] cursor-pointer`}
            style={{ transitionDelay: '0.25s' }}
            onMouseEnter={() => trackServiceCardHover(services[4].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[4].title)}
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center text-accent">
                {services[4].icon}
              </div>
              <span className="font-serif text-5xl text-foreground/10 leading-none">{services[4].id}</span>
            </div>
            <h3 className="font-serif text-2xl text-foreground">{services[4].title}</h3>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed font-light">{services[4].description}</p>
          </div>

          {/* Card 06 — Deposition Prep — col-span-1 */}
          <div
            data-service-title={services[5].title}
            className={`scroll-reveal-hidden service-card-hover ${services[5].colSpan} bg-accent/10 border border-accent/20 card-rounded p-8 flex flex-col gap-4 min-h-[220px] cursor-pointer`}
            style={{ transitionDelay: '0.3s' }}
            onMouseEnter={() => trackServiceCardHover(services[5].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[5].title)}
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                {services[5].icon}
              </div>
              <span className="font-serif text-4xl text-accent/20 leading-none">{services[5].id}</span>
            </div>
            <h3 className="font-serif text-xl text-foreground">{services[5].title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed font-light flex-1">{services[5].description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}