import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from './components/HeroSection';
import AboutSection from './components/AboutSection';
import ServicesPreviewSection from './components/ServicesPreviewSection';
import RetainerPricingSection from './components/RetainerPricingSection';
import CaseProcessTimeline from './components/CaseProcessTimeline';
import CaseOutcomesSection from './components/CaseOutcomesSection';
import TestimonialsSection from './components/TestimonialsSection';
import ContactCTASection from './components/ContactCTASection';
import EmailOptInSection from './components/EmailOptInSection';
import EmailOptInModal from './components/EmailOptInModal';
import HomepageTracker from './components/HomepageTracker';
import MobileAppSection from './components/MobileAppSection';
import BrandVideoSection from './components/BrandVideoSection';

export const metadata: Metadata = {
  title: 'Contract Paralegal Services New Orleans — Broussard Legal Services',
  description: 'Professional contract paralegal for law firms in New Orleans, Louisiana and nationwide. Remote litigation support, legal research, document drafting, and case management by Maggi May Broussard.',
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
  openGraph: {
    title: 'Contract Paralegal Services New Orleans — Broussard Legal Services',
    description: 'Professional paralegal support for law firms in New Orleans, LA and nationwide. Remote litigation, legal research, and document drafting.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Broussard Legal Services — Professional Contract Paralegal New Orleans',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contract Paralegal Services New Orleans — Broussard Legal Services',
    description: 'Professional paralegal support for law firms in New Orleans, LA and nationwide. Remote litigation, legal research, and document drafting.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Contract Paralegal Services',
            description: 'Professional contract paralegal for law firms nationwide. Remote litigation support, legal research, document drafting, and case management assistance.',
            url: baseUrl,
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
            '@type': 'ProfessionalService',
            name: 'Broussard Legal Services — Contract Paralegal Services',
            description: 'Remote contract paralegal services for law firms nationwide',
            url: baseUrl,
            image: `${baseUrl}/assets/images/app_logo.png`,
            areaServed: 'US',
            serviceType: ['Litigation Support', 'Legal Research', 'Document Drafting', 'Case Management'],
            priceRange: 'Varies',
          }),
        }}
      />
      <Header />
      <main id="main-content" suppressHydrationWarning>
        <HomepageTracker />
        <HeroSection />
        <BrandVideoSection />
        <AboutSection />
        <ServicesPreviewSection />
        <RetainerPricingSection />
        <CaseProcessTimeline />
        <CaseOutcomesSection />
        <TestimonialsSection />
        <MobileAppSection />
        <EmailOptInSection />
        <ContactCTASection />
      </main>
      <Footer />
      <EmailOptInModal />
    </>
  );
}