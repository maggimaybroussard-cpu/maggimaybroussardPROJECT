'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { trackPricingPageOpen } from '@/lib/analytics';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface RetainerTier {
  id: string;
  name: string;
  tagline: string;
  price: number;
  hours: number;
  popular?: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
  badge?: string;
  hourlyRate?: number;
  billingPeriod?: string;
  scope?: string;
}

interface FAQ {
  q: string;
  a: string;
}

/* ─── Data ───────────────────────────────────────────────────────────── */
const RETAINER_TIERS: RetainerTier[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Targeted support for focused matters',
    price: 750,
    hours: 10,
    hourlyRate: 75,
    billingPeriod: 'Monthly',
    scope: 'Legal research, document review, memo drafting & email support for solo practitioners and boutique firms.',
    features: [
      { text: '10 hours of paralegal support', included: true },
      { text: 'Legal research & memo drafting', included: true },
      { text: 'Document review & summary', included: true },
      { text: 'Email communication support', included: true },
      { text: '3-business-day turnaround', included: true },
      { text: 'Client portal access', included: true },
      { text: 'Motion & brief drafting', included: false },
      { text: 'Discovery management', included: false },
      { text: 'Priority 24-hr turnaround', included: false },
      { text: 'Deposition prep & summaries', included: false },
    ],
    cta: 'Engage Retainer',
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'The go-to retainer for active firms',
    price: 1500,
    hours: 20,
    hourlyRate: 75,
    billingPeriod: 'Monthly',
    scope: 'Full litigation support including motions, discovery management, and priority turnaround for active multi-matter practices.',
    popular: true,
    badge: 'Most Popular',
    features: [
      { text: '20 hours of paralegal support', included: true },
      { text: 'Legal research & memo drafting', included: true },
      { text: 'Document review & summary', included: true },
      { text: 'Email communication support', included: true },
      { text: 'Priority 24-hr turnaround', included: true },
      { text: 'Client portal access', included: true },
      { text: 'Motion & brief drafting', included: true },
      { text: 'Discovery management', included: true },
      { text: 'Deposition prep & summaries', included: false },
      { text: 'Weekly strategy calls', included: false },
    ],
    cta: 'Engage Retainer',
  },
  {
    id: 'full-service',
    name: 'Full-Service',
    tagline: 'Complete litigation support suite',
    price: 2800,
    hours: 40,
    hourlyRate: 70,
    billingPeriod: 'Monthly',
    scope: 'End-to-end litigation partnership covering research, drafting, discovery, deposition prep, and weekly strategy calls for high-volume firms.',
    features: [
      { text: '40 hours of paralegal support', included: true },
      { text: 'Legal research & memo drafting', included: true },
      { text: 'Document review & summary', included: true },
      { text: 'Email communication support', included: true },
      { text: 'Priority 24-hr turnaround', included: true },
      { text: 'Client portal access', included: true },
      { text: 'Motion & brief drafting', included: true },
      { text: 'Discovery management', included: true },
      { text: 'Deposition prep & summaries', included: true },
      { text: 'Weekly strategy calls', included: true },
    ],
    cta: 'Engage Retainer',
  },
];

const WHAT_IS_INCLUDED = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: 'Legal Research',
    desc: 'Case law, statutory research, and memo drafting on any topic relevant to your matter.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Document Drafting',
    desc: 'Motions, briefs, discovery requests, contracts, and correspondence drafted to your specifications.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Deadline Tracking',
    desc: 'Case timelines, court deadlines, and filing calendars maintained so nothing slips through.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: 'Discovery Management',
    desc: 'Privilege logs, discovery tracking templates, and document organization for complex matters.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Deposition Support',
    desc: 'Deposition summaries, key testimony highlights, and witness preparation outlines.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'Client Portal Access',
    desc: 'Secure portal to view documents, track case status, and communicate on every matter.',
  },
];

const FAQS: FAQ[] = [
  {
    q: 'What happens if I don\'t use all my hours in a month?',
    a: 'Unused hours do not roll over. Each retainer is a monthly commitment for a dedicated block of time. If you consistently use fewer hours, we can discuss adjusting your tier at renewal.',
  },
  {
    q: 'Can I upgrade or downgrade my retainer tier?',
    a: 'Yes. You can change your tier at the start of any new billing cycle. Just reach out before your renewal date and we\'ll adjust your plan accordingly.',
  },
  {
    q: 'What if I need more hours than my retainer includes?',
    a: 'Overage hours are billed at $85/hour. You\'ll always be notified before any overage charges are applied so there are no surprises on your invoice.',
  },
  {
    q: 'How quickly can I get started after signing up?',
    a: 'Once your retainer agreement is signed and payment is processed, you\'ll receive onboarding details within one business day and can begin submitting work requests immediately.',
  },
  {
    q: 'Is there a minimum commitment period?',
    a: 'Retainers are billed monthly with no long-term lock-in. You may cancel with 30 days\' written notice before your next billing cycle.',
  },
  {
    q: 'What types of matters do you support?',
    a: 'Civil litigation, contract matters, family law, real estate, employment, and general legal research. If you have a specialized practice area, reach out — we can discuss fit before you commit.',
  },
  {
    q: 'How is payment handled?',
    a: 'Payment is processed securely via Stripe at the start of each billing cycle. You\'ll receive a detailed invoice via email for every transaction.',
  },
  {
    q: 'Do you work with solo attorneys or only larger firms?',
    a: 'Both. The Essential tier is designed with solo practitioners in mind. The Standard and Full-Service tiers scale well for multi-attorney firms with higher-volume needs.',
  },
];

const TRUST_ITEMS = [
  { icon: '🔒', label: 'SSL Encrypted Payments' },
  { icon: '⚡', label: 'Instant Confirmation' },
  { icon: '✅', label: 'Secured by Stripe' },
  { icon: '📄', label: 'Invoice Emailed' },
  { icon: '🔄', label: 'Cancel Anytime' },
];

/* ─── Payment Options Data ───────────────────────────────────────────── */
const PAYMENT_OPTIONS = [
  {
    id: 'card',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    title: 'Credit or Debit Card',
    subtitle: 'Visa, Mastercard, Amex, Discover',
    desc: 'Pay instantly with any major credit or debit card. Your card is charged at the start of each billing cycle. Receipts emailed automatically.',
    badge: 'Most Common',
    badgeColor: '#355E3B',
    highlight: true,
    details: ['Instant processing', 'Auto-renews monthly', 'Detailed invoice emailed', 'Cancel anytime'],
  },
  {
    id: 'ach',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h2" />
        <path d="M10 15h4" />
      </svg>
    ),
    title: 'ACH Bank Transfer',
    subtitle: 'Direct bank-to-bank payment',
    desc: 'Connect your business checking account for direct ACH transfers. Lower processing fees, ideal for firms paying from a trust or operating account.',
    badge: 'Lower Fees',
    badgeColor: '#C8965A',
    highlight: false,
    details: ['3–5 business day processing', 'Lower transaction fees', 'Ideal for business accounts', 'Secure bank-level encryption'],
  },
  {
    id: 'installment',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Installment Plan',
    subtitle: 'Split into 2 payments',
    desc: 'Split your monthly retainer into two equal payments — due on the 1st and 15th of each month. Available for Standard and Full-Service tiers.',
    badge: 'Flexible',
    badgeColor: '#355E3B',
    highlight: false,
    details: ['2 equal payments per month', 'Standard & Full-Service only', 'No additional fees', 'Contact us to set up'],
  },
];

const VALUE_PROPS = [
  {
    stat: '24hr',
    label: 'Priority Turnaround',
    desc: 'Standard & Full-Service clients receive deliverables within one business day — no chasing, no delays.',
    accent: '#355E3B',
  },
  {
    stat: '$0',
    label: 'Hidden Fees',
    desc: 'Your monthly invoice reflects exactly what you signed up for. Overage is always pre-approved before it applies.',
    accent: '#C8965A',
  },
  {
    stat: '30-day',
    label: 'Cancel Policy',
    desc: 'No long-term lock-in. Give 30 days\' written notice before your next billing cycle and you\'re done.',
    accent: '#355E3B',
  },
  {
    stat: '1 day',
    label: 'Onboarding Speed',
    desc: 'Portal credentials and your onboarding packet land in your inbox within one business day of signing.',
    accent: '#C8965A',
  },
  {
    stat: '100%',
    label: 'Remote & Secure',
    desc: 'All work delivered through an encrypted client portal. Documents, messages, and invoices — one secure place.',
    accent: '#355E3B',
  },
  {
    stat: 'Bar-ready',
    label: 'Work Product',
    desc: 'Every deliverable is formatted to your jurisdiction\'s court rules and ready for attorney review and filing.',
    accent: '#C8965A',
  },
];

const SERVICE_BUNDLES = [
  {
    name: 'Deposition Bundle',
    price: '$350',
    unit: 'per deposition',
    desc: 'Full deposition support from prep through summary — ideal for firms without a retainer or needing surge capacity.',
    includes: [
      'Witness background research',
      'Deposition outline & question bank',
      'Real-time exhibit indexing',
      'Condensed deposition summary',
      'Key testimony highlights memo',
    ],
    tag: 'One-Time',
    tagColor: '#C8965A',
  },
  {
    name: 'Motion Package',
    price: '$400–$700',
    unit: 'per motion',
    desc: 'Research-backed motion drafting with table of contents, authorities, and court-rule formatting included.',
    includes: [
      'Case law & statutory research',
      'Motion drafting (MSJ, MTD, MIL)',
      'Supporting memorandum of law',
      'Table of contents & authorities',
      'Cite-check & court-rule formatting',
    ],
    tag: 'One-Time',
    tagColor: '#C8965A',
  },
  {
    name: 'Discovery Sprint',
    price: '$500',
    unit: 'flat rate',
    desc: 'A focused two-week engagement to get discovery organized, logged, and calendared for complex matters.',
    includes: [
      'Interrogatory & RFP/RFA tracking',
      'Privilege log setup & maintenance',
      'Bates stamping & document index',
      'Discovery deadline calendar',
      'Status report at close of sprint',
    ],
    tag: 'Project-Based',
    tagColor: '#355E3B',
  },
];

/* ─── FAQ Accordion ──────────────────────────────────────────────────── */
function FAQAccordion({ faqs }: { faqs: FAQ[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div
          key={i}
          className="rounded-2xl border overflow-hidden transition-all duration-200"
          style={{
            borderColor: openIndex === i ? 'rgba(53,94,59,0.3)' : 'var(--border)',
            background: openIndex === i ? 'rgba(53,94,59,0.02)' : 'var(--background)',
          }}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className="text-sm font-semibold text-foreground leading-snug">{faq.q}</span>
            <span
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                background: openIndex === i ? '#355E3B' : 'rgba(53,94,59,0.08)',
                color: openIndex === i ? '#fff' : '#355E3B',
                transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
          {openIndex === i && (
            <div className="px-6 pb-5">
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function PricingPageClient() {
  useEffect(() => {
    trackPricingPageOpen();
  }, []);

  return (
    <main className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <section
        className="pt-24 md:pt-32 pb-20 md:pb-28 px-5 md:px-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 60%, #4a7c52 100%)' }}
      >
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #C8965A, transparent)', transform: 'translate(35%, -35%)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #C8965A, transparent)', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #C8965A 0, #C8965A 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />

        <div className="max-w-5xl mx-auto relative text-center">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(200,150,90,0.2)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.3)' }}
          >
            Retainer Pricing
          </span>
          <h1 className="font-serif text-4xl md:text-6xl text-white leading-tight mb-5">
            Dedicated Paralegal Support,
            <br />
            <span className="italic" style={{ color: '#C8965A' }}>Billed Monthly</span>
          </h1>
          <p className="text-white/70 text-lg font-light leading-relaxed max-w-2xl mx-auto mb-10">
            Three retainer tiers built for how law firms actually work — from targeted single-matter support to a full-service litigation partnership. No hidden fees. No surprises.
          </p>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {TRUST_ITEMS.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <span>{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Tiers ── */}
      <section className="py-20 md:py-28 px-5 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Choose Your Retainer</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              All tiers include a dedicated block of hours each month, client portal access, and a detailed invoice on every billing cycle.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {RETAINER_TIERS.map((tier) => (
              <div
                key={tier.id}
                className="relative rounded-3xl flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  border: tier.popular ? '2px solid #355E3B' : '1px solid var(--border)',
                  background: tier.popular ? 'linear-gradient(160deg, rgba(53,94,59,0.04) 0%, rgba(53,94,59,0.01) 100%)' : 'var(--background)',
                  boxShadow: tier.popular ? '0 8px 40px rgba(53,94,59,0.12)' : '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                {/* Popular badge */}
                {tier.popular && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="p-7 md:p-8 flex flex-col flex-1">
                  {/* Header */}
                  <div className="mb-6">
                    <h3 className="font-serif text-2xl text-foreground mb-1">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground font-light">{tier.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-end gap-2">
                      <span className="font-serif text-5xl font-semibold" style={{ color: '#355E3B' }}>
                        ${tier.price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground font-light text-sm mb-2">/month</span>
                    </div>
                    {/* Key retainer details: hours, hourly rate, billing period */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3">
                      <div
                        className="rounded-xl px-2 py-2 text-center"
                        style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.1)' }}
                      >
                        <p className="text-xs font-bold truncate" style={{ color: '#355E3B' }}>{tier.hours} hrs</p>
                        <p className="text-[10px] text-muted-foreground font-light mt-0.5 hidden sm:block">per month</p>
                      </div>
                      <div
                        className="rounded-xl px-2 py-2 text-center"
                        style={{ background: 'rgba(200,150,90,0.08)', border: '1px solid rgba(200,150,90,0.15)' }}
                      >
                        <p className="text-xs font-bold truncate" style={{ color: '#C8965A' }}>${tier.hourlyRate}/hr</p>
                        <p className="text-[10px] text-muted-foreground font-light mt-0.5 hidden sm:block">hourly rate</p>
                      </div>
                      <div
                        className="rounded-xl px-2 py-2 text-center"
                        style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.1)' }}
                      >
                        <p className="text-xs font-bold truncate" style={{ color: '#355E3B' }}>{tier.billingPeriod}</p>
                        <p className="text-[10px] text-muted-foreground font-light mt-0.5 hidden sm:block">billing</p>
                      </div>
                    </div>
                  </div>

                  {/* Scope of services */}
                  <div
                    className="rounded-xl px-4 py-3 mb-5"
                    style={{ background: 'rgba(53,94,59,0.04)', border: '1px solid rgba(53,94,59,0.08)' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#355E3B' }}>Scope of Services</p>
                    <p className="text-xs text-muted-foreground font-light leading-relaxed">{tier.scope}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                          style={{
                            background: f.included ? 'rgba(53,94,59,0.1)' : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          {f.included ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                        </span>
                        <span
                          className="text-sm font-light leading-snug"
                          style={{ color: f.included ? 'var(--foreground)' : '#9ca3af' }}
                        >
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA — direct link to Stripe checkout */}
                  <Link
                    href={`/retainer-payment?tier=${tier.id}&price=${tier.price}&hours=${tier.hours}&name=${encodeURIComponent(tier.name)}`}
                    className="w-full py-4 rounded-full text-sm font-semibold uppercase tracking-widest text-center transition-all duration-200 hover:opacity-90 hover:shadow-lg flex items-center justify-center gap-2"
                    style={
                      tier.popular
                        ? { background: '#355E3B', color: '#fff' }
                        : { background: 'transparent', color: '#355E3B', border: '2px solid #355E3B' }
                    }
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    {tier.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Overage note */}
          <p className="text-center text-sm text-muted-foreground font-light mt-8">
            Need more hours? Overage billed at <strong className="font-semibold text-foreground">$85/hr</strong> — you&apos;ll always be notified before any overage applies.
            <Link href="/contact" className="ml-2 underline underline-offset-2 hover:text-foreground transition-colors" style={{ color: '#355E3B' }}>
              Need a custom arrangement?
            </Link>
          </p>
        </div>
      </section>

      {/* ── Payment Options ── */}
      <section
        className="py-20 md:py-24 px-5 md:px-10"
        style={{ background: 'rgba(53,94,59,0.025)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(200,150,90,0.1)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.2)' }}
            >
              How to Pay
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Payment Options</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              Choose the payment method that works best for your firm. All options are processed securely through Stripe — no account required to pay by card.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {PAYMENT_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                className="rounded-3xl flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  border: opt.highlight ? '2px solid #355E3B' : '1px solid var(--border)',
                  background: opt.highlight
                    ? 'linear-gradient(160deg, rgba(53,94,59,0.05) 0%, rgba(53,94,59,0.01) 100%)'
                    : 'var(--background)',
                  boxShadow: opt.highlight ? '0 8px 40px rgba(53,94,59,0.1)' : '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <div className="p-7 md:p-8 flex flex-col flex-1">
                  {/* Icon + badge row */}
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
                    >
                      {opt.icon}
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                      style={{
                        background: `${opt.badgeColor}18`,
                        color: opt.badgeColor,
                        border: `1px solid ${opt.badgeColor}30`,
                      }}
                    >
                      {opt.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-xl font-bold text-foreground mb-1">{opt.title}</h3>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#C8965A' }}>{opt.subtitle}</p>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6 flex-1">{opt.desc}</p>

                  {/* Detail bullets */}
                  <ul className="space-y-2 mb-7">
                    {opt.details.map((d) => (
                      <li key={d} className="flex items-center gap-2.5 text-sm text-muted-foreground font-light">
                        <span
                          className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(53,94,59,0.1)' }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {d}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {opt.id === 'installment' ? (
                    <Link
                      href="/contact"
                      className="w-full py-3.5 rounded-full text-xs font-semibold uppercase tracking-widest text-center transition-all duration-200 hover:opacity-90 border"
                      style={{ borderColor: 'rgba(53,94,59,0.35)', color: '#355E3B' }}
                    >
                      Contact Us to Set Up
                    </Link>
                  ) : (
                    <Link
                      href="/retainer-payment"
                      className="w-full py-3.5 rounded-full text-xs font-semibold uppercase tracking-widest text-center transition-all duration-200 hover:opacity-90 hover:shadow-md flex items-center justify-center gap-2"
                      style={
                        opt.highlight
                          ? { background: '#355E3B', color: '#fff' }
                          : { background: 'rgba(53,94,59,0.08)', color: '#355E3B' }
                      }
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      Pay with {opt.id === 'card' ? 'Card' : 'ACH'}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Security strip */}
          <div
            className="mt-10 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">All payments secured by Stripe</p>
                <p className="text-xs text-muted-foreground font-light">256-bit SSL encryption · PCI DSS Level 1 compliant · No card data stored on our servers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {['Visa', 'MC', 'Amex', 'ACH'].map((brand) => (
                <span
                  key={brand}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(53,94,59,0.06)', color: '#355E3B', border: '1px solid rgba(53,94,59,0.12)' }}
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Props ── */}
      <section className="py-20 md:py-24 px-5 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B', border: '1px solid rgba(53,94,59,0.2)' }}
            >
              Why Broussard Legal Services
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">What Sets This Apart</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              Concrete commitments — not marketing language. Here&apos;s exactly what you can expect when you engage a retainer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUE_PROPS.map((vp, i) => (
              <div
                key={i}
                className="rounded-2xl p-7 border flex flex-col gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div
                  className="text-3xl font-serif font-bold leading-none"
                  style={{ color: vp.accent }}
                >
                  {vp.stat}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base mb-1">{vp.label}</h3>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{vp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's Included ── */}
      <section
        className="py-20 md:py-24 px-5 md:px-10"
        style={{ background: 'rgba(53,94,59,0.03)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(200,150,90,0.1)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.2)' }}
            >
              What You Get
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Every Retainer Includes</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              Core services available across all tiers — higher tiers unlock more hours and advanced capabilities.
            </p>
          </div>

          {/* Asymmetric bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHAT_IS_INCLUDED.map((item, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 md:p-7 border transition-all duration-200 hover:shadow-md ${i === 0 ? 'lg:col-span-2' : ''}`}
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
                >
                  {item.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Bundles ── */}
      <section className="py-20 md:py-24 px-5 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(200,150,90,0.1)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.2)' }}
            >
              Project-Based Work
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Service Bundles</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              Not ready for a monthly retainer? These fixed-scope bundles let you engage for a single matter or surge period — no ongoing commitment required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {SERVICE_BUNDLES.map((bundle) => (
              <div
                key={bundle.name}
                className="rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div className="h-1 w-full" style={{ background: bundle.tagColor }} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span
                        className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2"
                        style={{ background: `${bundle.tagColor}18`, color: bundle.tagColor, border: `1px solid ${bundle.tagColor}30` }}
                      >
                        {bundle.tag}
                      </span>
                      <h3 className="font-serif text-xl font-bold text-foreground leading-snug">{bundle.name}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-serif text-2xl font-bold" style={{ color: bundle.tagColor }}>{bundle.price}</div>
                      <div className="text-[11px] text-muted-foreground font-light">{bundle.unit}</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground font-light leading-relaxed mb-5">{bundle.desc}</p>

                  <ul className="space-y-2 mb-6 flex-1">
                    {bundle.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground font-light">
                        <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={bundle.tagColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/contact"
                    className="w-full py-3 rounded-xl text-xs font-semibold uppercase tracking-widest text-center transition-all duration-200 hover:opacity-90"
                    style={{ background: bundle.tagColor, color: '#fff' }}
                  >
                    Inquire About This Bundle
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground font-light mt-8">
            Bundle pricing is fixed-scope. Custom project quotes available —{' '}
            <Link href="/contact" className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#355E3B' }}>
              contact us for a free scope review
            </Link>.
          </p>
        </div>
      </section>

      {/* ── Specialty Services ── */}
      <section className="py-20 md:py-24 px-5 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B', border: '1px solid rgba(53,94,59,0.2)' }}
            >
              Specialty Services
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Advanced Litigation Support</h2>
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              Three specialized service areas available as standalone engagements or included in Standard &amp; Full-Service retainers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Discovery Management & Privilege Logs',
                tier: 'Standard & Full-Service',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                ),
                features: [
                  'Interrogatory, RFP & RFA tracking',
                  'Privilege log preparation & maintenance',
                  'Bates stamping & document indexing',
                  'Discovery deadline calendaring',
                  'Discovery status reports',
                ],
                standalone: '$150–$400 per project',
                contractHref: '/contracts',
                logHref: '/log-formats',
              },
              {
                title: 'Legal Research & Memo Drafting',
                tier: 'All Tiers',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                ),
                features: [
                  'Federal & state case law research',
                  'Statutory & regulatory research',
                  'Legal memoranda drafting',
                  'Shepardizing / KeyCiting authorities',
                  'Jurisdiction-specific analysis',
                ],
                standalone: '$85/hr or flat fee by project',
                contractHref: '/contracts',
                logHref: '/log-formats',
              },
              {
                title: 'Motion & Brief Drafting',
                tier: 'Standard & Full-Service',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                ),
                features: [
                  'Motions to dismiss, summary judgment, in limine',
                  'Supporting memoranda of law',
                  'Opposition & reply briefs',
                  'Table of contents & authorities',
                  'Court-rule formatting & cite-checking',
                ],
                standalone: '$200–$600 per document',
                contractHref: '/contracts',
                logHref: '/log-formats',
              },
            ].map((svc) => (
              <div
                key={svc.title}
                className="rounded-2xl border overflow-hidden flex flex-col"
                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div className="h-1 w-full" style={{ background: '#355E3B' }} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}>
                    {svc.icon}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C8965A' }}>{svc.tier}</span>
                  <h3 className="font-serif text-lg font-bold text-foreground mb-3 leading-snug">{svc.title}</h3>
                  <ul className="space-y-2 mb-5 flex-1">
                    {svc.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-light">
                        <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs text-muted-foreground mb-3">
                      <span className="font-semibold text-foreground">Standalone rate:</span> {svc.standalone}
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href={svc.contractHref}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest text-center transition-all duration-200"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        View Contract
                      </Link>
                      <Link
                        href={svc.logHref}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest text-center transition-all duration-200 border"
                        style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B' }}
                      >
                        Log Formats
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 md:py-24 px-5 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">How Retainers Work</h2>
            <p className="text-muted-foreground font-light max-w-lg mx-auto">
              From sign-up to first deliverable in under 24 hours.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Choose Your Tier', desc: 'Select the retainer that matches your firm\'s monthly workload and click to begin.' },
              { step: '02', title: 'Sign & Pay', desc: 'Review the retainer agreement, confirm your billing details, and pay securely via Stripe.' },
              { step: '03', title: 'Onboarding', desc: 'Receive your client portal credentials and onboarding packet within one business day.' },
              { step: '04', title: 'Submit Work', desc: 'Start sending research requests, documents, and tasks — tracked and delivered on time.' },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 font-mono text-sm font-bold"
                  style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
                >
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm">{s.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section
        className="py-20 md:py-24 px-5 md:px-10"
        style={{ background: 'rgba(53,94,59,0.02)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Side-by-Side Comparison</h2>
            <p className="text-muted-foreground font-light">See exactly what each tier includes.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#355E3B' }}>
                  <th className="text-left px-6 py-4 font-semibold text-white/80 text-xs uppercase tracking-widest">Feature</th>
                  {RETAINER_TIERS.map((t) => (
                    <th key={t.id} className="px-6 py-4 font-semibold text-white text-center">
                      <div>{t.name}</div>
                      <div className="text-white/60 font-normal text-xs mt-0.5">${t.price.toLocaleString()}/mo · {t.hours}hrs</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Monthly Hours', values: ['10 hrs', '20 hrs', '40 hrs'] },
                  { label: 'Effective Hourly Rate', values: ['$75/hr', '$75/hr', '$70/hr'] },
                  { label: 'Legal Research & Memos', values: [true, true, true] },
                  { label: 'Document Review', values: [true, true, true] },
                  { label: 'Client Portal Access', values: [true, true, true] },
                  { label: 'Motion & Brief Drafting', values: [false, true, true] },
                  { label: 'Discovery Management', values: [false, true, true] },
                  { label: 'Priority 24-hr Turnaround', values: [false, true, true] },
                  { label: 'Deposition Prep & Summaries', values: [false, false, true] },
                  { label: 'Weekly Strategy Calls', values: [false, false, true] },
                  { label: 'Overage Rate', values: ['$85/hr', '$85/hr', '$85/hr'] },
                ].map((row, i) => (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? 'var(--background)' : 'rgba(53,94,59,0.02)' }}
                  >
                    <td className="px-6 py-4 font-medium text-foreground">{row.label}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className="px-6 py-4 text-center">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: 'rgba(53,94,59,0.1)' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground font-light">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section className="py-20 md:py-28 px-5 md:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(200,150,90,0.1)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.2)' }}
            >
              Common Questions
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground font-light">
              Everything you need to know before committing to a retainer.
            </p>
          </div>

          <FAQAccordion faqs={FAQS} />

          <p className="text-center text-sm text-muted-foreground font-light mt-10">
            Still have questions?{' '}
            <Link href="/contact" className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#355E3B' }}>
              Reach out directly
            </Link>{' '}
            — I respond within one business day.
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        className="py-20 md:py-24 px-5 md:px-10"
        style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 60%, #4a7c52 100%)' }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(200,150,90,0.2)', color: '#C8965A', border: '1px solid rgba(200,150,90,0.3)' }}
          >
            Ready to Start?
          </span>
          <h2 className="font-serif text-3xl md:text-5xl text-white mb-5 leading-tight">
            Pick Your Retainer &amp;
            <br />
            <span className="italic" style={{ color: '#C8965A' }}>Get Started Today</span>
          </h2>
          <p className="text-white/70 text-lg font-light leading-relaxed max-w-xl mx-auto mb-10">
            Secure your monthly block of paralegal support. Cancel anytime with 30 days&apos; notice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {RETAINER_TIERS.map((tier) => (
              <Link
                key={tier.id}
                href={`/retainer-payment?tier=${tier.id}&price=${tier.price}&hours=${tier.hours}&name=${encodeURIComponent(tier.name)}`}
                className="px-6 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 hover:shadow-lg flex items-center gap-2"
                style={
                  tier.popular
                    ? { background: '#C8965A', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }
                }
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Engage {tier.name} — ${tier.price.toLocaleString()}/mo
              </Link>
            ))}
          </div>

          <p className="text-white/50 text-xs font-light mt-8">
            Not sure which tier fits? <Link href="/contact" className="underline underline-offset-2 text-white/70 hover:text-white transition-colors">Book a free 15-min call</Link> and we&apos;ll figure it out together.
          </p>
        </div>
      </section>

    </main>
  );
}