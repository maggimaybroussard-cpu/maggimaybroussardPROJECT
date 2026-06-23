'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How quickly can you turn around a project?',
    answer: (
      <>
        Standard turnaround is <strong>3 business days</strong> for most research memos, document drafts, and summaries. Our{' '}
        <Link href="/pricing" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          Professional and Enterprise retainer packages
        </Link>{' '}
        include priority <strong>24-hour turnaround</strong>. For urgent court deadlines or same-day requests, expedited delivery is available — reach out directly and we will confirm feasibility before committing.
      </>
    ),
  },
  {
    question: 'What are your pricing options?',
    answer: (
      <>
        We offer three tiers to fit any firm's budget and workload. The <strong>Starter package</strong> begins at $750/month for 10 hours of paralegal support. The <strong>Professional package</strong> is $1,500/month for 25 hours with priority turnaround. The <strong>Enterprise package</strong> is $2,800/month for 50+ hours with a dedicated paralegal and same-day availability.{' '}
        <Link href="/pricing" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          View full pricing details →
        </Link>
      </>
    ),
  },
  {
    question: 'How flexible are retainer agreements?',
    answer: (
      <>
        Retainer agreements are month-to-month after the first billing cycle with just <strong>15 days' written notice</strong> to cancel or adjust. There are no long-term contracts or cancellation penalties. You can upgrade, downgrade, or pause your retainer at the start of any new cycle — we want the arrangement to fit your firm's actual workload, not lock you in.{' '}
        <Link href="/pricing" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          Explore retainer options →
        </Link>
      </>
    ),
  },
  {
    question: 'What happens if I go over my retainer hours?',
    answer: (
      <>
        If you exceed your monthly retainer hours, additional time is billed at a <strong>discounted overage rate</strong> — lower than standard hourly billing. You will receive a notification before your hours are exhausted so you can decide whether to continue at the overage rate or defer non-urgent tasks to the next billing cycle. Transparency in billing is a core part of how we operate.
      </>
    ),
  },
  {
    question: 'What does the onboarding process look like?',
    answer: (
      <>
        Onboarding is straightforward and fast. After your{' '}
        <Link href="/book-consultation" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          initial consultation
        </Link>
        , we execute a mutual NDA and engagement agreement. You will receive access to the{' '}
        <Link href="/portal/dashboard" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          client portal
        </Link>{' '}
        for secure document sharing, messaging, and case tracking. Most retainer clients are fully onboarded and receiving work product within <strong>24–48 hours</strong> of signing.
      </>
    ),
  },
  {
    question: 'What types of legal work do you handle?',
    answer: (
      <>
        We support a broad range of paralegal tasks including{' '}
        <Link href="/services#litigation" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          litigation support
        </Link>
        , legal research, document drafting, discovery management, contract review, court filing preparation, client intake coordination, deposition summaries, and estate planning support. We do not provide legal advice or appear in court — all work product is delivered to the supervising attorney.
      </>
    ),
  },
  {
    question: 'Which practice areas do you support?',
    answer: (
      <>
        We have experience across <strong>10+ practice areas</strong> including civil litigation, family law, real estate, business &amp; corporate, employment law, personal injury, criminal defense, immigration, intellectual property, and estate planning. If your practice area is not listed,{' '}
        <Link href="/contact" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          contact us
        </Link>{' '}
        — we are happy to discuss whether our background is a fit for your specific matter type.
      </>
    ),
  },
  {
    question: 'How is confidentiality handled?',
    answer: (
      <>
        All client matters are handled with strict confidentiality. We execute a <strong>mutual NDA</strong> as part of every engagement agreement. Work product is delivered through secure, encrypted channels via the client portal. We do not retain client files beyond the engagement period unless specifically requested. Attorney-client privilege protections and professional ethics standards are maintained at all times.
      </>
    ),
  },
  {
    question: 'Can I work with you on a single project rather than a retainer?',
    answer: (
      <>
        Absolutely. Project-based engagements are available for firms with a single matter, one-time deadline, or unpredictable workloads. You receive a fixed-scope quote with a defined deliverable and timeline — no monthly commitment required. If your needs grow, transitioning to a retainer is seamless.{' '}
        <Link href="/book-consultation" className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity">
          Book a consultation to get a project quote →
        </Link>
      </>
    ),
  },
  {
    question: 'Are your services available nationwide?',
    answer: (
      <>
        Yes. Broussard Legal Services provides <strong>fully remote paralegal support</strong> to law firms and solo attorneys across all 50 states. All communication, document exchange, and deliverables are handled digitally through our secure client portal — no in-person meetings required. We are based in New Orleans, LA, but our clients span the country.
      </>
    ),
  },
];

export default function ServicesFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary mb-4 flex items-center gap-3">
            <span className="w-6 h-px bg-primary" />
            Frequently Asked Questions
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h2 className="text-section-heading text-foreground">
              Questions firms ask
              <br />
              <span className="italic opacity-70">before they engage</span>
            </h2>
            <p className="text-sm leading-relaxed max-w-xs text-muted-foreground">
              Straight answers on turnaround, pricing, retainer flexibility, and how we work — so you can move forward with confidence.
            </p>
          </div>
        </div>

        {/* FAQ Items */}
        <div className="divide-y divide-border">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="group">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-start justify-between gap-6 py-6 text-left hover:text-primary transition-colors duration-200"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`text-base font-semibold leading-snug transition-colors duration-200 ${
                      isOpen ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {item.question}
                  </span>
                  <span
                    className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen
                        ? 'bg-primary text-primary-foreground rotate-45'
                        : 'border border-border text-muted-foreground'
                    }`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="6" y1="1" x2="6" y2="11" />
                      <line x1="1" y1="6" x2="11" y2="6" />
                    </svg>
                  </span>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 pb-6' : 'max-h-0'
                  }`}
                >
                  <p className="text-sm leading-relaxed font-light max-w-3xl text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 pt-10 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold mb-1 text-foreground">Still have questions?</p>
            <p className="text-sm font-light text-muted-foreground">
              We are happy to walk through your firm's specific needs before you commit to anything.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/book-consultation"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-primary/90 transition-all duration-300"
            >
              Book a Free Consultation
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all duration-300"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
