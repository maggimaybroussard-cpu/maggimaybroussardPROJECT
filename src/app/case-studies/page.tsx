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
    title: 'Multi-Party Commercial Litigation Trial Prep',
    client: 'Regional Law Firm — 12 Attorneys',
    serviceTag: 'Litigation Support',
    complexity: 'High-Stakes',
    complexityColor: '#C8965A',
    duration: '6 weeks',
    outcome: 'Favorable Settlement',
    outcomeColor: '#7A9E7E',
    summary:
      'A 12-attorney firm faced a complex multi-party commercial dispute with 4,200+ documents and 11 depositions — six weeks from trial. Their internal team was overwhelmed and at risk of missing critical deadlines.',
    timeline: [
      {
        phase: 'Document Management',
        before: 'Unorganized 4,200+ documents scattered across shared drives with no indexing or exhibit numbering.',
        after: 'Fully indexed, searchable exhibit database with consistent numbering, cross-references, and a master document log.',
      },
      {
        phase: 'Deposition Readiness',
        before: 'No deposition summaries prepared. Attorneys reviewing raw transcripts the night before each session.',
        after: '11 concise deposition summaries delivered — key admissions flagged, impeachment points highlighted.',
      },
      {
        phase: 'Trial Binders',
        before: 'No trial binders assembled. Exhibits existed only as loose digital files with inconsistent naming.',
        after: '8 tabbed, paginated trial binders assembled and delivered to counsel 72 hours before trial.',
      },
    ],
    clientImpact: [
      {
        icon: 'clock',
        headline: 'Zero missed deadlines',
        detail: 'A rolling deadline tracker updated daily ensured every filing, response, and submission was on time across the 6-week sprint.',
      },
      {
        icon: 'scale',
        headline: 'Settlement 18% above target',
        detail: 'Opposing counsel moved to settle on day two of trial, citing the firm\'s evident command of the record — a direct result of thorough preparation.',
      },
      {
        icon: 'shield',
        headline: 'Attorney bandwidth protected',
        detail: 'By offloading all document management and binder assembly, lead attorneys focused entirely on strategy and client communication.',
      },
      {
        icon: 'check',
        headline: 'Exhibit database built from scratch',
        detail: '4,200+ documents indexed, cross-referenced, and searchable in a single system — giving attorneys instant access to any exhibit during trial.',
      },
      {
        icon: 'scale',
        headline: '11 deposition summaries delivered',
        detail: 'Each summary flagged key admissions and impeachment opportunities, reducing attorney prep time per deposition from hours to minutes.',
      },
      {
        icon: 'shield',
        headline: 'Trial binders ready 72 hours early',
        detail: '8 tabbed, paginated binders delivered ahead of schedule — giving the trial team time to review and adjust strategy before opening arguments.',
      },
    ],
    metrics: [
      { label: 'Documents Organized', before: '0 indexed', after: '4,200+ indexed' },
      { label: 'Deposition Summaries', before: 'None prepared', after: '11 delivered' },
      { label: 'Trial Binders', before: 'Not assembled', after: '8 complete binders' },
      { label: 'Settlement vs. Target', before: 'At risk', after: '+18% above target' },
    ],
  },
  {
    id: '02',
    title: 'SaaS Vendor Contract Risk Audit',
    client: 'In-House Legal Team — Series B Tech Company',
    serviceTag: 'Contract Review',
    complexity: 'Complex',
    complexityColor: '#8B7355',
    duration: '3 weeks',
    outcome: 'Series B Closed On Schedule',
    outcomeColor: '#7A9E7E',
    summary:
      'An in-house legal team needed to audit 34 active SaaS vendor agreements before a Series B close. Investors required confirmation that no agreements contained change-of-control provisions, auto-renewal traps, or uncapped liability clauses.',
    timeline: [
      {
        phase: 'Contract Inventory',
        before: 'No centralized contract inventory. Agreements stored across email threads, shared drives, and a legacy contract tool.',
        after: 'All 34 agreements catalogued in a master tracker with key dates, renewal terms, and counterparty details.',
      },
      {
        phase: 'Risk Identification',
        before: 'No systematic review process. Legal team had reviewed fewer than 10 of 34 agreements informally.',
        after: 'All 34 agreements reviewed against a 9-category risk matrix. 12 flagged with material issues and annotated redlines.',
      },
      {
        phase: 'Investor Deliverable',
        before: 'No executive summary existed. Investors had no visibility into contract risk profile.',
        after: 'One-page risk summary per flagged contract delivered to investors as part of due diligence package.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Series B closed on schedule',
        detail: 'Investors approved the contract audit as part of due diligence. No closing delay attributable to contract risk.',
      },
      {
        icon: 'shield',
        headline: '8 high-risk agreements renegotiated',
        detail: 'Of 12 flagged agreements, 8 were renegotiated before closing — removing change-of-control triggers and capping liability exposure.',
      },
      {
        icon: 'clock',
        headline: 'Legal team capacity freed',
        detail: 'The in-house team redirected their time to investor negotiations and closing logistics rather than contract review.',
      },
      {
        icon: 'scale',
        headline: 'Full contract inventory created',
        detail: 'All 34 agreements catalogued in a master tracker with key dates, renewal terms, and counterparty details — a resource the team continues to use post-close.',
      },
      {
        icon: 'check',
        headline: '9-category risk matrix applied',
        detail: 'Every agreement was reviewed against a consistent framework — change-of-control, auto-renewal, uncapped liability, IP ownership, and five additional risk categories.',
      },
      {
        icon: 'shield',
        headline: 'Investor confidence established',
        detail: 'One-page risk summaries per flagged contract gave investors clear visibility into the company\'s contract risk profile — accelerating approval.',
      },
    ],
    metrics: [
      { label: 'Contracts Reviewed', before: '< 10 informally', after: '34 systematically' },
      { label: 'Risk Issues Identified', before: 'Unknown', after: '12 flagged' },
      { label: 'Agreements Renegotiated', before: '0', after: '8 before closing' },
      { label: 'Closing Delay', before: 'At risk', after: 'None' },
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
      'A solo family law attorney needed a comprehensive research memo on the standard for modifying a custody order following a parent\'s relocation — with supporting case law and a draft argument outline — all within 5 business days.',
    timeline: [
      {
        phase: 'Research Scope',
        before: 'Attorney had only a general sense of the legal standard. No case law compiled. No argument framework.',
        after: 'Clear legal standard analysis grounded in Louisiana statutes and 22 annotated appellate decisions (2018–2025).',
      },
      {
        phase: 'Memo Delivery',
        before: 'Attorney planned to research and draft the memo personally — estimated 12–15 hours of work.',
        after: '14-page research memo delivered in 5 business days, ready to use as the foundation for the motion.',
      },
      {
        phase: 'Motion Filing',
        before: 'No argument outline. Attorney would need to structure the motion from scratch after completing research.',
        after: 'Ready-to-use argument outline included in the memo — attorney filed the motion directly from the provided framework.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Motion granted at initial hearing',
        detail: 'The court granted the custody modification at the first hearing, citing the strength of the legal argument and supporting authority.',
      },
      {
        icon: 'clock',
        headline: '12–15 attorney hours saved',
        detail: 'The attorney estimated the research and drafting would have taken 12–15 hours personally. The 5-day turnaround freed that time for client-facing work.',
      },
      {
        icon: 'scale',
        headline: 'Client outcome secured',
        detail: 'The relocating parent received the custody modification they sought — a direct result of the strength of the legal argument delivered.',
      },
      {
        icon: 'shield',
        headline: '22 appellate decisions annotated',
        detail: 'Case law spanning 2018–2025 was reviewed, selected, and annotated — giving the attorney a ready-to-cite authority set grounded in current precedent.',
      },
      {
        icon: 'check',
        headline: 'Argument outline included',
        detail: 'A ready-to-use argument outline was delivered alongside the memo — the attorney filed the motion directly from the provided framework without additional drafting.',
      },
      {
        icon: 'clock',
        headline: '5-day turnaround on 14-page memo',
        detail: 'A comprehensive research memo covering Louisiana statutes and appellate decisions was delivered in 5 business days, ready to use as the foundation for the motion.',
      },
    ],
    metrics: [
      { label: 'Research Memo', before: 'Not started', after: '14 pages delivered' },
      { label: 'Case Citations', before: '0 compiled', after: '22 annotated' },
      { label: 'Turnaround', before: '12–15 hrs estimated', after: '5 business days' },
      { label: 'Motion Result', before: 'Uncertain', after: 'Granted' },
    ],
  },
  {
    id: '04',
    title: 'Probate & Estate Administration Document Overhaul',
    client: 'Boutique Estate Planning Firm — 3 Attorneys',
    serviceTag: 'Estate Administration',
    complexity: 'Complex',
    complexityColor: '#8B7355',
    duration: '4 weeks',
    outcome: 'Estate Closed 6 Weeks Early',
    outcomeColor: '#7A9E7E',
    summary:
      'A small estate planning firm inherited a complex probate matter mid-process — 19 beneficiaries, disputed asset valuations, and a backlog of unfiled court documents. The prior paralegal had left without transferring files or status notes.',
    timeline: [
      {
        phase: 'File Reconstruction',
        before: 'No organized case file. Prior paralegal\'s notes were incomplete, undated, and stored across three separate systems.',
        after: 'Complete chronological case file reconstructed from court records, correspondence, and client documents — with a status summary memo for each attorney.',
      },
      {
        phase: 'Court Filing Backlog',
        before: '7 required court filings overdue. Firm unaware of 2 additional filing deadlines approaching within 10 days.',
        after: 'All 9 filings completed and confirmed. A rolling court deadline calendar created and shared with the full team.',
      },
      {
        phase: 'Beneficiary Communication',
        before: 'No standardized communication process. Beneficiaries receiving inconsistent updates — or none at all.',
        after: 'Templated beneficiary update letters drafted and sent. Distribution schedule established for the remainder of the administration.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Estate closed 6 weeks ahead of schedule',
        detail: 'Clearing the filing backlog and establishing a deadline calendar accelerated the administration timeline significantly.',
      },
      {
        icon: 'shield',
        headline: 'Zero sanctions or court reprimands',
        detail: 'All overdue filings were submitted before any court action was taken. The firm avoided potential sanctions and client complaints.',
      },
      {
        icon: 'clock',
        headline: 'Beneficiary disputes de-escalated',
        detail: 'Consistent, professional communication to all 19 beneficiaries reduced inbound calls and emails to the firm by an estimated 60%.',
      },
      {
        icon: 'scale',
        headline: 'Complete case file rebuilt from scratch',
        detail: 'A chronological file with status memos gave attorneys immediate clarity on where the matter stood — replacing weeks of catch-up work.',
      },
      {
        icon: 'check',
        headline: '9 court filings completed',
        detail: '7 overdue filings cleared and 2 upcoming deadlines met — all within the first two weeks of engagement.',
      },
      {
        icon: 'shield',
        headline: 'Ongoing deadline system established',
        detail: 'A shared court deadline calendar created during the engagement continues to be used by the firm for all active probate matters.',
      },
    ],
    metrics: [
      { label: 'Overdue Filings', before: '7 outstanding', after: 'All 9 completed' },
      { label: 'Case File Status', before: 'Reconstructed from scratch', after: 'Fully organized' },
      { label: 'Beneficiary Updates', before: 'Ad hoc / inconsistent', after: 'Templated & scheduled' },
      { label: 'Administration Timeline', before: 'Delayed', after: 'Closed 6 wks early' },
    ],
  },
  {
    id: '05',
    title: 'Employment Discrimination Defense — Discovery Management',
    client: 'Mid-Size Employment Defense Firm',
    serviceTag: 'Litigation Support',
    complexity: 'High-Stakes',
    complexityColor: '#C8965A',
    duration: '8 weeks',
    outcome: 'Summary Judgment Granted',
    outcomeColor: '#7A9E7E',
    summary:
      'An employment defense firm defending a Title VII discrimination claim needed to manage a 6,800-document production, prepare a privilege log, and organize witness files for 9 potential deponents — all while managing three other active matters.',
    timeline: [
      {
        phase: 'Document Review & Production',
        before: '6,800 documents unreviewed. No privilege log started. Production deadline 3 weeks out with no review protocol in place.',
        after: 'Full document review completed. 312 documents withheld on privilege grounds with a compliant privilege log delivered on deadline.',
      },
      {
        phase: 'Witness File Preparation',
        before: 'No individual witness files. Attorneys working from a single shared folder with no deponent-specific organization.',
        after: '9 individual witness files assembled — each with employment history, relevant documents, and a deposition prep checklist.',
      },
      {
        phase: 'Summary Judgment Support',
        before: 'No statement of undisputed facts drafted. Attorneys had not begun organizing the factual record for the motion.',
        after: '47-paragraph statement of undisputed facts drafted with record citations — used directly in the filed motion.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Summary judgment granted',
        detail: 'The court granted the motion in full, citing the strength of the factual record and the completeness of the supporting documentation.',
      },
      {
        icon: 'shield',
        headline: 'Privilege log delivered without challenge',
        detail: 'Opposing counsel reviewed the 312-entry privilege log and raised no objections — a result of meticulous document-by-document annotation.',
      },
      {
        icon: 'clock',
        headline: 'Three concurrent matters unaffected',
        detail: 'By absorbing the document review and witness prep workload, the firm\'s attorneys maintained full capacity on three other active cases.',
      },
      {
        icon: 'scale',
        headline: '6,800 documents reviewed and produced',
        detail: 'A complete document review with consistent privilege determinations and production coding — delivered on a 3-week deadline.',
      },
      {
        icon: 'check',
        headline: '9 witness files built',
        detail: 'Each deponent file included employment history, key documents, and a prep checklist — reducing attorney deposition prep time by an estimated 40%.',
      },
      {
        icon: 'shield',
        headline: '47-paragraph SOF drafted',
        detail: 'A fully cited statement of undisputed facts was delivered to the attorneys and filed with minimal edits — saving an estimated 8–10 hours of drafting time.',
      },
    ],
    metrics: [
      { label: 'Documents Reviewed', before: '0 of 6,800', after: '6,800 complete' },
      { label: 'Privilege Log', before: 'Not started', after: '312 entries filed' },
      { label: 'Witness Files', before: 'None', after: '9 complete files' },
      { label: 'Motion Result', before: 'Uncertain', after: 'Granted in full' },
    ],
  },
  {
    id: '06',
    title: 'Commercial Real Estate Closing Package Preparation',
    client: 'Real Estate Transactional Attorney — Solo Practice',
    serviceTag: 'Transactional Support',
    complexity: 'Standard',
    complexityColor: '#7A9E7E',
    duration: '10 business days',
    outcome: 'Closing Completed On Time',
    outcomeColor: '#7A9E7E',
    summary:
      'A solo transactional attorney needed to prepare a complete closing package for a $2.1M commercial property sale — including title review, closing checklist, document assembly, and pro-ration calculations — while simultaneously managing two residential closings.',
    timeline: [
      {
        phase: 'Title & Due Diligence Review',
        before: 'Title commitment received but not reviewed. No due diligence checklist. Attorney had not yet identified open title exceptions.',
        after: 'Title commitment reviewed in full. 4 open exceptions identified, summarized, and flagged for resolution with a recommended cure for each.',
      },
      {
        phase: 'Closing Document Assembly',
        before: 'No closing checklist. Documents existed as individual drafts with no version control or execution tracking.',
        after: 'Complete closing checklist with 23 line items. All documents organized, version-controlled, and tracked through execution.',
      },
      {
        phase: 'Settlement Statement & Pro-Rations',
        before: 'Pro-ration calculations not started. Attorney planned to complete them personally the day before closing.',
        after: 'Fully calculated settlement statement with property tax, rent, and HOA pro-rations delivered 3 days before closing for attorney review.',
      },
    ],
    clientImpact: [
      {
        icon: 'check',
        headline: 'Closing completed on time',
        detail: 'All documents executed, funds disbursed, and deed recorded on the scheduled closing date — no delays or last-minute issues.',
      },
      {
        icon: 'shield',
        headline: '4 title exceptions resolved pre-closing',
        detail: 'Early identification of open title exceptions gave the parties time to cure each issue before the closing table — preventing a potential delay.',
      },
      {
        icon: 'clock',
        headline: 'Two residential closings unaffected',
        detail: 'The attorney maintained full capacity on two concurrent residential closings while the commercial package was handled in parallel.',
      },
      {
        icon: 'scale',
        headline: '23-item closing checklist created',
        detail: 'A complete document checklist with execution tracking gave the attorney real-time visibility into closing readiness throughout the 10-day sprint.',
      },
      {
        icon: 'check',
        headline: 'Settlement statement delivered 3 days early',
        detail: 'Pro-ration calculations for property tax, rent, and HOA delivered ahead of schedule — giving the attorney time to review and confirm figures with the title company.',
      },
      {
        icon: 'shield',
        headline: 'Version-controlled document set',
        detail: 'Every closing document tracked through drafting, review, and execution — eliminating the risk of an outdated version reaching the closing table.',
      },
    ],
    metrics: [
      { label: 'Title Exceptions', before: 'Unreviewed', after: '4 identified & cured' },
      { label: 'Closing Checklist', before: 'None', after: '23-item tracker' },
      { label: 'Settlement Statement', before: 'Not started', after: 'Delivered 3 days early' },
      { label: 'Closing Result', before: 'At risk of delay', after: 'On time' },
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
