'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackServiceImpression, trackServiceCardHover, trackServiceCardClick, trackServiceCardFunnelClick } from '@/lib/analytics';

const services = [
  {
    id: '01',
    title: 'Litigation Support',
    description:
      'End-to-end trial preparation including exhibit organization, binder assembly, deposition summaries, and deadline tracking. I integrate seamlessly into your litigation team to keep every moving part on schedule.',
    tags: ['Trial Prep', 'Exhibits', 'Deadlines'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    colSpan: 'md:col-span-2',
    featured: true,
    dark: true,
  },
  {
    id: '02',
    title: 'Contract Review',
    description:
      'Detailed review of agreements, NDAs, and commercial contracts. I identify risk clauses, missing provisions, and ambiguous language, delivering annotated documents with a concise risk summary.',
    tags: ['NDAs', 'Risk Analysis', 'Annotations'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    rowSpan: 'md:row-span-2',
    featured: false,
    dark: false,
  },
  {
    id: '03',
    title: 'Legal Research',
    description:
      'Targeted statutory, regulatory, and case law research with clear memoranda and citations. Delivered with analysis, not just raw results.',
    tags: ['Case Law', 'Memos', 'Statutes'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '04',
    title: 'Document Drafting',
    description:
      "Precise drafting of pleadings, motions, briefs, and correspondence to your firm's standards and jurisdiction.",
    tags: ['Pleadings', 'Motions', 'Briefs'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '05',
    title: 'Case Management',
    description:
      'Comprehensive case file organization, deadline calendaring, and status tracking to keep your practice running smoothly across multiple concurrent matters.',
    tags: ['Calendaring', 'File Org', 'Status Tracking'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
    colSpan: 'md:col-span-2',
    featured: false,
    dark: false,
  },
  {
    id: '06',
    title: 'Deposition Prep',
    description:
      'Witness preparation materials, deposition outlines, and post-deposition summaries for efficient discovery.',
    tags: ['Outlines', 'Summaries', 'Discovery'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '07',
    title: 'Discovery Assistance',
    description:
      'Document review, privilege log preparation, Bates stamping, and discovery management for complex cases. Organized, thorough, and deadline-driven.',
    tags: ['Doc Review', 'Privilege Logs', 'Bates Stamping'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '08',
    title: 'Client Intake & Onboarding',
    description:
      'Streamlined intake questionnaires, conflict checks, engagement letter preparation, and client onboarding workflows so your firm starts every matter on solid footing.',
    tags: ['Intake Forms', 'Conflict Checks', 'Engagement Letters'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
    ),
    colSpan: 'md:col-span-2',
    featured: false,
    dark: true,
  },
  {
    id: '09',
    title: 'Regulatory & Compliance Research',
    description:
      'In-depth research on federal and state regulations, agency guidance, and compliance requirements. Ideal for transactional, healthcare, and environmental matters.',
    tags: ['Federal Regs', 'State Law', 'Agency Guidance'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '10',
    title: 'Court Filing & Docketing',
    description:
      'Preparation and coordination of court filings, e-filing support, docket monitoring, and deadline management across state and federal courts.',
    tags: ['E-Filing', 'Docketing', 'Court Deadlines'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '11',
    title: 'Settlement & Demand Letters',
    description:
      'Drafting of demand letters, settlement agreements, and release documents. Persuasive, precise, and tailored to your client\'s position.',
    tags: ['Demand Letters', 'Settlements', 'Releases'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
  },
  {
    id: '12',
    title: 'Estate & Probate Support',
    description:
      'Preparation of wills, trusts, powers of attorney, probate petitions, and estate administration documents. Meticulous attention to state-specific requirements.',
    tags: ['Wills & Trusts', 'Probate', 'POA'],
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    colSpan: 'md:col-span-1',
    featured: false,
    dark: false,
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
      { threshold: 0.06 }
    );
    elements.forEach((el) => observer.observe(el));

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
        {/* Section header */}
        <div className="scroll-reveal-hidden mb-10 md:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-accent" />
            Core Expertise
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <h2 className="text-section-heading text-foreground max-w-xl">
              Specialized support
              <br />
              <span className="italic opacity-80">across every stage</span>
            </h2>
            <p className="text-muted-foreground text-sm md:text-base font-light max-w-xs leading-relaxed md:text-right">
              12 distinct service areas. One trusted paralegal partner.
            </p>
          </div>
        </div>

        {/* BENTO GRID — rows 1–3 (first 6 services) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-5">
          {/* Card 01 — Litigation Support — col-span-2 dark */}
          <ServiceCard
            service={services[0]}
            delay={0}
            onHover={() => trackServiceCardHover(services[0].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[0].title)}
          />
          {/* Card 02 — Contract Review — col-span-1 row-span-2 */}
          <ServiceCard
            service={services[1]}
            delay={0.08}
            onHover={() => trackServiceCardHover(services[1].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[1].title)}
          />
          {/* Card 03 — Legal Research */}
          <ServiceCard
            service={services[2]}
            delay={0.12}
            onHover={() => trackServiceCardHover(services[2].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[2].title)}
          />
          {/* Card 04 — Document Drafting */}
          <ServiceCard
            service={services[3]}
            delay={0.16}
            onHover={() => trackServiceCardHover(services[3].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[3].title)}
          />
          {/* Card 05 — Case Management — col-span-2 */}
          <ServiceCard
            service={services[4]}
            delay={0.2}
            onHover={() => trackServiceCardHover(services[4].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[4].title)}
          />
          {/* Card 06 — Deposition Prep */}
          <ServiceCard
            service={services[5]}
            delay={0.24}
            onHover={() => trackServiceCardHover(services[5].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[5].title)}
          />
        </div>

        {/* BENTO GRID — rows 4–6 (services 7–12) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {/* Card 07 — Discovery Assistance */}
          <ServiceCard
            service={services[6]}
            delay={0.04}
            onHover={() => trackServiceCardHover(services[6].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[6].title)}
          />
          {/* Card 08 — Client Intake — col-span-2 dark */}
          <ServiceCard
            service={services[7]}
            delay={0.08}
            onHover={() => trackServiceCardHover(services[7].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[7].title)}
          />
          {/* Card 09 — Regulatory Research */}
          <ServiceCard
            service={services[8]}
            delay={0.12}
            onHover={() => trackServiceCardHover(services[8].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[8].title)}
          />
          {/* Card 10 — Court Filing */}
          <ServiceCard
            service={services[9]}
            delay={0.16}
            onHover={() => trackServiceCardHover(services[9].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[9].title)}
          />
          {/* Card 11 — Settlement Letters */}
          <ServiceCard
            service={services[10]}
            delay={0.2}
            onHover={() => trackServiceCardHover(services[10].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[10].title)}
          />
          {/* Card 12 — Estate & Probate */}
          <ServiceCard
            service={services[11]}
            delay={0.24}
            onHover={() => trackServiceCardHover(services[11].title, 'services_bento_grid')}
            onClick={() => handleCardClick(services[11].title)}
          />
        </div>

        {/* Bottom CTA strip */}
        <div className="scroll-reveal-hidden mt-12 md:mt-16 flex flex-col sm:flex-row items-center justify-between gap-5 bg-secondary border border-border card-rounded px-8 py-7">
          <div>
            <p className="font-serif text-xl text-foreground mb-1">Don't see your specific need?</p>
            <p className="text-muted-foreground text-sm font-light">
              Reach out — most requests can be accommodated with a custom scope.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all duration-300"
          >
            Get in Touch
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  icon: React.ReactNode;
  colSpan?: string;
  rowSpan?: string;
  featured?: boolean;
  dark?: boolean;
}

function ServiceCard({
  service,
  delay,
  onHover,
  onClick,
}: {
  service: ServiceItem;
  delay: number;
  onHover: () => void;
  onClick: () => void;
}) {
  const isDark = service.dark;
  const isWide = service.colSpan === 'md:col-span-2';
  const isRowSpan = service.rowSpan === 'md:row-span-2';

  return (
    <div
      data-service-title={service.title}
      className={`scroll-reveal-hidden service-card-hover ${service.colSpan ?? ''} ${service.rowSpan ?? ''} ${
        isDark
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary border border-border text-foreground'
      } card-rounded p-7 md:p-9 flex flex-col gap-5 cursor-pointer ${
        isWide ? 'min-h-[240px]' : isRowSpan ? 'min-h-[360px]' : 'min-h-[220px]'
      }`}
      style={{ transitionDelay: `${delay}s` }}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      {/* Icon + number row */}
      <div className="flex items-start justify-between">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isDark ? 'bg-accent/20 text-accent' : 'bg-accent/15 text-accent'
          }`}
        >
          {service.icon}
        </div>
        <span
          className={`font-serif text-4xl leading-none select-none ${
            isDark ? 'text-primary-foreground/12' : 'text-foreground/10'
          }`}
        >
          {service.id}
        </span>
      </div>

      {/* Title + description */}
      <div className="flex-1 flex flex-col gap-2">
        <h3
          className={`font-serif ${isWide ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} ${
            isDark ? 'text-primary-foreground' : 'text-foreground'
          }`}
        >
          {service.title}
        </h3>
        <p
          className={`text-sm leading-relaxed font-light flex-1 ${
            isDark ? 'text-primary-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {service.description}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 pt-2">
        {service.tags.map((tag) => (
          <span
            key={tag}
            className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${
              isDark
                ? 'bg-primary-foreground/10 text-primary-foreground/80'
                : 'bg-accent/10 text-accent'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
