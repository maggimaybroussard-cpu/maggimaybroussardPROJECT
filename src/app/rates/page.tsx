'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CalendlyWidget from '@/components/CalendlyWidget';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface RetainerPackage {
  id: string;
  name: string;
  tagline: string;
  price: number;
  hours: number;
  effectiveRate: number;
  popular?: boolean;
  badge?: string;
  color: string;
  features: string[];
  notIncluded?: string[];
}

interface HourlyService {
  name: string;
  rate: string;
  desc: string;
  icon: React.ReactNode;
}

interface BillingTerm {
  icon: React.ReactNode;
  title: string;
  detail: string;
}

/* ─── Data ───────────────────────────────────────────────────────────── */
const RETAINER_PACKAGES: RetainerPackage[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Targeted support for focused matters',
    price: 750,
    hours: 10,
    effectiveRate: 75,
    color: '#C8965A',
    features: [
      'Legal research & memo drafting',
      'Document review & summary',
      'Email communication support',
      '3-business-day turnaround',
      'Secure client portal access',
      'Monthly itemized invoice',
      'Cancel with 30 days notice',
    ],
    notIncluded: [
      'Motion & brief drafting',
      'Discovery management',
      'Priority 24-hr turnaround',
      'Deposition prep & summaries',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'The go-to retainer for active litigation firms',
    price: 1500,
    hours: 20,
    effectiveRate: 75,
    popular: true,
    badge: 'Most Popular',
    color: '#B76E79',
    features: [
      'Legal research & memo drafting',
      'Document review & summary',
      'Motion & brief drafting',
      'Discovery management',
      'Email communication support',
      'Priority 24-hr turnaround',
      'Secure client portal access',
      'Monthly itemized invoice',
      'Cancel with 30 days notice',
    ],
    notIncluded: [
      'Deposition prep & summaries',
      'Weekly strategy calls',
    ],
  },
  {
    id: 'full-service',
    name: 'Full-Service',
    tagline: 'End-to-end litigation partnership',
    price: 2800,
    hours: 40,
    effectiveRate: 70,
    color: '#1B2A4A',
    features: [
      'Legal research & memo drafting',
      'Document review & summary',
      'Motion & brief drafting',
      'Discovery management',
      'Deposition prep & summaries',
      'Weekly strategy calls',
      'Same-day priority turnaround',
      'Dedicated matter tracking',
      'Secure client portal access',
      'Monthly itemized invoice',
      'Cancel with 30 days notice',
    ],
  },
];

const HOURLY_SERVICES: HourlyService[] = [
  {
    name: 'As-Needed Paralegal Support',
    rate: '$95 / hr',
    desc: 'No monthly commitment. Pay only for the hours you use. Ideal for overflow work, one-off research, or firms testing the engagement before committing to a retainer.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    name: 'Retainer Overage Hours',
    rate: '$95 / hr',
    desc: 'When your monthly retainer hours are exhausted, additional hours are billed at the overage rate. You will always be notified before any overage charges are applied.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    name: 'Project-Based Engagements',
    rate: 'From $95 / hr',
    desc: 'Defined scope, defined deliverable. Ideal for document drafting projects, discovery packages, or research assignments with a clear start and end. Quoted per project.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

const BILLING_TERMS: BillingTerm[] = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h2" /><path d="M10 15h4" />
      </svg>
    ),
    title: 'Invoiced on the 1st',
    detail: 'Monthly invoices are issued on the first of each billing cycle and are due within 7 days via ACH, credit card, or check.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    title: 'Transparent time tracking',
    detail: 'Every task is logged with a description and duration. You receive a detailed time report with each invoice — no mystery charges.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'No rollover, no penalty',
    detail: 'Unused hours expire at month end. Overage hours are billed at $95/hr and are always pre-approved before any charges are applied.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    ),
    title: '30-day cancellation notice',
    detail: 'Cancel or downgrade with 30 days written notice before your next billing cycle. No long-term contracts, no cancellation fees.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    title: 'Secure Stripe payments',
    detail: 'All payments processed via Stripe with SSL encryption. Credit card, debit card, and ACH bank transfer accepted.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Solo & multi-attorney firms',
    detail: 'The Essential tier is designed for solo practitioners. Standard and Full-Service scale for multi-attorney firms with higher-volume needs.',
  },
];

const SCOPE_ITEMS = [
  { label: 'Legal Research', desc: 'Case law, statutory research, and memo drafting on any topic relevant to your matter.' },
  { label: 'Document Drafting', desc: 'Motions, briefs, discovery requests, contracts, and correspondence drafted to your specifications.' },
  { label: 'Deadline Tracking', desc: 'Case timelines, court deadlines, and filing calendars maintained so nothing slips through.' },
  { label: 'Discovery Management', desc: 'Privilege logs, discovery tracking templates, and document organization for complex matters.' },
  { label: 'Deposition Support', desc: 'Deposition summaries, key testimony highlights, and witness preparation outlines.' },
  { label: 'Client Portal Access', desc: 'Secure portal to view documents, track case status, and communicate on every matter.' },
];

/* ─── Component ──────────────────────────────────────────────────────── */
export default function RatesPage() {
  const [activeTab, setActiveTab] = useState<'retainer' | 'hourly'>('retainer');
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elements = sectionRef.current?.querySelectorAll('.reveal-item');
    if (!elements) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.08 }
    );
    elements.forEach((el) => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.transform = 'translateY(24px)';
      (el as HTMLElement).style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Header />
      <main ref={sectionRef} className="bg-background text-foreground pt-[100px]">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground py-20 md:py-28 overflow-hidden relative">
          {/* Subtle background texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, #B76E79 0%, transparent 50%), radial-gradient(circle at 80% 20%, #C8965A 0%, transparent 40%)',
          }} />
          <div className="max-w-7xl mx-auto px-5 md:px-10 relative">
            <div className="reveal-item max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-5 flex items-center gap-3">
                <span className="w-8 h-px bg-accent/70" />
                Engagement Models
              </p>
              <h1 className="text-section-heading text-primary-foreground mb-6">
                Retainer &amp; Hourly
                <br />
                <span className="italic opacity-70">Rate Guide</span>
              </h1>
              <p className="text-base md:text-lg text-primary-foreground/70 font-light leading-relaxed max-w-xl mb-10">
                Transparent pricing, flexible terms, and no surprises. Choose a monthly retainer for predictable costs or pay hourly for as-needed support — whichever fits your practice.
              </p>
              {/* Tab switcher */}
              <div className="inline-flex items-center gap-1 bg-primary-foreground/10 rounded-full p-1">
                <button
                  onClick={() => setActiveTab('retainer')}
                  className={`px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 ${
                    activeTab === 'retainer' ?'bg-accent text-accent-foreground shadow-sm' :'text-primary-foreground/70 hover:text-primary-foreground'
                  }`}
                >
                  Monthly Retainer
                </button>
                <button
                  onClick={() => setActiveTab('hourly')}
                  className={`px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 ${
                    activeTab === 'hourly' ?'bg-accent text-accent-foreground shadow-sm' :'text-primary-foreground/70 hover:text-primary-foreground'
                  }`}
                >
                  Hourly / Project
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Retainer Packages ─────────────────────────────────────────── */}
        {activeTab === 'retainer' && (
          <section className="py-20 md:py-28 bg-background">
            <div className="max-w-7xl mx-auto px-5 md:px-10">
              <div className="reveal-item mb-14">
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
                  <span className="w-8 h-px bg-accent/50" />
                  Monthly Packages
                </p>
                <h2 className="text-card-heading text-foreground mb-3">
                  Reserve your block of hours
                </h2>
                <p className="text-sm text-muted-foreground font-light max-w-lg leading-relaxed">
                  Each retainer secures a dedicated block of paralegal time each month at a flat rate. Predictable costs, transparent tracking, flexible terms.
                </p>
              </div>

              {/* Package cards — asymmetric layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
                {RETAINER_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`reveal-item relative rounded-3xl flex flex-col overflow-hidden transition-all duration-300 ${
                      pkg.popular
                        ? 'shadow-2xl ring-2 ring-accent/40 md:scale-[1.03]'
                        : 'border border-border hover:border-accent/30 hover:shadow-lg'
                    }`}
                  >
                    {pkg.badge && (
                      <div className="absolute top-0 left-0 right-0 text-center py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white" style={{ background: pkg.color }}>
                        {pkg.badge}
                      </div>
                    )}

                    {/* Card header */}
                    <div className={`px-7 pt-8 pb-6 ${pkg.badge ? 'pt-12' : ''}`} style={{ background: pkg.popular ? '#1B2A4A' : '#FFFAF6' }}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mb-3 ${pkg.popular ? 'text-accent' : 'text-muted-foreground'}`}>
                        {pkg.name}
                      </p>
                      <div className="flex items-end gap-2 mb-1">
                        <span className={`font-serif text-[2.8rem] leading-none font-bold tracking-tight ${pkg.popular ? 'text-primary-foreground' : 'text-foreground'}`}>
                          ${pkg.price.toLocaleString()}
                        </span>
                        <span className={`text-sm font-light mb-1.5 ${pkg.popular ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>/mo</span>
                      </div>
                      <p className={`text-sm font-light ${pkg.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {pkg.hours} hrs · ${pkg.effectiveRate}/hr effective rate
                      </p>
                      <p className={`text-xs mt-3 leading-relaxed ${pkg.popular ? 'text-primary-foreground/60' : 'text-muted-foreground/80'}`}>
                        {pkg.tagline}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className={`h-px ${pkg.popular ? 'bg-primary-foreground/10' : 'bg-border'}`} style={{ background: pkg.popular ? 'rgba(245,236,215,0.1)' : undefined }} />

                    {/* Features */}
                    <div className={`px-7 py-6 flex-1 flex flex-col ${pkg.popular ? 'bg-primary' : 'bg-card'}`}>
                      <ul className="flex flex-col gap-3 mb-6 flex-1">
                        {pkg.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 text-accent">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span className={`text-sm font-light leading-snug ${pkg.popular ? 'text-primary-foreground/85' : 'text-foreground/80'}`}>{f}</span>
                          </li>
                        ))}
                        {pkg.notIncluded?.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 opacity-40">
                            <span className="mt-0.5 shrink-0">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                            <span className={`text-sm font-light leading-snug line-through ${pkg.popular ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href="/book-consultation"
                        className={`inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 ${
                          pkg.popular
                            ? 'bg-accent text-accent-foreground hover:opacity-90'
                            : 'border border-border text-foreground hover:border-accent/50 hover:text-accent'
                        }`}
                      >
                        Start with {pkg.name}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comparison note */}
              <div className="reveal-item rounded-2xl border border-border bg-secondary/40 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-sm text-foreground/75 font-light leading-relaxed">
                  <span className="text-foreground font-semibold">Not sure which tier fits?</span>{' '}
                  Book a free 15-minute consultation and we will assess your matter volume and recommend the right engagement model.{' '}
                  <Link href="/book-consultation" className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors">
                    Schedule a call →
                  </Link>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Hourly / Project ──────────────────────────────────────────── */}
        {activeTab === 'hourly' && (
          <section className="py-20 md:py-28 bg-background">
            <div className="max-w-7xl mx-auto px-5 md:px-10">
              <div className="reveal-item mb-14">
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
                  <span className="w-8 h-px bg-accent/50" />
                  Hourly &amp; Project Rates
                </p>
                <h2 className="text-card-heading text-foreground mb-3">
                  Pay only for what you need
                </h2>
                <p className="text-sm text-muted-foreground font-light max-w-lg leading-relaxed">
                  No monthly commitment required. Hourly and project-based engagements are available for overflow work, one-off assignments, or firms evaluating the fit before committing to a retainer.
                </p>
              </div>

              {/* Hourly service cards — asymmetric bento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
                {HOURLY_SERVICES.map((svc, i) => (
                  <div
                    key={svc.name}
                    className={`reveal-item rounded-3xl border border-border bg-card p-8 flex flex-col gap-5 hover:border-accent/30 hover:shadow-lg transition-all duration-300 ${i === 2 ? 'md:col-span-2' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                        {svc.icon}
                      </div>
                      <span className="font-serif text-2xl font-bold text-foreground tracking-tight">{svc.rate}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-2">{svc.name}</h3>
                      <p className="text-sm text-muted-foreground font-light leading-relaxed">{svc.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rate comparison table */}
              <div className="reveal-item rounded-3xl border border-border bg-card overflow-hidden mb-10">
                <div className="px-7 py-5 border-b border-border bg-secondary/30">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Rate Summary</h3>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { label: 'Essential Retainer', rate: '$750 / mo', note: '10 hrs · $75/hr effective' },
                    { label: 'Standard Retainer', rate: '$1,500 / mo', note: '20 hrs · $75/hr effective', highlight: true },
                    { label: 'Full-Service Retainer', rate: '$2,800 / mo', note: '40 hrs · $70/hr effective' },
                    { label: 'Hourly (as-needed)', rate: '$95 / hr', note: 'No monthly commitment' },
                    { label: 'Retainer Overage', rate: '$95 / hr', note: 'Pre-approved before billing' },
                    { label: 'Project-Based', rate: 'From $95 / hr', note: 'Quoted per scope' },
                  ].map((row) => (
                    <div key={row.label} className={`flex items-center justify-between px-7 py-4 gap-4 ${row.highlight ? 'bg-accent/5' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground font-light">{row.note}</p>
                      </div>
                      <span className={`font-serif text-lg font-bold shrink-0 ${row.highlight ? 'text-accent' : 'text-foreground'}`}>{row.rate}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="reveal-item text-center">
                <Link
                  href="/book-consultation"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-accent text-accent-foreground text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  Discuss Your Needs
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── What's Included ───────────────────────────────────────────── */}
        <section className="py-20 md:py-28 bg-secondary/30">
          <div className="max-w-7xl mx-auto px-5 md:px-10">
            <div className="reveal-item mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
                  <span className="w-8 h-px bg-accent/50" />
                  Scope of Work
                </p>
                <h2 className="text-card-heading text-foreground">
                  What every engagement covers
                </h2>
              </div>
              <p className="text-sm text-muted-foreground font-light max-w-xs leading-relaxed md:text-right">
                All retainer tiers include access to the full range of paralegal services below, subject to your monthly hour allocation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCOPE_ITEMS.map((item, i) => (
                <div
                  key={item.label}
                  className={`reveal-item rounded-2xl border border-border bg-card p-6 hover:border-accent/30 hover:shadow-md transition-all duration-300 ${i === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{item.label}</h3>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Billing Terms ─────────────────────────────────────────────── */}
        <section className="py-20 md:py-28 bg-primary text-primary-foreground">
          <div className="max-w-7xl mx-auto px-5 md:px-10">
            <div className="reveal-item mb-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
                <span className="w-8 h-px bg-accent/70" />
                Billing Terms
              </p>
              <h2 className="text-card-heading text-primary-foreground">
                How billing works
              </h2>
            </div>

            {/* Asymmetric bento grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BILLING_TERMS.map((term, i) => (
                <div
                  key={term.title}
                  className={`reveal-item rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 hover:border-accent/30 transition-all duration-300 ${i === 0 ? 'lg:col-span-2' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent mb-4">
                    {term.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-primary-foreground mb-2">{term.title}</h3>
                  <p className="text-sm text-primary-foreground/65 font-light leading-relaxed">{term.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="py-20 md:py-28 bg-background">
          <div className="max-w-3xl mx-auto px-5 md:px-10 text-center">
            <div className="reveal-item">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-5 flex items-center justify-center gap-3">
                <span className="w-8 h-px bg-accent/50" />
                Get Started
                <span className="w-8 h-px bg-accent/50" />
              </p>
              <h2 className="text-section-heading text-foreground mb-6">
                Ready to engage?
              </h2>
              <p className="text-base text-muted-foreground font-light leading-relaxed mb-10 max-w-xl mx-auto">
                Book a free 15-minute consultation to discuss your matter volume, practice area, and which engagement model makes the most sense for your firm.
              </p>

              {/* ── Live Calendly Booking Widget ─────────────────────── */}
              <div className="mb-10">
                <CalendlyWidget
                  heading="Book Your Free Consultation"
                  subheading="Select a time that works for you — no obligation."
                  height={580}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/book-consultation"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-accent text-accent-foreground text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  Book Free Consultation
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-border text-foreground text-sm font-semibold uppercase tracking-widest hover:border-accent/50 hover:text-accent transition-all duration-300"
                >
                  View Full Pricing
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
