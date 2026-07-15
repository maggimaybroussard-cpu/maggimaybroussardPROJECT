import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContactHero from './components/ContactHero';
import ContactSplit from './components/ContactSplit';
import CalendlyBookingSection from './components/CalendlyBookingSection';
import GoogleCalendarBookingSection from './components/GoogleCalendarBookingSection';
import BookingReminderSection from './components/BookingReminderSection';
import TrustSignalsBar from '@/components/TrustSignalsBar';
import AttorneyDisclaimer from '@/components/AttorneyDisclaimer';

export const metadata: Metadata = {
  title: 'Contact Broussard Legal Services — Legal Services Inquiry',
  description: 'Get in touch with Broussard Legal Services for contract legal services. Available for law firms and attorneys nationwide. Response within one business day.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/contact`,
  },
  openGraph: {
    title: 'Contact Broussard Legal Services — Legal Services',
    description: 'Get in touch for contract legal services. Available nationwide with response within one business day.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/contact`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Contact Broussard Legal Services — Professional Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Broussard Legal Services — Legal Services',
    description: 'Get in touch for contract legal services. Available nationwide with response within one business day.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function ContactPage() {
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
                name: 'Contact',
                item: `${baseUrl}/contact`,
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
            name: 'Contact',
            description: 'Get in touch with Broussard Legal Services for contract paralegal services.',
            url: `${baseUrl}/contact`,
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
            description: 'Remote contract paralegal services for law firms nationwide.',
            url: baseUrl,
            image: `${baseUrl}/assets/images/app_logo.png`,
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
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'Customer Service',
              availableLanguage: 'en',
              telephone: '+1-504-458-2831',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            availableLanguage: 'en',
            url: baseUrl,
            telephone: '+1-504-458-2831',
          }),
        }}
      />
      <Header />
      <AttorneyDisclaimer variant="banner" />
      <main>
        <ContactHero />
        <TrustSignalsBar />
        <ContactSplit />
        <CalendlyBookingSection />
        <GoogleCalendarBookingSection />
        <BookingReminderSection />
      </main>
      <Footer />
    </>
  );
}