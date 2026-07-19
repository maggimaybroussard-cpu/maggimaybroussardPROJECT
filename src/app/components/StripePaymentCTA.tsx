'use client';

import React from 'react';
import Link from 'next/link';

const PAYMENT_OPTIONS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    title: 'Pay Invoice Online',
    description: 'Securely pay your outstanding invoice by card or ACH bank transfer — no login required.',
    href: '/portal/invoices',
    cta: 'Pay Now',
    accent: false,
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Start a Retainer',
    description: 'Reserve your monthly paralegal hours with a secure Stripe subscription. Cancel anytime.',
    href: '/retainer-deposit',
    cta: 'Get Started',
    accent: true,
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Consultation Deposit',
    description: 'Secure your strategy session with a refundable deposit — applied toward your first invoice.',
    href: '/book-consultation',
    cta: 'Book & Pay',
    accent: false,
  },
];

export default function StripePaymentCTA() {
  return (
    <section
      id="stripe-payment"
      className="py-20 md:py-28 bg-background overflow-hidden"
      aria-label="Secure payment options"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              Secure Payments
            </p>
            <h2 className="text-section-heading text-foreground">
              Pay securely,
              <br />
              <span className="italic opacity-60">your way</span>
            </h2>
          </div>
          <p className="text-sm leading-relaxed max-w-xs text-foreground/50 font-light md:text-right">
            All payments processed through Stripe — PCI-compliant, encrypted, and instant.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {PAYMENT_OPTIONS?.map((opt) => (
            <div
              key={opt?.title}
              className={`relative rounded-3xl p-7 flex flex-col gap-5 border transition-all duration-300 ${
                opt?.accent
                  ? 'bg-accent text-white border-accent shadow-xl shadow-accent/20'
                  : 'bg-card border-border hover:border-accent/30 hover:shadow-md'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  opt?.accent ? 'bg-white/15' : 'bg-accent/10 text-accent'
                }`}
              >
                {opt?.icon}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-base mb-2 ${opt?.accent ? 'text-white' : 'text-foreground'}`}>
                  {opt?.title}
                </h3>
                <p className={`text-sm font-light leading-relaxed ${opt?.accent ? 'text-white/75' : 'text-foreground/55'}`}>
                  {opt?.description}
                </p>
              </div>
              <Link
                href={opt?.href}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 self-start ${
                  opt?.accent
                    ? 'bg-white text-accent hover:bg-white/90' :'border border-accent/30 text-accent hover:bg-accent hover:text-white hover:border-accent'
                }`}
              >
                {opt?.cta}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>

        {/* Stripe trust badge */}
        <div className="flex items-center justify-center gap-3 text-foreground/35">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs font-light tracking-wide">
            Payments secured by <span className="font-semibold text-foreground/50">Stripe</span> · 256-bit SSL · PCI DSS Level 1
          </span>
        </div>
      </div>
    </section>
  );
}
