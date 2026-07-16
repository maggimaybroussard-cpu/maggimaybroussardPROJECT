'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

interface ProcessStep {
  phase: string;
  title: string;
  duration: string;
  description: string;
  details: string[];
}

const STEPS: ProcessStep[] = [
  {
    phase: '01',
    title: 'Free Consultation',
    duration: '30 min',
    description: 'We discuss your firm\'s needs, matter types, and workload volume to determine the right engagement model.',
    details: [
      'No obligation, no sales pressure',
      'Identify project vs. retainer fit',
      'Clarify scope and turnaround expectations',
    ],
  },
  {
    phase: '02',
    title: 'Agreement & Onboarding',
    duration: '24–48 hrs',
    description: 'Engagement letter and NDA signed electronically. Secure access to your preferred file-sharing platform established.',
    details: [
      'E-signature via secure portal',
      'Mutual NDA executed',
      'Billing method and invoice cadence confirmed',
    ],
  },
  {
    phase: '03',
    title: 'First Assignment',
    duration: 'Within 24 hrs',
    description: 'Retainer clients receive their first task acknowledgment within one business day. Work begins immediately after onboarding.',
    details: [
      'Matter intake form completed',
      'Task logged and time tracking begins',
      'Delivery timeline confirmed upfront',
    ],
  },
  {
    phase: '04',
    title: 'Ongoing Work & Reporting',
    duration: 'Monthly cycle',
    description: 'All hours tracked and reported transparently. You receive a detailed task log alongside each monthly invoice.',
    details: [
      'Hours report with task descriptions',
      'Proactive communication on complex matters',
      'Overage alert before hours are exhausted',
    ],
  },
  {
    phase: '05',
    title: 'Review & Renew',
    duration: 'Each billing cycle',
    description: 'At the end of each month, we review workload and adjust hours up, down, or pause — no penalties.',
    details: [
      'Scale hours to match caseload',
      '15-day notice to cancel or downgrade',
      'No long-term contract required',
    ],
  },
];

export default function CaseProcessTimeline() {
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
      { threshold: 0.06 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="case-process"
      className="py-20 md:py-32 bg-background overflow-hidden"
      aria-label="Case process timeline"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10">

        {/* Header */}
        <div className="scroll-reveal-hidden mb-14 md:mb-20 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              How It Works
            </p>
            <h2 className="text-section-heading text-foreground">
              From first call
              <br />
              <span className="italic opacity-70">to active support</span>
            </h2>
          </div>
          <p className="text-sm leading-relaxed max-w-xs text-muted-foreground font-light md:text-right">
            A straightforward five-step process — from initial consultation to ongoing paralegal support — with no ambiguity at any stage.
          </p>
        </div>

        {/* Steps — horizontal scroll on mobile, staggered grid on desktop */}
        <div className="scroll-reveal-hidden">
          {/* Mobile: horizontal scroll */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 md:hidden">
            {STEPS.map((step, idx) => (
              <MobileStepCard key={step.phase} step={step} isLast={idx === STEPS.length - 1} />
            ))}
          </div>

          {/* Desktop: asymmetric two-row layout */}
          <div className="hidden md:block">
            {/* Row 1: steps 1–3 */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {STEPS.slice(0, 3).map((step, idx) => (
                <DesktopStepCard key={step.phase} step={step} isLast={false} index={idx} />
              ))}
            </div>
            {/* Row 2: steps 4–5 wider */}
            <div className="grid grid-cols-2 gap-4">
              {STEPS.slice(3).map((step, idx) => (
                <DesktopStepCard key={step.phase} step={step} isLast={idx === 1} index={idx + 3} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="scroll-reveal-hidden mt-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-10 border-t border-border">
          <div>
            <p className="text-base font-semibold text-foreground mb-1">Ready to get started?</p>
            <p className="text-sm text-muted-foreground font-light">Book a free 30-minute consultation — no commitment required.</p>
          </div>
          <Link
            href="/book-consultation"
            className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/15 hover:shadow-primary/25 hover:gap-4 shrink-0"
          >
            Book Free Consultation
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

      </div>
    </section>
  );
}

function MobileStepCard({ step, isLast }: { step: ProcessStep; isLast: boolean }) {
  return (
    <div className="shrink-0 w-72 rounded-3xl border border-border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-serif text-[2.5rem] leading-none text-accent/25 select-none">{step.phase}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent bg-accent/10 px-2.5 py-1 rounded-full shrink-0 mt-1">
          {step.duration}
        </span>
      </div>
      <div>
        <h3 className="font-serif text-xl text-foreground mb-2 leading-tight">{step.title}</h3>
        <p className="text-sm text-muted-foreground font-light leading-relaxed">{step.description}</p>
      </div>
      <ul className="flex flex-col gap-2 mt-auto">
        {step.details.map((d) => (
          <li key={d} className="flex items-start gap-2">
            <span className="text-accent mt-0.5 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="text-xs text-muted-foreground font-light leading-snug">{d}</span>
          </li>
        ))}
      </ul>
      {!isLast && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-accent/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

function DesktopStepCard({ step, isLast, index }: { step: ProcessStep; isLast: boolean; index: number }) {
  return (
    <div
      className="group relative rounded-3xl border border-border bg-card p-7 flex flex-col gap-5 hover:border-accent/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
      style={{ transitionDelay: `${index * 0.06}s` }}
    >
      {/* Phase number + duration */}
      <div className="flex items-start justify-between gap-3">
        <span className="font-serif text-[3rem] leading-none text-accent/20 group-hover:text-accent/35 transition-colors duration-300 select-none">
          {step.phase}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent bg-accent/10 px-3 py-1.5 rounded-full shrink-0 mt-1">
          {step.duration}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="font-serif text-[1.4rem] text-foreground mb-2.5 leading-tight group-hover:text-primary transition-colors duration-300">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground font-light leading-relaxed mb-5">
          {step.description}
        </p>
        <ul className="flex flex-col gap-2">
          {step.details.map((d) => (
            <li key={d} className="flex items-start gap-2.5">
              <span className="text-accent mt-0.5 shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-xs text-muted-foreground font-light leading-snug">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Connector arrow (not on last item in each row) */}
      {!isLast && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-accent/50">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
