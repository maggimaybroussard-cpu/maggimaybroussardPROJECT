'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Feature {
  title: string;
  description: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
  cta: string;
  category: string;
}

const features: Feature[] = [
  {
    category: 'Client Portal',
    title: 'Client Portal Login',
    description: 'Secure client login to access case status, documents, invoices, and messages — all in one place.',
    href: '/portal/login',
    badge: 'Secure',
    cta: 'Access Portal',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    category: 'Client Portal',
    title: 'Online Intake Form',
    description: 'Structured questionnaire to qualify leads and gather matter details before your consultation.',
    href: '/intake',
    badge: 'Quick',
    cta: 'Start Intake',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    category: 'Scheduling',
    title: 'Appointment Booking',
    description: 'Book a consultation or strategy session directly via Calendly — no back-and-forth emails.',
    href: '/book-consultation',
    badge: 'Live',
    cta: 'Book Now',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    category: 'Billing',
    title: 'Online Payments',
    description: 'Pay invoices, retainer deposits, and consultation fees securely via Stripe — cards and ACH accepted.',
    href: '/checkout',
    badge: 'Stripe',
    cta: 'Make a Payment',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    category: 'Billing',
    title: 'Retainer Agreement E-Sign',
    description: 'Review and digitally sign your retainer agreement before onboarding — no printing required.',
    href: '/retainer-contract',
    badge: 'E-Sign',
    cta: 'Sign Agreement',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    category: 'Legal Tools',
    title: 'Lexi Document Drafter',
    description: 'AI-powered document generation — demand letters, NDAs, intake summaries, and more on command.',
    href: '/legal-assistant',
    badge: 'AI',
    cta: 'Draft a Document',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M9.5 12.5 11 14l3.5-3.5"/>
      </svg>
    ),
  },
  {
    category: 'Legal Tools',
    title: 'Case Timeline Visualizer',
    description: 'Visual timeline of your matter — milestones, documents, payments, and messages in chronological order.',
    href: '/portal/dashboard',
    badge: 'Visual',
    cta: 'View Timeline',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    category: 'Resources',
    title: 'Legal Blog & Resource Center',
    description: 'Plain-language legal articles, paralegal tips, and jurisdiction-specific guides for attorneys.',
    href: '/blog',
    badge: 'SEO',
    cta: 'Read Articles',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    category: 'Resources',
    title: 'Testimonials & Reviews',
    description: 'Read reviews from attorneys and law firms — and submit your own experience working with Maggi May.',
    href: '/testimonials',
    badge: '5.0 ★',
    cta: 'Read Reviews',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    category: 'Marketing',
    title: 'Newsletter Signup',
    description: 'Subscribe for legal updates, paralegal tips, and firm news delivered to your inbox.',
    href: '/#newsletter',
    badge: 'Free',
    cta: 'Subscribe',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    category: 'Admin & Billing',
    title: 'Invoice Generator',
    description: 'Create and send branded invoices from the admin panel — line items, taxes, and Stripe sync included.',
    href: '/admin',
    badge: 'Admin',
    cta: 'Generate Invoice',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    category: 'Admin & Billing',
    title: 'Document Vault',
    description: 'Secure file uploads and storage per client matter — contracts, intake docs, and case files organized by category.',
    href: '/portal/documents',
    badge: 'Secure',
    cta: 'Open Vault',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    category: 'Admin & Billing',
    title: 'Analytics Dashboard',
    description: 'Unified view of GA4, Mixpanel, Stripe, and Supabase data — KPIs, conversion funnels, and growth metrics.',
    href: '/admin/analytics',
    badge: 'Admin',
    cta: 'View Analytics',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
];

const CATEGORIES = ['Client Portal', 'Scheduling', 'Billing', 'Legal Tools', 'Resources', 'Marketing', 'Admin & Billing'];

const BADGE_COLORS: Record<string, string> = {
  'Secure': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Quick': 'bg-blue-50 text-blue-700 border-blue-200',
  'Live': 'bg-green-50 text-green-700 border-green-200',
  'Stripe': 'bg-violet-50 text-violet-700 border-violet-200',
  'E-Sign': 'bg-amber-50 text-amber-700 border-amber-200',
  'AI': 'bg-rose-50 text-rose-700 border-rose-200',
  'Visual': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'SEO': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '5.0 ★': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Free': 'bg-teal-50 text-teal-700 border-teal-200',
  'Admin': 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function FeaturesPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-32 pb-16 md:pt-44 md:pb-24 px-5 md:px-10 bg-gradient-to-b from-secondary to-background">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Platform Features
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary mb-5 leading-tight">
              Everything you need,
              <br />
              <span className="italic opacity-70">all in one place</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              From client intake to invoice generation — Broussard Legal Services gives you a complete legal operations platform built for modern law practices.
            </p>
          </div>
        </section>

        {/* Features by Category */}
        <section className="py-16 md:py-24 px-5 md:px-10">
          <div className="max-w-7xl mx-auto space-y-20">
            {CATEGORIES.map((category) => {
              const categoryFeatures = features.filter((f) => f.category === category);
              if (categoryFeatures.length === 0) return null;
              return (
                <div key={category}>
                  <div className="mb-8 md:mb-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent mb-3 flex items-center gap-3">
                      <span className="w-5 h-px bg-accent" />
                      {category}
                    </p>
                    <div className="h-px bg-border" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                    {categoryFeatures.map((feature) => (
                      <Link
                        key={feature.title}
                        href={feature.href}
                        className="group bg-card border border-border rounded-2xl p-7 md:p-8 flex flex-col hover:border-accent/40 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-start justify-between mb-5">
                          <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center text-primary group-hover:bg-accent/10 group-hover:text-accent transition-colors duration-300">
                            {feature.icon}
                          </div>
                          {feature.badge && (
                            <span className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${BADGE_COLORS[feature.badge] ?? 'bg-muted text-muted-foreground border-border'}`}>
                              {feature.badge}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-xl text-foreground mb-2 group-hover:text-accent transition-colors duration-200">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                          {feature.description}
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
                          {feature.cta}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/8 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/5 blur-2xl pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 md:px-10 text-center relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-5 flex items-center justify-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Ready to get started?
            </p>
            <h2 className="font-serif text-4xl md:text-5xl text-primary-foreground leading-tight mb-6">
              Your legal operations,
              <br />
              <span className="italic opacity-75">fully streamlined</span>
            </h2>
            <p className="text-base text-primary-foreground/60 leading-relaxed mb-10 max-w-xl mx-auto">
              Start with an intake form, book a consultation, or log in to your client portal — everything is ready for you.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/intake" className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity">
                Start Intake Form
              </Link>
              <Link href="/portal/login" className="inline-flex items-center gap-2 px-8 py-3.5 border border-primary-foreground/20 text-primary-foreground/80 rounded-full text-xs font-semibold uppercase tracking-widest hover:border-primary-foreground/40 hover:text-primary-foreground transition-all">
                Client Portal Login
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
