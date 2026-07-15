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

import ServicesFAQ from './components/ServicesFAQ';

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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: baseUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Services',
                item: `${baseUrl}/services`,
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Legal Services',
            description: 'Comprehensive legal services including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, and more.',
            url: `${baseUrl}/services`,
            image: `${baseUrl}/assets/images/og-image.png`,
            datePublished: '2024-01-01',
            dateModified: new Date().toISOString().split('T')[0],
            inLanguage: 'en-US',
            isPartOf: {
              '@type': 'WebSite',
              name: 'Broussard Legal Services',
              url: baseUrl,
            },
            publisher: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/assets/images/app_logo.png`,
              },
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Broussard Legal Services — Contract Paralegal Services',
            description: 'Professional contract paralegal services for law firms nationwide.',
            url: baseUrl,
            image: `${baseUrl}/assets/images/og-image.png`,
            telephone: '+1-504-458-2831',
            address: {
              '@type': 'PostalAddress',
              streetAddress: '900 Camp Street Suite 3rd Fl. PMB 70111',
              addressLocality: 'New Orleans',
              addressRegion: 'LA',
              postalCode: '70130',
              addressCountry: 'US',
            },
            areaServed: { '@type': 'Country', name: 'US' },
            priceRange: '$750–$2,800/month',
            openingHoursSpecification: [
              {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                opens: '09:00',
                closes: '17:00',
              },
              {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: 'Saturday',
                opens: '10:00',
                closes: '18:00',
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Contract Paralegal Services',
            description: 'Remote contract paralegal services for law firms nationwide including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, estate planning support, and more.',
            provider: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              url: baseUrl,
              logo: `${baseUrl}/assets/images/app_logo.png`,
            },
            areaServed: { '@type': 'Country', name: 'US' },
            priceRange: '$750–$2,800/month',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What legal services does Broussard Legal Services provide?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Broussard Legal Services provides 12+ contract paralegal services including litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, client intake, regulatory research, settlement letters, and estate & probate support.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is the service available nationwide?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, Broussard Legal Services provides remote contract paralegal services to law firms and attorneys across all 50 states.',
                },
              },
              {
                '@type': 'Question',
                name: 'How quickly can you start on a project?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Most projects can begin within 24-48 hours of engagement. For urgent matters, expedited onboarding is available.',
                },
              },
              {
                '@type': 'Question',
                name: 'What practice areas do you support?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Broussard Legal Services supports civil litigation, family law, real estate, estate planning, business & corporate, employment law, personal injury, criminal defense, immigration, intellectual property, healthcare, and environmental law.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can you handle confidential client matters?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. All work is handled under strict confidentiality agreements and attorney-client privilege protections. Broussard Legal Services maintains IOLTA compliance and secure document handling protocols.',
                },
              },
            ],
          }),
        }}
      />
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
        <section id="email-signup" aria-label="Subscribe to legal insights and updates">
          <EmailOptInSection />
        </section>
        <ServicesWorkCTA />
      </main>
      <Footer />
    </>
  );
}