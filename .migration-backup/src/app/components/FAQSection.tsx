'use client';

import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface FAQSectionProps {
  variant?: 'light' | 'dark';
}

const FAQ_ITEMS: FAQItem[] = [
  // Engagement Models
  {
    category: 'Engagement Models',
    question: 'What engagement models do you offer?',
    answer:
      'I offer three primary engagement models: project-based (a fixed scope with a defined deliverable and timeline), monthly retainer (a set number of hours reserved each month for ongoing support), and hourly/as-needed (flexible billing for sporadic or unpredictable workloads). Custom hybrid arrangements are also available for firms with unique needs.',
  },
  {
    category: 'Engagement Models',
    question: 'Which engagement model is right for my firm?',
    answer:
      'If you have a single matter or a one-time deadline, a project-based engagement is the most cost-effective. If your firm has recurring paralegal needs — research, drafting, case management — a monthly retainer ensures priority availability and predictable costs. Hourly billing works best for firms that need occasional overflow support without a long-term commitment.',
  },
  {
    category: 'Engagement Models',
    question: 'Can I switch between engagement models?',
    answer:
      'Yes. If your workload changes, we can transition between models at the start of any new billing cycle. There is no penalty for adjusting your engagement structure — I want the arrangement to fit your firm\'s actual needs, not lock you into something that no longer serves you.',
  },
  // Timelines
  {
    category: 'Timelines',
    question: 'How quickly can you start on a new matter?',
    answer:
      'For retainer clients, I can typically begin work within 24 hours of receiving a new assignment. For project-based engagements, onboarding usually takes 24–48 hours after the agreement is signed. If you have an urgent deadline, reach out directly — I accommodate expedited requests when capacity allows.',
  },
  {
    category: 'Timelines',
    question: 'What are your standard turnaround times?',
    answer:
      'Standard turnaround is 3 business days for most research memos, document drafts, and summaries. The Professional and Enterprise packages include priority 24-hour turnaround. Complex multi-issue research or large document sets may require additional time, which I will communicate upfront before beginning work.',
  },
  {
    category: 'Timelines',
    question: 'Do you handle rush or same-day requests?',
    answer:
      'Rush requests are accommodated based on current availability and are subject to an expedite fee. Same-day delivery is available for shorter tasks (under 2–3 hours of work). I will always confirm feasibility before committing to a rush timeline so you can plan accordingly.',
  },
  // Retainer Terms
  {
    category: 'Retainer Terms',
    question: 'How does the monthly retainer work?',
    answer:
      'Retainer packages reserve a block of paralegal hours each month at a flat rate. Hours are tracked and reported transparently. Unused hours do not roll over to the following month, but retainer clients receive priority scheduling and a reduced effective hourly rate compared to project or hourly billing.',
  },
  {
    category: 'Retainer Terms',
    question: 'What happens if I exceed my retainer hours?',
    answer:
      'If you exceed your monthly retainer hours, additional time is billed at a discounted overage rate (lower than standard hourly). You will be notified before hours are exhausted so you can decide whether to continue at the overage rate or defer non-urgent tasks to the next cycle.',
  },
  {
    category: 'Retainer Terms',
    question: 'Is there a minimum commitment for retainer agreements?',
    answer:
      'Retainer agreements have a one-month minimum. After the first month, they renew month-to-month with 15 days\' written notice required to cancel or downgrade. There are no long-term contracts or cancellation penalties beyond the notice period.',
  },
  // Service Scope
  {
    category: 'Service Scope',
    question: 'What types of legal work do you handle?',
    answer:
      'I support litigation, transactional, and research-heavy matters. This includes legal research memos, motion and brief drafting, discovery management, privilege log preparation, deposition summaries, contract review and redlining, case timeline tracking, and client intake coordination. I do not provide legal advice or appear in court.',
  },
  {
    category: 'Service Scope',
    question: 'Do you work across practice areas?',
    answer:
      'Yes. I have experience supporting civil litigation, family law, employment, real estate, business/commercial matters, and personal injury. If your practice area is not listed, reach out — I am happy to discuss whether my background is a fit for your specific matter type.',
  },
  {
    category: 'Service Scope',
    question: 'How do you handle confidentiality?',
    answer:
      'All client matters are handled with strict confidentiality. I execute a mutual NDA as part of every engagement agreement. Work product is delivered through secure channels, and I do not retain client files beyond the engagement period unless specifically requested. Professional ethics and attorney-client privilege protections are taken seriously.',
  },
];

const CATEGORIES = ['Engagement Models', 'Timelines', 'Retainer Terms', 'Service Scope'];

export default function FAQSection({ variant = 'light' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Engagement Models');

  const filtered = FAQ_ITEMS.filter((item) => item.category === activeCategory);

  const isDark = variant === 'dark';

  return (
    <section
      className={`py-16 md:py-28 ${isDark ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.35em] mb-4 flex items-center gap-3 ${
              isDark ? 'text-accent' : 'text-primary'
            }`}
          >
            <span className={`w-6 h-px ${isDark ? 'bg-accent' : 'bg-primary'}`} />
            Common Questions
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h2
              className={`text-section-heading ${
                isDark ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              Before you reach out,
              <br />
              <span className="italic opacity-70">here are the answers</span>
            </h2>
            <p
              className={`text-sm leading-relaxed max-w-xs ${
                isDark ? 'text-primary-foreground/60' : 'text-muted-foreground'
              }`}
            >
              Straight answers to the questions firms ask before engaging a contract paralegal.
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setOpenIndex(null);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                activeCategory === cat
                  ? isDark
                    ? 'bg-accent text-primary' :'bg-primary text-primary-foreground'
                  : isDark
                  ? 'border border-primary-foreground/20 text-primary-foreground/60 hover:border-accent/50 hover:text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div
          className={`divide-y ${
            isDark ? 'divide-primary-foreground/10' : 'divide-border'
          }`}
        >
          {filtered.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="group">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className={`w-full flex items-start justify-between gap-6 py-6 text-left transition-colors duration-200 ${
                    isDark
                      ? 'hover:text-accent' :'hover:text-primary'
                  }`}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`text-base font-semibold leading-snug transition-colors duration-200 ${
                      isOpen
                        ? isDark
                          ? 'text-accent' :'text-primary'
                        : isDark
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.question}
                  </span>
                  <span
                    className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen
                        ? isDark
                          ? 'bg-accent text-primary rotate-45' :'bg-primary text-primary-foreground rotate-45'
                        : isDark
                        ? 'border border-primary-foreground/20 text-primary-foreground/50'
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
                  <p
                    className={`text-sm leading-relaxed font-light max-w-3xl ${
                      isDark ? 'text-primary-foreground/65' : 'text-muted-foreground'
                    }`}
                  >
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div
          className={`mt-14 pt-10 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
            isDark ? 'border-primary-foreground/10' : 'border-border'
          }`}
        >
          <div>
            <p
              className={`text-sm font-semibold mb-1 ${
                isDark ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              Still have questions?
            </p>
            <p
              className={`text-sm font-light ${
                isDark ? 'text-primary-foreground/55' : 'text-muted-foreground'
              }`}
            >
              Reach out directly — I respond within one business day.
            </p>
          </div>
          <a
            href="/contact"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
              isDark
                ? 'bg-accent text-primary hover:opacity-90' :'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            Contact Me
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
