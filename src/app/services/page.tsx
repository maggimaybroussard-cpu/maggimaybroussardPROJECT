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
import FAQSection from '../components/FAQSection';

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
            telephone: '1-504-458-2831',
            address: {
              '@type': 'PostalAddress',
              streetAddress: '900 Camp Street Suite 3rd Fl. PMB 70111',
              addressLocality: 'New Orleans',
              addressRegion: 'LA',
              postalCode: '70130',
              addressCountry: 'US',
            },
            areaServed: { '@type': 'Country', name: 'US' },
            priceRange: 'Varies',
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
            },
            areaServed: { '@type': 'Country', name: 'US' },
            hasOfferingDetails: [
              { '@type': 'OfferingDetails', name: 'Litigation Support' },
              { '@type': 'OfferingDetails', name: 'Contract Review' },
              { '@type': 'OfferingDetails', name: 'Legal Research' },
              { '@type': 'OfferingDetails', name: 'Document Drafting' },
              { '@type': 'OfferingDetails', name: 'Case Management' },
              { '@type': 'OfferingDetails', name: 'Deposition Prep' },
              { '@type': 'OfferingDetails', name: 'Discovery Assistance' },
              { '@type': 'OfferingDetails', name: 'Client Intake & Onboarding' },
              { '@type': 'OfferingDetails', name: 'Regulatory & Compliance Research' },
              { '@type': 'OfferingDetails', name: 'Court Filing & Docketing' },
              { '@type': 'OfferingDetails', name: 'Settlement & Demand Letters' },
              { '@type': 'OfferingDetails', name: 'Estate & Probate Support' },
            ],
            priceRange: 'Varies',
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
                  text: 'Yes, all work is handled with strict confidentiality under a signed NDA. Professional standards are maintained at all times.',
                },
              },
            ],
          }),
        }}
      />
      <Header />
      <main id="main-content">
        <ServicesPageTracker />
        <ServicesHero />
        <ServicesBentoGrid />
        <ServicesWhyBroussard />
        <ServicesPracticeAreas />
        <ServicesProcess />
        <FAQSection variant="light" />
        <EmailOptInSection />
        <ServicesWorkCTA />
      </main>
      <Footer />
    </>
  );
}