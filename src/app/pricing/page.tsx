import React from 'react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PricingPageClient from './components/PricingPageClient';
import CaseStudiesSocialProof from '../components/CaseStudiesSocialProof';
import TestimonialsCompact from '../components/TestimonialsCompact';

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
            name: 'Broussard Legal Services — Contract Paralegal Services',
            description: 'Professional contract paralegal services with flexible retainer pricing.',
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
            areaServed: {
              '@type': 'Country',
              name: 'US',
            },
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
            name: 'Contract Paralegal Retainer Services',
            description: 'Flexible monthly retainer packages for contract paralegal services including litigation support, legal research, document drafting, and case management.',
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
            priceRange: '$750–$2,800/month',
          }),
        }}
      />
      <Header />
      <PricingPageClient />

      {/* Paralegal Disclaimer */}
      <div className="bg-amber-50 border-y border-amber-200">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-3">
          <p className="text-amber-800 text-xs text-center leading-relaxed">
            <strong>Paralegal Disclaimer:</strong> Broussard Legal Services provides paralegal services under the supervision of a licensed attorney. All pricing reflects paralegal support services only and does not include attorney fees. Use of this website does not create an attorney-client relationship.{' '}
            <a href="/disclaimers" className="underline hover:text-amber-900">View full disclaimer →</a>
          </p>
        </div>
      </div>

      {/* Case Studies Social Proof */}
      <CaseStudiesSocialProof
        heading="Outcomes That Justify the Investment"
        subheading="See what firms like yours have accomplished with dedicated paralegal support."
        limit={3}
      />

      {/* Client Testimonials */}
      <TestimonialsCompact
        heading="Trusted by Attorneys Nationwide"
        limit={4}
      />

      <Footer />
    </>
  );
}