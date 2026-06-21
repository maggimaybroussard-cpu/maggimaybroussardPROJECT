'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ── Types ──────────────────────────────────────────────────────────────────────
interface IntakeStage {
  id: string;
  label: string;
  description: string;
  estimatedDays: string;
  icon: React.ReactNode;
}

interface NextStep {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  priority: 'high' | 'medium' | 'low';
  dueLabel?: string;
}

interface DocumentDeadline {
  id: string;
  name: string;
  description: string;
  daysFromIntake: number;
  required: boolean;
  category: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────
const INTAKE_STAGES: IntakeStage[] = [
  {
    id: 'intake',
    label: 'Intake Submitted',
    description: 'Your case questionnaire has been received.',
    estimatedDays: 'Day 1',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'review',
    label: 'Case Review',
    description: 'Maggi May reviews your matter and assesses fit.',
    estimatedDays: 'Days 1–3',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: 'consultation',
    label: 'Consultation Call',
    description: 'A 30-minute discovery call to align on scope and expectations.',
    estimatedDays: 'Days 3–7',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    id: 'documents',
    label: 'Document Collection',
    description: 'Submit required case materials and supporting documents.',
    estimatedDays: 'Days 5–10',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'agreement',
    label: 'Engagement Agreement',
    description: 'Review and sign the retainer or project agreement.',
    estimatedDays: 'Days 7–12',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    id: 'kickoff',
    label: 'Work Begins',
    description: 'Active work on your matter commences.',
    estimatedDays: 'Days 10–14',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
];

const NEXT_STEPS: NextStep[] = [
  {
    id: 'check-email',
    title: 'Watch for a confirmation email',
    description: 'You\'ll receive an acknowledgment within 1 business day confirming your intake was received and outlining next steps.',
    priority: 'high',
    dueLabel: 'Within 24 hours',
  },
  {
    id: 'book-consult',
    title: 'Schedule your consultation call',
    description: 'Book a 30-minute discovery call to discuss your matter in detail. Slots fill quickly — reserve yours early.',
    actionLabel: 'View Available Times',
    actionHref: '/availability',
    priority: 'high',
    dueLabel: 'Within 3–5 days',
  },
  {
    id: 'gather-docs',
    title: 'Begin gathering your documents',
    description: 'Start collecting relevant case files, prior filings, contracts, or correspondence. Having these ready speeds up the engagement.',
    priority: 'medium',
    dueLabel: 'Before consultation',
  },
  {
    id: 'portal-login',
    title: 'Set up your client portal access',
    description: 'Your portal is where you\'ll track case progress, view invoices, upload documents, and receive updates.',
    actionLabel: 'Access Client Portal',
    actionHref: '/portal/login',
    priority: 'medium',
    dueLabel: 'After confirmation email',
  },
  {
    id: 'review-services',
    title: 'Review service offerings',
    description: 'Familiarize yourself with the full range of paralegal services available so you can discuss scope during your consultation.',
    actionLabel: 'View Services',
    actionHref: '/services',
    priority: 'low',
    dueLabel: 'Before consultation',
  },
];

const DOCUMENT_DEADLINES: DocumentDeadline[] = [
  {
    id: 'prior-filings',
    name: 'Prior Court Filings',
    description: 'Any existing pleadings, motions, orders, or judgments related to your matter.',
    daysFromIntake: 7,
    required: true,
    category: 'Court Records',
  },
  {
    id: 'contracts',
    name: 'Relevant Contracts or Agreements',
    description: 'Executed contracts, retainer agreements, or any documents central to the dispute or matter.',
    daysFromIntake: 7,
    required: true,
    category: 'Agreements',
  },
  {
    id: 'correspondence',
    name: 'Key Correspondence',
    description: 'Emails, letters, or communications relevant to the legal matter.',
    daysFromIntake: 10,
    required: false,
    category: 'Communications',
  },
  {
    id: 'evidence',
    name: 'Supporting Evidence',
    description: 'Photos, records, receipts, or any documentary evidence supporting your position.',
    daysFromIntake: 10,
    required: false,
    category: 'Evidence',
  },
  {
    id: 'id-docs',
    name: 'Client Identification',
    description: 'Government-issued ID or bar card (for attorney clients) for verification purposes.',
    daysFromIntake: 5,
    required: true,
    category: 'Identification',
  },
  {
    id: 'signed-agreement',
    name: 'Signed Engagement Agreement',
    description: 'The retainer or project agreement must be signed before work can begin.',
    daysFromIntake: 12,
    required: true,
    category: 'Agreements',
  },
];

const PRIORITY_CONFIG = {
  high: { label: 'Action Required', color: '#B85C38', bg: 'rgba(184,92,56,0.08)', border: 'rgba(184,92,56,0.25)' },
  medium: { label: 'Upcoming', color: '#C8965A', bg: 'rgba(200,150,90,0.08)', border: 'rgba(200,150,90,0.25)' },
  low: { label: 'When Ready', color: '#7A6B5D', bg: 'rgba(122,107,93,0.07)', border: 'rgba(122,107,93,0.2)' },
};

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How long does the intake review take?',
    a: 'Intake submissions are reviewed within 1–3 business days. You\'ll receive an email acknowledgment within 24 hours of submission.',
  },
  {
    q: 'What if I need to update information I submitted?',
    a: 'Email broussardlegalservices@gmail.com with your name and the correction. Updates are accepted any time before the consultation call.',
  },
  {
    q: 'Can I submit documents before the consultation?',
    a: 'Yes — and it\'s encouraged. Upload documents through your client portal or email them directly. Having materials ready accelerates the engagement timeline.',
  },
  {
    q: 'What happens if I miss the consultation window?',
    a: 'No problem. You can reschedule through the availability page at any time. Slots are held for 5 business days after intake before being released.',
  },
  {
    q: 'Is there a fee for the initial consultation?',
    a: 'A small consultation deposit is collected at booking to reserve your time. This is credited toward your engagement if you proceed.',
  },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function IntakeStatusPage() {
  const [activeStage] = useState(1); // 0-indexed: 0 = intake submitted (first stage)
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [intakeDate] = useState<string>('');

  // Compute deadline dates relative to "today" as a proxy for intake date
  const [today] = useState(() => new Date());

  function getDeadlineDate(daysFromIntake: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + daysFromIntake);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getDaysRemaining(daysFromIntake: number): number {
    return daysFromIntake;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-20">

        {/* ── Hero Banner ─────────────────────────────────────────────────── */}
        <section className="bg-primary py-14 px-4 relative overflow-hidden">
          {/* Subtle texture */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, #C8965A 0%, transparent 60%), radial-gradient(circle at 80% 20%, #355E3B 0%, transparent 50%)`,
            }}
            aria-hidden="true"
          />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-accent/20 text-accent border border-accent/30">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />
                Intake Received
              </span>
            </div>
            <h1 className="font-serif text-primary-foreground text-4xl md:text-5xl mb-3 leading-tight">
              Your Case Is In Motion
            </h1>
            <p className="text-base md:text-lg max-w-xl leading-relaxed font-bold" style={{ color: '#355E3B' }}>
              Track where your intake stands, what's needed next, and when to expect each milestone — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/availability"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
              >
                Book Consultation
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link
                href="/portal/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest border border-primary-foreground/30 text-primary-foreground/80 hover:border-primary-foreground/60 hover:text-primary-foreground transition-all"
              >
                Client Portal
              </Link>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 md:px-8 mt-12 space-y-14">

          {/* ── Progress Timeline ────────────────────────────────────────── */}
          <section aria-labelledby="timeline-heading">
            <div className="mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Engagement Timeline</p>
              <h2 id="timeline-heading" className="font-serif text-3xl text-foreground">Where Things Stand</h2>
            </div>

            {/* Desktop horizontal stepper */}
            <div className="hidden md:block">
              <div className="relative">
                {/* Connector line */}
                <div className="absolute top-7 left-0 right-0 h-px bg-border" aria-hidden="true" />
                <div
                  className="absolute top-7 left-0 h-px bg-accent transition-all duration-700"
                  style={{ width: `${(activeStage / (INTAKE_STAGES.length - 1)) * 100}%` }}
                  aria-hidden="true"
                />

                <div className="relative grid grid-cols-6 gap-2">
                  {INTAKE_STAGES.map((stage, idx) => {
                    const isCompleted = idx < activeStage;
                    const isActive = idx === activeStage;
                    const isPending = idx > activeStage;
                    return (
                      <div key={stage.id} className="flex flex-col items-center text-center gap-3">
                        {/* Node */}
                        <div
                          className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            isCompleted
                              ? 'bg-accent text-accent-foreground shadow-md'
                              : isActive
                              ? 'bg-primary text-primary-foreground shadow-lg ring-4 ring-accent/20'
                              : 'bg-card text-muted-foreground border border-border'
                          }`}
                        >
                          {isCompleted ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            stage.icon
                          )}
                        </div>
                        <div>
                          <p className={`text-[11px] font-semibold leading-tight mb-0.5 ${isActive ? 'text-foreground' : isPending ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {stage.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{stage.estimatedDays}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active stage detail */}
              <div className="mt-8 p-5 rounded-2xl border border-accent/30 bg-accent/5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent shrink-0">
                    {INTAKE_STAGES[activeStage].icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent mb-1">Currently Active</p>
                    <h3 className="font-semibold text-foreground text-base mb-1">{INTAKE_STAGES[activeStage].label}</h3>
                    <p className="text-sm text-muted-foreground">{INTAKE_STAGES[activeStage].description}</p>
                    <p className="text-[11px] text-accent font-medium mt-2">Estimated: {INTAKE_STAGES[activeStage].estimatedDays}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile vertical stepper */}
            <div className="md:hidden space-y-0">
              {INTAKE_STAGES.map((stage, idx) => {
                const isCompleted = idx < activeStage;
                const isActive = idx === activeStage;
                const isPending = idx > activeStage;
                const isLast = idx === INTAKE_STAGES.length - 1;
                return (
                  <div key={stage.id} className="flex gap-4">
                    {/* Left: node + connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isCompleted
                            ? 'bg-accent text-accent-foreground'
                            : isActive
                            ? 'bg-primary text-primary-foreground ring-4 ring-accent/20'
                            : 'bg-card text-muted-foreground border border-border'
                        }`}
                      >
                        {isCompleted ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span className="scale-75">{stage.icon}</span>
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-px flex-1 mt-1 mb-1 min-h-[2rem] ${isCompleted ? 'bg-accent' : 'bg-border'}`} aria-hidden="true" />
                      )}
                    </div>
                    {/* Right: content */}
                    <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
                      <p className={`text-sm font-semibold ${isPending ? 'text-muted-foreground' : 'text-foreground'}`}>{stage.label}</p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{stage.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stage.estimatedDays}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Two-column: Next Steps + Document Deadlines ──────────────── */}
          <div className="grid md:grid-cols-5 gap-8">

            {/* Next Steps — wider column */}
            <section className="md:col-span-3" aria-labelledby="next-steps-heading">
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Action Items</p>
                <h2 id="next-steps-heading" className="font-serif text-3xl text-foreground">Your Next Steps</h2>
              </div>
              <div className="space-y-3">
                {NEXT_STEPS.map((step) => {
                  const cfg = PRIORITY_CONFIG[step.priority];
                  return (
                    <div
                      key={step.id}
                      className="rounded-2xl p-5 border transition-all duration-200 hover:shadow-sm"
                      style={{ background: cfg.bg, borderColor: cfg.border }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-foreground text-sm leading-snug">{step.title}</h3>
                        <span
                          className="shrink-0 text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border"
                          style={{ color: cfg.color, borderColor: cfg.border, background: 'rgba(255,255,255,0.6)' }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.description}</p>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {step.dueLabel && (
                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            {step.dueLabel}
                          </span>
                        )}
                        {step.actionLabel && step.actionHref && (
                          <Link
                            href={step.actionHref}
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
                            style={{ color: cfg.color, background: 'rgba(255,255,255,0.7)', border: `1px solid ${cfg.border}` }}
                          >
                            {step.actionLabel}
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Document Deadlines — narrower column */}
            <section className="md:col-span-2" aria-labelledby="docs-heading">
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Document Checklist</p>
                <h2 id="docs-heading" className="font-serif text-3xl text-foreground">What You'll Need</h2>
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {DOCUMENT_DEADLINES.map((doc, idx) => {
                  const daysLeft = getDaysRemaining(doc.daysFromIntake);
                  const isUrgent = daysLeft <= 5;
                  const isMedium = daysLeft > 5 && daysLeft <= 8;
                  return (
                    <div
                      key={doc.id}
                      className={`p-4 flex gap-3 ${idx !== DOCUMENT_DEADLINES.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      {/* Required indicator */}
                      <div className="shrink-0 mt-0.5">
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{
                            borderColor: doc.required ? '#C8965A' : '#D9D0C5',
                            background: doc.required ? 'rgba(200,150,90,0.1)' : 'transparent',
                          }}
                        >
                          {doc.required && (
                            <div className="w-2 h-2 rounded-full bg-accent" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-foreground leading-snug">{doc.name}</p>
                          {doc.required && (
                            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-accent">Required</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">{doc.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              background: isUrgent ? 'rgba(184,92,56,0.1)' : isMedium ? 'rgba(200,150,90,0.1)' : 'rgba(122,107,93,0.08)',
                              color: isUrgent ? '#B85C38' : isMedium ? '#C8965A' : '#7A6B5D',
                            }}
                          >
                            Due: {getDeadlineDate(doc.daysFromIntake)}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{doc.category}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="p-4 bg-secondary/40 border-t border-border">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Upload via portal</span> or email to{' '}
                    <a href="mailto:broussardlegalservices@gmail.com" className="text-accent hover:underline">
                      broussardlegalservices@gmail.com
                    </a>
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* ── Estimated Timeline Card ──────────────────────────────────── */}
          <section aria-labelledby="est-timeline-heading">
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Estimated Timeline</p>
              <h2 id="est-timeline-heading" className="font-serif text-3xl text-foreground">From Intake to Active Work</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Intake to Acknowledgment', range: '≤ 24 hours', icon: '📬', note: 'Confirmation email sent' },
                { label: 'Acknowledgment to Consultation', range: '3–7 days', icon: '📅', note: 'Subject to availability' },
                { label: 'Consultation to Agreement', range: '2–5 days', icon: '✍️', note: 'After scope is confirmed' },
                { label: 'Agreement to Work Start', range: '1–3 days', icon: '🚀', note: 'Upon deposit receipt' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl p-5 bg-card border border-border hover:border-accent/40 hover:shadow-sm transition-all duration-200"
                >
                  <div className="text-2xl mb-3" aria-hidden="true">{item.icon}</div>
                  <p className="font-serif text-2xl text-accent mb-1">{item.range}</p>
                  <p className="text-xs font-semibold text-foreground mb-1 leading-snug">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>

            {/* Total estimate banner */}
            <div className="mt-4 rounded-2xl p-5 border border-accent/30 bg-accent/5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center text-accent shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent mb-0.5">Total Onboarding Window</p>
                <p className="font-serif text-xl text-foreground">Typically 10–14 business days from intake to active engagement</p>
                <p className="text-xs text-muted-foreground mt-1">Urgent matters can be expedited — note your urgency level in the intake form or contact directly.</p>
              </div>
            </div>
          </section>

          {/* ── FAQ ─────────────────────────────────────────────────────── */}
          <section aria-labelledby="faq-heading">
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Common Questions</p>
              <h2 id="faq-heading" className="font-serif text-3xl text-foreground">Frequently Asked</h2>
            </div>
            <div className="max-w-2xl space-y-2">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-secondary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-expanded={openFaq === idx}
                  >
                    <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA Strip ───────────────────────────────────────────────── */}
          <section className="rounded-3xl bg-primary p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" aria-label="Call to action">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-accent mb-2">Ready to Move Forward?</p>
              <h2 className="font-serif text-2xl md:text-3xl text-primary-foreground mb-2">Have questions about your intake?</h2>
              <p className="text-sm max-w-md" style={{color: '#355E3B'}}>Reach out directly — response time is typically within a few hours on business days.</p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
              >
                Contact Us
              </Link>
              <Link
                href="/availability"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-semibold uppercase tracking-widest border border-primary-foreground/30 text-primary-foreground/80 hover:border-primary-foreground/60 hover:text-primary-foreground transition-all"
              >
                Book Consultation
              </Link>
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </>
  );
}
