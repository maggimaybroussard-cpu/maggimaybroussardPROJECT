import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ServicesHero from './components/ServicesHero';
import ServicesBentoGrid from './components/ServicesBentoGrid';
import ServicesProcess from './components/ServicesProcess';
import ServicesWorkCTA from './components/ServicesWorkCTA';
import ServicesPageTracker from './components/ServicesPageTracker';
import EmailOptInSection from '../components/EmailOptInSection';
import FAQSection from '../components/FAQSection';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Legal Services — Litigation Support, Legal Research & Document Drafting',
  description: 'Comprehensive legal services including litigation support, legal research, document drafting, case management, and discovery assistance for law firms nationwide.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/services`,
  },
  openGraph: {
    title: 'Legal Services — Litigation Support & Legal Research',
    description: 'Comprehensive legal services including litigation support, legal research, document drafting, and case management.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/services`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Professional Legal Services — Litigation Support and Legal Research',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal Services — Litigation Support & Legal Research',
    description: 'Comprehensive legal services including litigation support, legal research, document drafting, and case management.',
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
            telephone: '',
            areaServed: {
              '@type': 'Country',
              name: 'US',
            },
            priceRange: 'Varies',
            sameAs: [],
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
            description: 'Comprehensive legal services including litigation support, legal research, document drafting, case management, and discovery assistance.',
            url: `${baseUrl}/services`,
            image: `${baseUrl}/assets/images/og-image.png`,
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
            '@type': 'Service',
            name: 'Contract Paralegal Services',
            description: 'Remote contract paralegal services for law firms nationwide including litigation support, legal research, document drafting, case management, and discovery assistance.',
            provider: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              url: baseUrl,
              logo: `${baseUrl}/assets/images/app_logo.png`,
            },
            areaServed: {
              '@type': 'Country',
              name: 'US',
            },
            hasOfferingDetails: [
              {
                '@type': 'OfferingDetails',
                name: 'Litigation Support',
                description: 'Trial preparation, exhibit organization, deposition summaries, and case management for complex litigation.',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Legal Research',
                description: 'Comprehensive legal research memos, case law analysis, and statutory interpretation for law firms.',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Document Drafting',
                description: 'Professional drafting of motions, briefs, contracts, and legal documents tailored to your jurisdiction.',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Case Management',
                description: 'End-to-end case management including deadline tracking, file organization, and matter administration.',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Discovery Assistance',
                description: 'Document review, privilege log preparation, and discovery management for complex cases.',
              },
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
                  text: 'Broussard Legal Services provides comprehensive contract paralegal services including litigation support, legal research, document drafting, case management, discovery assistance, and contract review for law firms nationwide.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is the service available nationwide?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, Broussard Legal Services provides remote contract paralegal services to law firms and attorneys across the United States.',
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
                name: 'What is the pricing structure?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Pricing varies based on the scope and complexity of your project. Contact us for a consultation to discuss your specific needs and receive a customized quote.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can you handle confidential client matters?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, all work is handled with strict confidentiality. We maintain professional standards and can execute NDAs as needed.',
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
        <ServicesProcess />
        <FAQSection variant="light" />
        <EmailOptInSection />
        <ServicesWorkCTA />
      </main>
      <Footer />
    </>
  );
}