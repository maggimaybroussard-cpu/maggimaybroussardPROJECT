'use client';

import React, { useEffect, useRef, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

interface TimelineEvent {
  phase: string;
  before: string;
  after: string;
}

interface CaseStudy {
  id: string;
  title: string;
  client: string;
  serviceTag: string;
  complexity: 'Standard' | 'Complex' | 'High-Stakes';
  complexityColor: string;
  duration: string;
  outcome: string;
  outcomeColor: string;
  summary: string;
  timeline: TimelineEvent[];
  clientImpact: { icon: string; headline: string; detail: string }[];
  metrics: { label: string; before: string; after: string }[];
}

const caseStudies: CaseStudy[] = [
  {
    id: '01',
    title: 'Civil Litigation Trial Prep Support',
    client: 'Solo Litigation Attorney',
    serviceTag: 'Litigation Support',
    complexity: 'Complex',
    complexityColor: '#8B7355',
    duration: '3 weeks',
    outcome: 'Favorable Settlement',
    outcomeColor: '#7A9E7E',
    summary:
      'A solo litigator needed help organizing case files and preparing for a civil dispute hearing. Their internal capacity was stretched and key deadlines were approaching.',
    timeline: [
      {
        phase: 'Document Organization',
        before: 'Case files scattered across email and a shared drive with no consistent naming or indexing.',
        after: 'Organized exhibit set with consistent numbering, a master document log, and a simple cross-reference index.',
      },
      {
        phase: 'Deposition Readiness',
        before: 'No deposition summaries prepared. Attorney reviewing raw transcripts the night before.',
        after: '4 concise deposition summaries delivered — key admissions flagged and impeachment points noted.',
      },
      {
        phase: 'Trial Binder',
        before: 'No binder assembled. Exhibits existed only as loose digital files.',
        after: 'Tabbed, paginated trial binder assembled and delivered 48 hours before the hearing.',
      },
    ],
    clientImpact: [
      {
        icon: 'clock',
        headline: 'Deadlines met',
        detail: 'A simple deadline tracker kept all filings and submissions on schedule throughout the engagement.',
      },
      {
        icon: 'scale',
        headline: 'Favorable settlement reached',
        detail: 'The matter settled before trial, with the attorney citing strong preparation as a contributing factor.',
      },
      {
        icon: 'shield',
        headline: 'Attorney bandwidth protected',
        detail: 'By handling document organization and binder assembly, the attorney could focus on strategy and client communication.',
      },
      {
        icon: 'check',
        headline: '4 deposition summaries delivered',
        detail: 'Each summary flagged key admissions and impeachment opportunities, reducing attorney prep time per deposition.',
      },
    ],
    metrics: [
      { label: 'Documents Organized', before: 'Unindexed', after: 'Fully indexed' },
      { label: 'Deposition Summaries', before: 'None prepared', after: '4 delivered' },
      { label: 'Trial Binder', before: 'Not assembled', after: 'Complete binder' },
      { label: 'Matter Result', before: 'Uncertain', after: 'Favorable settlement' },
    ],
  },
  {
    id: '02',
    title: 'Vendor Contract Review — Small Business',
    client: 'In-House Counsel — Growing Startup',
    serviceTag: 'Contract Review',
    complexity: 'Standard',
    complexityColor: '#7A9E7E',
    duration: '1 week',
    outcome: 'Matter Resolved',
    outcomeColor: '#7A9E7E',
    summary:
      'A small business needed a review of vendor agreements before a financing round. The in-house counsel had limited bandwidth and needed a clear risk summary for the ownership team.',
    timeline: [
      {
        phase: 'Contract Review',
        before: 'Agreements stored across email threads with no centralized inventory or review notes.',
        after: 'All 6 agreements reviewed against a risk checklist. 3 flagged with material issues and annotated.',
      },
      {
        phase: 'Risk Summary',
        before: 'No executive summary. Ownership had no visibility into contract risk.',
        after: 'Plain-language risk summary delivered — renewal traps, liability clauses, and key dates highlighted.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Financing round proceeded on schedule',
        detail: 'The contract review was completed before the financing deadline with no delays.',
      },
      {
        icon: 'shield',
        headline: '3 risk issues identified',
        detail: 'Auto-renewal traps and an uncapped liability clause were flagged before they became a problem.',
      },
      {
        icon: 'clock',
        headline: 'In-house counsel time freed',
        detail: 'The in-house counsel redirected their time to the financing process rather than contract review.',
      },
    ],
    metrics: [
      { label: 'Contracts Reviewed', before: 'Unreviewed', after: '6 reviewed' },
      { label: 'Risk Issues Identified', before: 'Unknown', after: '3 flagged' },
      { label: 'Turnaround', before: 'Needed urgently', after: 'Delivered in 1 week' },
      { label: 'Financing Delay', before: 'At risk', after: 'None' },
    ],
  },
  {
    id: '03',
    title: 'Custody Modification Research & Motion Support',
    client: 'Solo Family Law Practitioner',
    serviceTag: 'Legal Research',
    complexity: 'Standard',
    complexityColor: '#7A9E7E',
    duration: '5 business days',
    outcome: 'Motion Granted',
    outcomeColor: '#7A9E7E',
    summary:
      'A solo family law attorney needed a research memo on the standard for modifying a custody order following a parent\'s relocation — with supporting case law and a draft argument outline — within 5 business days.',
    timeline: [
      {
        phase: 'Research Scope',
        before: 'Attorney had only a general sense of the legal standard. No case law compiled. No argument framework.',
        after: 'Clear legal standard analysis grounded in Louisiana statutes and annotated appellate decisions.',
      },
      {
        phase: 'Memo Delivery',
        before: 'Attorney planned to research and draft the memo personally — estimated 10+ hours of work.',
        after: 'Research memo delivered in 5 business days, ready to use as the foundation for the motion.',
      },
      {
        phase: 'Motion Filing',
        before: 'No argument outline. Attorney would need to structure the motion from scratch after completing research.',
        after: 'Ready-to-use argument outline included — attorney filed the motion directly from the provided framework.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Motion granted at initial hearing',
        detail: 'The court granted the custody modification at the first hearing.',
      },
      {
        icon: 'clock',
        headline: 'Attorney hours saved',
        detail: 'The attorney estimated the research and drafting would have taken 10+ hours personally.',
      },
      {
        icon: 'scale',
        headline: 'Client outcome secured',
        detail: 'The relocating parent received the custody modification they sought.',
      },
      {
        icon: 'shield',
        headline: 'Argument outline included',
        detail: 'A ready-to-use argument outline was delivered alongside the memo — the attorney filed the motion directly from the provided framework.',
      },
    ],
    metrics: [
      { label: 'Research Memo', before: 'Not started', after: 'Delivered in 5 days' },
      { label: 'Case Citations', before: '0 compiled', after: 'Annotated set' },
      { label: 'Turnaround', before: '10+ hrs estimated', after: '5 business days' },
      { label: 'Motion Result', before: 'Uncertain', after: 'Granted' },
    ],
  },
  {
    id: '04',
    title: 'Probate Administration Document Support',
    client: 'Boutique Estate Planning Firm',
    serviceTag: 'Estate Administration',
    complexity: 'Standard',
    complexityColor: '#7A9E7E',
    duration: '3 weeks',
    outcome: 'Estate Closed On Schedule',
    outcomeColor: '#7A9E7E',
    summary:
      'A small estate planning firm needed help catching up on a probate matter with a backlog of unfiled documents and inconsistent beneficiary communications.',
    timeline: [
      {
        phase: 'File Organization',
        before: 'Case notes incomplete and stored across multiple locations with no clear status summary.',
        after: 'Organized case file with a status memo giving attorneys a clear picture of where the matter stood.',
      },
      {
        phase: 'Court Filing Backlog',
        before: 'Several required court filings overdue with upcoming deadlines not yet tracked.',
        after: 'Overdue filings completed and a rolling court deadline calendar created for the team.',
      },
      {
        phase: 'Beneficiary Communication',
        before: 'No standardized communication process. Beneficiaries receiving inconsistent updates.',
        after: 'Templated beneficiary update letters drafted and a distribution schedule established.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Estate closed on schedule',
        detail: 'Clearing the filing backlog and establishing a deadline calendar kept the administration on track.',
      },
      {
        icon: 'shield',
        headline: 'No sanctions or court reprimands',
        detail: 'All overdue filings were submitted before any court action was taken.',
      },
      {
        icon: 'clock',
        headline: 'Beneficiary communication improved',
        detail: 'Consistent, professional updates reduced inbound calls and emails to the firm.',
      },
      {
        icon: 'check',
        headline: 'Ongoing deadline system established',
        detail: 'A shared court deadline calendar created during the engagement continues to be used by the firm.',
      },
    ],
    metrics: [
      { label: 'Overdue Filings', before: 'Outstanding', after: 'All completed' },
      { label: 'Case File Status', before: 'Disorganized', after: 'Fully organized' },
      { label: 'Beneficiary Updates', before: 'Inconsistent', after: 'Templated & scheduled' },
      { label: 'Administration Timeline', before: 'At risk', after: 'Closed on schedule' },
    ],
  },
];

const complexityOrder = ['Standard', 'Complex', 'High-Stakes'] as const;

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function ScaleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M3 9l9-6 9 6M5 20h14" /><path d="M5 9l-2 6h4L5 9zM19 9l-2 6h4l-2-6z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const iconMap: Record<string, React.ReactNode> = {
  clock: <ClockIcon />,
  scale: <ScaleIcon />,
  shield: <ShieldIcon />,
  check: <CheckIcon />,
};

export default function CaseStudiesPage() {
  const [expandedId, setExpandedId] = useState<string | null>('01');
  const sectionRef = useRef<HTMLDivElement>(null);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Case Studies',
            description: 'Anonymized paralegal case studies with before/after timelines, complexity levels, and client impact across litigation, contract review, and legal research.',
            url: `${baseUrl}/case-studies`,
            publisher: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              logo: { '@type': 'ImageObject', url: `${baseUrl}/assets/images/app_logo.png` },
            },
          }),
        }}
      />

      <Header />
      <main>
        {/* ── Hero ── */}
        <section id="case-studies-hero" aria-label="Case studies introduction and overview" className="relative min-h-[52vh] flex items-end overflow-hidden bg-primary">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(200,150,90,0.3) 60px, rgba(200,150,90,0.3) 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(200,150,90,0.3) 60px, rgba(200,150,90,0.3) 61px)'
            }} />
          </div>
          <div className="absolute top-1/4 right-10 md:right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-1/3 left-10 w-52 h-52 rounded-full bg-accent/8 blur-2xl" aria-hidden="true" />

          <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-10 pb-14 md:pb-20 pt-32 md:pt-44">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-accent" aria-hidden="true" />
              Anonymized Client Outcomes
            </p>
            <h1 className="text-hero-display text-primary-foreground max-w-3xl">
              Before &amp; after
              <br />
              <span className="italic opacity-70">case studies</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-primary-foreground/60 max-w-xl font-light leading-relaxed">
              Six real engagements — anonymized to protect client confidentiality — showing the challenge, the work, and the measurable outcome.
            </p>

            {/* Complexity legend */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="text-xs text-primary-foreground/40 uppercase tracking-widest mr-1">Complexity:</span>
              {complexityOrder.map((level) => {
                const cs = caseStudies.find((c) => c.complexity === level);
                return (
                  <span
                    key={level}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${cs?.complexityColor}22`, color: cs?.complexityColor }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs?.complexityColor }} aria-hidden="true" />
                    {level}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section id="case-studies-stats" aria-label="Key statistics from case studies" className="bg-accent py-7 md:py-8">
          <div className="max-w-7xl mx-auto px-5 md:px-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-0 md:divide-x divide-accent-foreground/20">
              {[
                { value: '6', label: 'Featured Case Studies' },
                { value: '100%', label: 'Anonymized & Confidential' },
                { value: 'Before → After', label: 'Timeline Format' },
                { value: 'Verified', label: 'Client Outcomes' },
              ].map((stat) => (
                <div key={stat.label} className="text-center md:px-8">
                  <p className="font-serif text-xl md:text-3xl text-accent-foreground">{stat.value}</p>
                  <p className="text-xs uppercase tracking-widest text-accent-foreground/70 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Case Studies Grid ── */}
        <section id="case-studies-list" aria-label="Detailed case study examples and outcomes" className="max-w-7xl mx-auto px-5 md:px-10 py-16 md:py-24">
          <div className="space-y-6 md:space-y-8">
            {caseStudies.map((cs, i) => (
              <article
                key={cs.id}
                className="scroll-reveal-hidden bg-card border border-border card-rounded-sm overflow-hidden"
                itemScope
                itemType="https://schema.org/CreativeWork"
              >
                {/* ── Card Header (always visible) ── */}
                <button
                  onClick={() => setExpandedId(expandedId === cs.id ? null : cs.id)}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-expanded={expandedId === cs.id}
                  aria-controls={`case-detail-${cs.id}`}
                >
                  <div className="p-5 md:p-10 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
                    {/* Number */}
                    <span
                      className="font-serif text-5xl md:text-7xl font-bold shrink-0 leading-none select-none"
                      style={{ color: cs.complexityColor, opacity: 0.2 }}
                      aria-hidden="true"
                    >
                      {cs.id}
                    </span>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      {/* Tags row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-secondary text-muted-foreground">
                          {cs.serviceTag}
                        </span>
                        {/* Complexity badge */}
                        <span
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                          style={{ backgroundColor: `${cs.complexityColor}18`, color: cs.complexityColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.complexityColor }} aria-hidden="true" />
                          {cs.complexity}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground">
                          {cs.duration}
                        </span>
                      </div>

                      <h2 className="text-card-heading text-foreground mb-1.5">{cs.title}</h2>
                      <p className="text-sm text-muted-foreground mb-3">{cs.client}</p>
                      <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-2xl">{cs.summary}</p>
                    </div>

                    {/* Outcome + chevron */}
                    <div className="flex items-center gap-3 shrink-0 md:pt-1">
                      <div
                        className="px-3 md:px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
                        style={{ backgroundColor: `${cs.outcomeColor}20`, color: cs.outcomeColor }}
                      >
                        {cs.outcome}
                      </div>
                      <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        className={`text-muted-foreground transition-transform duration-300 ${expandedId === cs.id ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* ── Expanded Detail ── */}
                {expandedId === cs.id && (
                  <div id={`case-detail-${cs.id}`} className="border-t border-border">

                    {/* Before / After Timeline */}
                    <div className="px-5 md:px-10 py-8 md:py-10 bg-secondary/20">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-6 flex items-center gap-2">
                        <span className="w-4 h-px bg-accent" aria-hidden="true" />
                        Before &amp; After Timeline
                      </p>

                      <div className="space-y-0">
                        {cs.timeline.map((event, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 md:gap-4 items-stretch">
                            {/* Before */}
                            <div className={`p-4 md:p-5 rounded-xl md:rounded-none ${idx === 0 ? 'md:rounded-tl-xl' : ''} ${idx === cs.timeline.length - 1 ? 'md:rounded-bl-xl' : ''} bg-red-50/60 border border-red-100 mb-2 md:mb-0`}>
                              {idx === 0 && (
                                <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-1.5">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                  Before
                                </p>
                              )}
                              <p className="text-xs font-semibold text-red-500/70 uppercase tracking-widest mb-1.5">{event.phase}</p>
                              <p className="text-sm text-foreground/70 leading-relaxed">{event.before}</p>
                            </div>

                            {/* Arrow */}
                            <div className="hidden md:flex items-center justify-center px-2">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0" aria-hidden="true">
                                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                              </svg>
                            </div>

                            {/* After */}
                            <div className={`p-4 md:p-5 rounded-xl md:rounded-none ${idx === 0 ? 'md:rounded-tr-xl' : ''} ${idx === cs.timeline.length - 1 ? 'md:rounded-br-xl' : ''} bg-green-50/60 border border-green-100 mb-4 md:mb-0`}>
                              {idx === 0 && (
                                <p className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3 flex items-center gap-1.5">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                                  After
                                </p>
                              )}
                              <p className="text-xs font-semibold text-green-600/70 uppercase tracking-widest mb-1.5">{event.phase}</p>
                              <p className="text-sm text-foreground/70 leading-relaxed">{event.after}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metrics: Before vs After */}
                    <div className="px-5 md:px-10 py-7 md:py-9 border-t border-border/60 bg-background">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-5 flex items-center gap-2">
                        <span className="w-4 h-px bg-accent" aria-hidden="true" />
                        Key Metrics
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {cs.metrics.map((m) => (
                          <div key={m.label} className="bg-secondary/50 rounded-xl p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{m.label}</p>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-red-400 line-through leading-snug">{m.before}</span>
                              <span className="text-sm font-semibold text-foreground leading-snug">{m.after}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Client Impact */}
                    <div className="px-5 md:px-10 py-7 md:py-9 border-t border-border/60 bg-secondary/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent mb-5 flex items-center gap-2">
                        <span className="w-4 h-px bg-accent" aria-hidden="true" />
                        Client Impact
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                        {cs.clientImpact.map((impact, idx) => (
                          <div key={idx} className="flex gap-3.5 p-4 bg-card border border-border rounded-xl">
                            <div
                              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                              style={{ backgroundColor: `${cs.complexityColor}18`, color: cs.complexityColor }}
                            >
                              {iconMap[impact.icon]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground mb-1">{impact.headline}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{impact.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ── Comparison Section ── */}
        <section id="case-studies-comparison" aria-label="Before and after comparison of paralegal impact" className="max-w-7xl mx-auto px-5 md:px-10 py-16 md:py-24 bg-secondary/30 rounded-2xl">
          <h2 className="font-serif text-3xl md:text-4xl text-primary mb-12 text-center">The Paralegal Difference: Before & After</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-6">Without Professional Paralegal Support</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Attorneys spending 15-20 hours/week on administrative tasks</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Missed filing deadlines and compliance issues</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Disorganized case files and document management</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Higher operational costs and reduced billable hours</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Client communication delays and follow-up gaps</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-6">With Broussard Legal Services</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Attorneys reclaim 15-20 hours/week for billable work</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>100% deadline compliance with automated tracking</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Centralized, searchable case file management</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Reduced overhead with remote, scalable support</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Proactive client communication and status updates</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="case-studies-cta" aria-label="Call to action for consultation" className="py-16 md:py-28 bg-primary">
          <div className="max-w-7xl mx-auto px-5 md:px-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center justify-center gap-3">
              <span className="w-6 h-px bg-accent" aria-hidden="true" />
              Ready to Work Together
              <span className="w-6 h-px bg-accent" aria-hidden="true" />
            </p>
            <h2 className="text-section-heading text-primary-foreground mb-5 max-w-2xl mx-auto">
              Your matter could be
              <br />
              <span className="italic opacity-70">the next success story</span>
            </h2>
            <p className="text-base text-primary-foreground/60 max-w-lg mx-auto mb-8 font-light leading-relaxed">
              Every engagement above started with a single conversation. Let's talk about what you need.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                Start a Conversation
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center px-8 py-3.5 border border-primary-foreground/30 text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-primary-foreground/10 transition-colors"
              >
                View All Services
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
