import React from 'react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PricingPageClient from './components/PricingPageClient';

export default function PricingPage() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Maggi May Broussard — Contract Paralegal Services',
            description: 'Professional contract paralegal services with flexible retainer pricing.',
            url: baseUrl,
            image: `${baseUrl}/assets/images/og-image.png`,
            areaServed: {
              '@type': 'Country',
              name: 'US',
            },
            priceRange: '$750–$2800/month',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Contract Paralegal Retainer Services',
            description: 'Flexible monthly retainer packages for contract paralegal services including litigation support, legal research, document drafting, and case management.',
            provider: {
              '@type': 'Organization',
              name: 'Maggi May Broussard',
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
                name: 'Essential Retainer',
                description: 'Targeted support for focused matters. 10 hours monthly at $75/hour.',
                price: '750',
                priceCurrency: 'USD',
                billingDuration: 'P1M',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Standard Retainer',
                description: 'Full litigation support including motions, discovery management, and priority turnaround. 20 hours monthly at $75/hour.',
                price: '1500',
                priceCurrency: 'USD',
                billingDuration: 'P1M',
              },
              {
                '@type': 'OfferingDetails',
                name: 'Full-Service Retainer',
                description: 'End-to-end litigation partnership with weekly strategy calls. 40 hours monthly at $70/hour.',
                price: '2800',
                priceCurrency: 'USD',
                billingDuration: 'P1M',
              },
            ],
            priceRange: '$750–$2800/month',
          }),
        }}
      />
      <Header />
      <PricingPageClient />
      <Footer />
    </>
  );
}