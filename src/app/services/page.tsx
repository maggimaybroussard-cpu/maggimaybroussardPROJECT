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