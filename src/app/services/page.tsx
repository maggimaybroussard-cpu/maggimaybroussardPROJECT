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

import ServicesFAQ from './components/ServicesFAQ';
import TrustSignalsBar from '@/components/TrustSignalsBar';
import AttorneyDisclaimer from '@/components/AttorneyDisclaimer';

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

  // LegalService schema for Google visibility
  const legalServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name: 'Professional Paralegal Services',
    description: 'Comprehensive legal services including litigation support, legal research, document drafting, case management, discovery assistance, contract review, and court filing.',
    url: `${baseUrl}/services`,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Broussard Legal Services',
      url: baseUrl,
      telephone: '+1-844-493-6819',
      email: 'contact@broussardlegalservices.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'New Orleans',
        addressRegion: 'LA',
        addressCountry: 'US',
      },
      image: `${baseUrl}/assets/images/og-image.png`,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/assets/images/app_logo.png`,
        width: 250,
        height: 60,
      },
    },
    areaServed: [
      {
        '@type': 'State',
        name: 'Louisiana',
      },
      {
        '@type': 'Country',
        name: 'United States',
      },
    ],
    serviceType: [
      'Litigation Support',
      'Legal Research',
      'Document Drafting',
      'Case Management',
      'Discovery Assistance',
      'Contract Review',
      'Court Filing',
      'Intake Processing',
      'Compliance Review',
    ],
    image: `${baseUrl}/assets/images/og-image.png`,
    priceRange: '$$',
  };

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
      {/* LegalService Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(legalServiceSchema),
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
      <Header />
      <main>
        <ServicesHero />
        <ServicesBentoGrid />
        <ServicesWhyBroussard />
        <ServicesPracticeAreas />
        <ServicesProcess />
        <CaseStudiesSocialProof />
        <TestimonialsCompact />
        <ServicesFAQ />
        <EmailOptInSection />
        <ServicesWorkCTA />
      </main>
      <Footer />
      <ServicesPageTracker />
      <TrustSignalsBar />
      <AttorneyDisclaimer />
    </>
  );
}