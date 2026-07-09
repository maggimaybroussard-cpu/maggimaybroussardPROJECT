'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface CaseStudy {
  id: string;
  title: string;
  client: string;
  service_tag: string;
  complexity: string;
  duration: string;
  outcome: string;
  summary: string;
  published: boolean;
  sort_order: number;
}

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string }> = {
  Standard: { bg: '#e8f5e9', text: '#2d5a35' },
  Complex: { bg: '#fff8e1', text: '#8B7355' },
  'High-Stakes': { bg: '#fef3e2', text: '#C8965A' },
};

const OUTCOME_ICON: Record<string, string> = {
  'Favorable Settlement': '⚖️',
  'Motion Granted': '✅',
  'Series B Closed On Schedule': '🏆',
  'Estate Closed 6 Weeks Early': '📋',
};

const STATIC_FALLBACK: CaseStudy[] = [
  {
    id: '01',
    title: 'Civil Litigation Trial Prep Support',
    client: 'Solo Litigation Attorney',
    service_tag: 'Litigation Support',
    complexity: 'Complex',
    duration: '3 weeks',
    outcome: 'Favorable Settlement',
    summary:
      'A solo litigator needed help organizing case files and preparing deposition summaries ahead of a civil dispute. Delivered an indexed exhibit set, 4 deposition summaries, and a trial binder 48 hours before the hearing.',
    published: true,
    sort_order: 1,
  },
  {
    id: '02',
    title: 'Vendor Contract Review — Small Business',
    client: 'In-House Counsel — Growing Startup',
    service_tag: 'Contract Review',
    complexity: 'Standard',
    duration: '1 week',
    outcome: 'Matter Resolved',
    summary:
      'Reviewed 6 vendor agreements for a small business ahead of a financing round. Identified 3 risk issues, flagged renewal traps, and delivered a plain-language summary for the client\'s review.',
    published: true,
    sort_order: 2,
  },
  {
    id: '03',
    title: 'Custody Modification Research & Motion Support',
    client: 'Solo Family Law Practitioner',
    service_tag: 'Legal Research',
    complexity: 'Standard',
    duration: '5 business days',
    outcome: 'Motion Granted',
    summary:
      'Delivered a research memo with annotated appellate decisions and a ready-to-file argument outline in 5 business days. Motion granted at the initial hearing.',
    published: true,
    sort_order: 3,
  },
];

interface Props {
  limit?: number;
  heading?: string;
  subheading?: string;
}

export default function CaseStudiesSocialProof({
  limit = 3,
  heading = 'Real Results for Real Firms',
  subheading = 'Case outcomes from matters handled across practice areas and firm sizes.',
}: Props) {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('case_studies')
      .select('id,title,client,service_tag,complexity,duration,outcome,summary,published,sort_order')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .limit(limit)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setStudies(data as CaseStudy[]);
        } else {
          setStudies(STATIC_FALLBACK.slice(0, limit));
        }
        setLoaded(true);
      });
  }, [limit]);

  const displayStudies = loaded ? studies : STATIC_FALLBACK.slice(0, limit);

  return (
    <section className="py-16 md:py-24 bg-background" aria-label="Case study results">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            Case Results
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">{heading}</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">{subheading}</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayStudies.map((study) => {
            const complexity = COMPLEXITY_COLORS[study.complexity] ?? COMPLEXITY_COLORS['Standard'];
            const outcomeIcon = OUTCOME_ICON[study.outcome] ?? '✅';
            return (
              <div
                key={study.id}
                className="flex flex-col bg-card border border-border/70 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Top badges */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: complexity.bg, color: complexity.text }}
                  >
                    {study.complexity}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">
                    {study.service_tag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-serif text-base md:text-lg text-foreground leading-snug mb-2">
                  {study.title}
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3 uppercase tracking-wide">
                  {study.client}
                </p>

                {/* Summary */}
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  {study.summary.length > 160 ? study.summary.slice(0, 157) + '…' : study.summary}
                </p>

                {/* Outcome + Duration */}
                <div className="border-t border-border/50 pt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{outcomeIcon}</span>
                    <span className="text-xs font-semibold text-foreground">{study.outcome}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {study.duration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline underline-offset-4 transition-colors"
          >
            View all case studies
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
