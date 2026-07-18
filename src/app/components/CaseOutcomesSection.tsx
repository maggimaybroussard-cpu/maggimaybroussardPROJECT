'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OutcomeRow {
  outcome: string;
  case_type: string;
  settlement_amount: number | null;
  marketing_highlight: boolean;
  expertise_tags: string[];
}

interface CaseTypeStat {
  caseType: string;
  total: number;
  favorable: number;
  successRate: number;
  avgSettlement: number | null;
  topOutcome: string;
}

const FAVORABLE = new Set(['won', 'settled', 'favorable_judgment', 'dismissed']);

const OUTCOME_LABELS: Record<string, string> = {
  won: 'Won',
  settled: 'Settled',
  favorable_judgment: 'Favorable Judgment',
  dismissed: 'Dismissed',
  lost: 'Lost',
  withdrawn: 'Withdrawn',
  pending_close: 'Pending Close',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

function computeStats(rows: OutcomeRow[]): CaseTypeStat[] {
  const map: Record<string, { total: number; favorable: number; settlements: number[]; outcomes: Record<string, number> }> = {};

  for (const row of rows) {
    if (!map[row.case_type]) {
      map[row.case_type] = { total: 0, favorable: 0, settlements: [], outcomes: {} };
    }
    const entry = map[row.case_type];
    entry.total++;
    if (FAVORABLE.has(row.outcome)) entry.favorable++;
    if (row.settlement_amount) entry.settlements.push(row.settlement_amount);
    entry.outcomes[row.outcome] = (entry.outcomes[row.outcome] || 0) + 1;
  }

  return Object.entries(map)
    .map(([caseType, data]) => {
      const topOutcome = Object.entries(data.outcomes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'won';
      const avgSettlement = data.settlements.length
        ? data.settlements.reduce((a, b) => a + b, 0) / data.settlements.length
        : null;
      return {
        caseType,
        total: data.total,
        favorable: data.favorable,
        successRate: Math.round((data.favorable / data.total) * 100),
        avgSettlement,
        topOutcome: OUTCOME_LABELS[topOutcome] ?? topOutcome,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

const VALUE_PILLARS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
      </svg>
    ),
    title: 'Meticulous Preparation',
    desc: 'Every filing, deadline, and document handled with precision — nothing falls through the cracks.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Deep Legal Knowledge',
    desc: 'Substantive paralegal expertise across litigation, contracts, real estate, family law, and more.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Attorney-First Partnership',
    desc: 'I work as an extension of your team — responsive, discreet, and aligned with your firm\'s standards.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Deadline-Driven',
    desc: 'Court deadlines, filing windows, and client deliverables tracked and met — every time.',
  },
];

export default function CaseOutcomesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [stats, setStats] = useState<CaseTypeStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('matter_outcomes')
      .select('outcome, case_type, settlement_amount, marketing_highlight, expertise_tags')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const rows = data as OutcomeRow[];
          const computed = computeStats(rows);
          if (computed.length > 0) setStats(computed);
        }
        setLoaded(true);
      });
  }, []);

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
  }, [loaded]);

  return (
    <section
      ref={sectionRef}
      id="case-outcomes"
      aria-label="Why work with Maggi May Broussard"
      className="py-20 md:py-32 bg-primary overflow-hidden relative"
    >
      {/* Subtle texture layer */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      <div className="max-w-7xl mx-auto px-5 md:px-10 relative z-10">

        {/* Header */}
        <div className="scroll-reveal-hidden text-center mb-14 md:mb-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 md:mb-5 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            What Sets Me Apart
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="text-section-heading text-primary-foreground mb-5">
            Built on
            <br />
            <span className="italic" style={{ opacity: 0.75 }}>quality, not quantity</span>
          </h2>
          <p className="text-primary-foreground/60 max-w-xl mx-auto text-sm md:text-base leading-relaxed font-light">
            A boutique paralegal practice focused on delivering exceptional work for every client — meticulous preparation, deep legal knowledge, and unwavering professionalism.
          </p>
        </div>

        {/* Value Pillars */}
        <div className="scroll-reveal-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 md:gap-6 mb-14 md:mb-20">
          {VALUE_PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-6 md:p-7 flex flex-col gap-4"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                {pillar.icon}
              </div>
              <div>
                <h3 className="text-primary-foreground font-semibold text-sm mb-2 leading-snug">{pillar.title}</h3>
                <p className="text-primary-foreground/50 text-[13px] leading-relaxed">{pillar.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Live stats from DB — only shown when real data exists */}
        {stats.length > 0 && (
          <>
            <div className="scroll-reveal-hidden mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 mb-6 flex items-center gap-3">
                <span className="w-6 h-px bg-accent/50" />
                Practice Area Breakdown
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
              {stats[0] && (
                <div
                  className="scroll-reveal-hidden md:col-span-5 bg-accent/10 border border-accent/20 rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[260px]"
                  style={{ transitionDelay: '0.05s' }}
                >
                  <div>
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.3em] text-accent/70 bg-accent/10 px-3 py-1 rounded-full mb-4">
                      Top Practice Area
                    </span>
                    <h3 className="font-serif text-2xl md:text-3xl text-primary-foreground mb-2 leading-tight">
                      {stats[0].caseType}
                    </h3>
                    <p className="text-primary-foreground/50 text-sm">
                      {stats[0].total} matters closed · Most common: {stats[0].topOutcome}
                    </p>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-end gap-3 mb-3">
                      <span className="stat-number text-accent">{stats[0].successRate}%</span>
                      <span className="text-primary-foreground/60 text-sm mb-2">favorable outcomes</span>
                    </div>
                    <div className="w-full h-2 bg-primary-foreground/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-1000"
                        style={{ width: `${stats[0].successRate}%` }}
                      />
                    </div>
                    {stats[0].avgSettlement && (
                      <p className="text-primary-foreground/40 text-xs mt-3">
                        Avg. settlement: {formatCurrency(stats[0].avgSettlement)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                {stats.slice(1).map((stat, i) => (
                  <div
                    key={stat.caseType}
                    className="scroll-reveal-hidden bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-6 flex flex-col justify-between"
                    style={{ transitionDelay: `${(i + 1) * 0.08}s` }}
                  >
                    <div>
                      <h3 className="text-primary-foreground font-semibold text-sm md:text-base mb-1 leading-snug">
                        {stat.caseType}
                      </h3>
                      <p className="text-primary-foreground/40 text-[11px]">
                        {stat.total} matters · {stat.topOutcome}
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-accent font-serif text-xl font-semibold">{stat.successRate}%</span>
                        {stat.avgSettlement && (
                          <span className="text-primary-foreground/40 text-[11px]">
                            {formatCurrency(stat.avgSettlement)} avg
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent/70 rounded-full"
                          style={{ width: `${stat.successRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="scroll-reveal-hidden mt-10 md:mt-14 flex flex-wrap gap-3 justify-center" style={{ transitionDelay: '0.3s' }}>
              {(['Won', 'Settled', 'Favorable Judgment', 'Dismissed'] as const).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-primary-foreground/50 bg-primary-foreground/5 border border-primary-foreground/10 px-4 py-2 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/70 flex-shrink-0" />
                  {label}
                </span>
              ))}
            </div>

            <p className="text-center text-primary-foreground/25 text-[10px] mt-8 max-w-lg mx-auto leading-relaxed">
              Past results do not guarantee future outcomes. Each matter is unique and results depend on the specific facts and legal issues involved.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
