'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackRetainerTierInterest } from '@/lib/analytics';

interface PricingTier {
  name: string;
  hours: string;
  rate: string;
  monthlyTotal: string;
  highlight: boolean;
  features: string[];
  badge?: string;
}

const TIERS: PricingTier[] = [
  {
    name: 'Essential',
    hours: '10 hrs / mo',
    rate: '$75/hr',
    monthlyTotal: '$750/mo',
    highlight: false,
    features: [
      'Legal research & memo drafting',
      'Document review & summary',
      'Email communication support',
      '3-business-day turnaround',
      'Client portal access',
      'Month-to-month, cancel anytime',
    ],
  },
  {
    name: 'Standard',
    hours: '20 hrs / mo',
    rate: '$75/hr',
    monthlyTotal: '$1,500/mo',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Legal research & memo drafting',
      'Document review & summary',
      'Motion & brief drafting',
      'Discovery management',
      'Priority 24-hr turnaround',
      'Client portal access',
      'Month-to-month, cancel anytime',
    ],
  },
  {
    name: 'Full-Service',
    hours: '40 hrs / mo',
    rate: '$70/hr',
    monthlyTotal: '$2,800/mo',
    highlight: false,
    features: [
      'All Standard tier services',
      'Deposition prep & summaries',
      'Weekly strategy calls',
      'Same-day priority turnaround',
      'Dedicated matter tracking',
      'Client portal access',
      'Month-to-month, cancel anytime',
    ],
  },
];

const BILLING_NOTES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    label: 'Invoiced monthly',
    detail: 'Invoice issued on the 1st; due within 7 days via ACH, card, or check.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: 'Hours tracked transparently',
    detail: 'Every task logged with description and duration. No surprise overages.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'No rollover, no penalty',
    detail: 'Unused hours expire at month end. Overage hours billed at $95/hr — always pre-approved.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
      </svg>
    ),
    label: '15-day cancellation notice',
    detail: 'Cancel or downgrade with 15 days written notice. No long-term contracts.',
  },
];

export default function RetainerPricingSection() {
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
      id="retainer-pricing"
      className="py-20 md:py-32 bg-primary text-primary-foreground overflow-hidden"
      aria-label="Retainer pricing"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10">

        {/* Header */}
        <div className="scroll-reveal-hidden mb-14 md:mb-20 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              Billing Model
            </p>
            <h2 className="text-section-heading text-primary-foreground">
              Retainer pricing,
              <br />
              <span className="italic opacity-70">no surprises</span>
            </h2>
          </div>
          <p className="text-sm leading-relaxed max-w-xs text-primary-foreground/75 font-light md:text-right">
            Reserve a block of paralegal hours each month at a flat rate. Transparent tracking, predictable costs, flexible terms.
          </p>
        </div>

        {/* Pricing Cards — asymmetric bento */}
        <div className="scroll-reveal-hidden grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-3xl p-7 md:p-8 flex flex-col transition-all duration-300 ${
                tier.highlight
                  ? 'bg-accent text-accent-foreground shadow-2xl shadow-accent/20 scale-[1.02] md:scale-[1.03]'
                  : 'bg-primary-foreground/5 border border-primary-foreground/10 hover:border-accent/30'
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-7 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              )}

              {/* Tier name + hours */}
              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-[0.3em] mb-2 ${tier.highlight ? 'text-accent-foreground/80' : 'text-primary-foreground/65'}`}>
                  {tier.name}
                </p>
                <p className={`font-serif text-[2.6rem] leading-none tracking-tight mb-1 ${tier.highlight ? 'text-accent-foreground' : 'text-primary-foreground'}`}>
                  {tier.monthlyTotal}
                </p>
                <p className={`text-sm font-light ${tier.highlight ? 'text-accent-foreground/80' : 'text-primary-foreground/65'}`}>
                  {tier.hours} · {tier.rate} effective rate
                </p>
              </div>

              {/* Divider */}
              <div className={`h-px mb-6 ${tier.highlight ? 'bg-accent-foreground/15' : 'bg-primary-foreground/10'}`} />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 shrink-0 ${tier.highlight ? 'text-accent-foreground' : 'text-accent'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className={`text-sm font-light leading-snug ${tier.highlight ? 'text-accent-foreground/90' : 'text-primary-foreground/80'}`}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/book-consultation"
                onClick={() =>
                  trackRetainerTierInterest({
                    tierName: tier.name,
                    tierId: tier.name.toLowerCase().replace(/\s+/g, '_'),
                    source: 'pricing_section',
                    price: tier.monthlyTotal,
                  })
                }
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 ${
                  tier.highlight
                    ? 'bg-accent-foreground text-primary hover:bg-accent-foreground/90'
                    : 'border border-primary-foreground/20 text-primary-foreground hover:border-accent/50 hover:text-accent'
                }`}
              >
                Get Started
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>

        {/* Project / Hourly note */}
        <div className="scroll-reveal-hidden mb-10 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-primary-foreground/75 font-light leading-relaxed">
            <span className="text-primary-foreground font-semibold">Need project-based or hourly support?</span>{' '}
            Project engagements start at $95/hr with a defined scope and deliverable. Hourly as-needed billing is available at $95/hr for overflow work without a monthly commitment.{' '}
            <Link href="/book-consultation" className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors">
              Book a free consultation
            </Link>{' '}
            to discuss what fits your firm.
          </p>
        </div>

        {/* View full pricing CTA */}
        <div className="scroll-reveal-hidden mb-14 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-300 border border-primary-foreground/25 text-primary-foreground hover:border-accent/60 hover:text-accent"
          >
            View Full Pricing — Comparison Table, FAQs &amp; More
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Billing notes grid */}
        <div className="scroll-reveal-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BILLING_NOTES.map((note) => (
            <div key={note.label} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 flex flex-col gap-3">
              <span className="text-accent">{note.icon}</span>
              <div>
                <p className="text-sm font-semibold text-primary-foreground mb-1">{note.label}</p>
                <p className="text-xs text-primary-foreground/70 font-light leading-relaxed">{note.detail}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
