import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ServicesHero from './components/ServicesHero';
import ServicesBentoGrid from './components/ServicesBentoGrid';
import ServicesWhyBroussard from './components/ServicesWhyBroussard';
import ServicesPracticeAreas from './components/ServicesPracticeAreas';
import ServicesProcess from './components/ServicesProcess';
import ServicesWorkCTA from './components/ServicesWorkCTA';
import ServicesPageTracker from './components/ServicesPageTracker';
import EmailOptInSection from '../components/EmailOptInSection';
import CaseStudiesSocialProof from '../components/CaseStudiesSocialProof';
import TestimonialsCompact from '../components/TestimonialsCompact';
import Link from 'next/link';
import GoogleWorkspacePanel from '@/components/GoogleWorkspacePanel';

import ServicesFAQ from './components/ServicesFAQ';
import ServicesJsonLd from './components/ServicesJsonLd';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Legal Services — Litigation Support, Legal Research & Document Drafting',
  description: 'Comprehensive legal services including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, and more — nationwide.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/services`,
  },
  openGraph: {
    title: 'Legal Services — Broussard Legal Services',
    description: 'Full-service paralegal support: litigation, research, drafting, case management, discovery, intake, compliance, court filing, and more.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/services`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Professional Legal Services — Broussard Legal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal Services — Broussard Legal Services',
    description: 'Full-service paralegal support: litigation, research, drafting, case management, discovery, intake, compliance, court filing, and more.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function ServicesPage() {
  return (
    <>
      <ServicesJsonLd />
      <Header />
      <main>
        <ServicesPageTracker />
        <ServicesHero />
        <section id="services-overview" aria-label="Overview of paralegal services offered">
          <ServicesBentoGrid />
        </section>
        <section id="why-broussard" aria-label="Why choose Broussard Legal Services">
          <ServicesWhyBroussard />
        </section>
        <section id="practice-areas" aria-label="Practice areas and legal specialties">
          <ServicesPracticeAreas />
        </section>
        <section id="process" aria-label="How our service process works">
          <ServicesProcess />
        </section>

        {/* Case Studies Social Proof */}
        <section id="case-results" aria-label="Case study results and outcomes">
          <CaseStudiesSocialProof
            heading="Real Results for Real Firms"
            subheading="Outcomes from matters handled across practice areas and firm sizes — litigation, contracts, research, and more."
            limit={3}
          />
        </section>

        {/* Client Testimonials */}
        <section id="client-testimonials" aria-label="What attorneys say about Broussard Legal Services">
          <TestimonialsCompact
            heading="What Attorneys Say"
            limit={4}
          />
        </section>

        {/* Purchase CTA Banner */}
        <section id="purchase-services" aria-label="Purchase paralegal services online">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20">
            <div
              className="rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
              style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 60%, #4a7c52 100%)' }}
            >
              <div className="text-center md:text-left">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
                >
                  New · Buy Online
                </span>
                <h2 className="font-serif text-2xl md:text-3xl text-white leading-tight mb-3">
                  Purchase Paralegal Services
                  <br />
                  <span className="italic opacity-80">Directly &amp; Instantly</span>
                </h2>
                <p className="text-white/70 font-light leading-relaxed max-w-md text-sm md:text-base">
                  Flat-fee packages for legal research, motion drafting, discovery, contract review, and more. Pay securely via Stripe — work begins within 1 business day.
                </p>
                <div className="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
                  {['Legal Research Memo · $350', 'Motion Drafting · $500', 'Discovery Package · $650'].map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 shrink-0">
                <Link
                  href="/services/purchase"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-lg"
                  style={{ background: '#fff', color: '#355E3B' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  Browse &amp; Buy Now
                </Link>
                <p className="text-center text-xs text-white/50">
                  🔒 Stripe · SSL · PCI Compliant
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="quotable-stats" aria-label="Key statistics and impact metrics">
          <div className="max-w-7xl mx-auto px-5 md:px-10 py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2">500+</p>
                <p className="text-sm text-muted-foreground">Legal matters handled across 50 states</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2">24-48hrs</p>
                <p className="text-sm text-muted-foreground">Average project onboarding time</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2">12+</p>
                <p className="text-sm text-muted-foreground">Specialized paralegal services</p>
              </div>
            </div>
          </div>
        </section>
        <section id="faq" aria-label="Frequently asked questions about paralegal services">
          <ServicesFAQ />
        </section>

        {/* Google Workspace Integration Strip */}
        <section id="google-workspace" aria-label="Google Workspace tools integrated with our services" className="py-12 px-5 md:px-10 border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                <span className="w-5 h-px bg-muted-foreground/40" />
                Powered by Google Workspace
                <span className="w-5 h-px bg-muted-foreground/40" />
              </span>
              <h2 className="text-xl font-semibold text-foreground mb-2">Seamless Google Integration</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Every consultation is synced to Google Calendar with a Meet link. Case documents live in Google Docs. Billing tracked in Sheets.
              </p>
            </div>
            <GoogleWorkspacePanel />
            <div className="mt-6 text-center">
              <Link
                href="/booking"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Book via Google Calendar
              </Link>
            </div>
          </div>
        </section>

        <section id="email-signup" aria-label="Subscribe to legal insights and updates">
          <EmailOptInSection />
        </section>
        <ServicesWorkCTA />
      </main>
      <Footer />
    </>
  );
}