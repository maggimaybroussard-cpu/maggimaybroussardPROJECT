import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ContactHero from './components/ContactHero';
import ContactSplit from './components/ContactSplit';
import CalendlyBookingSection from './components/CalendlyBookingSection';
import GoogleCalendarBookingSection from './components/GoogleCalendarBookingSection';
import BookingReminderSection from './components/BookingReminderSection';

export const metadata: Metadata = {
  title: 'Contact Maggi May Broussard — Legal Services Inquiry',
  description: 'Get in touch with Maggi May Broussard for contract legal services. Available for law firms and attorneys nationwide. Response within one business day.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/contact`,
  },
  openGraph: {
    title: 'Contact Maggi May Broussard — Legal Services',
    description: 'Get in touch for contract legal services. Available nationwide with response within one business day.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/contact`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Contact Maggi May Broussard — Professional Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Maggi May Broussard — Legal Services',
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
            '@type': 'WebPage',
            name: 'Contact',
            description: 'Get in touch with Maggi May Broussard for contract paralegal services.',
            url: `${baseUrl}/contact`,
            image: `${baseUrl}/assets/images/og-image.png`,
            publisher: {
              '@type': 'Organization',
              name: 'Maggi May Broussard',
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
            name: 'Maggi May Broussard — Contract Paralegal Services',
            description: 'Remote contract paralegal services for law firms nationwide.',
            url: baseUrl,
            image: `${baseUrl}/assets/images/app_logo.png`,
            areaServed: {
              '@type': 'Country',
              name: 'US',
            },
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'Customer Service',
              availableLanguage: 'en',
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
          }),
        }}
      />
      <Header />
      <main>
        <ContactHero />
        <ContactSplit />
        <CalendlyBookingSection />
        <GoogleCalendarBookingSection />
        <BookingReminderSection />
      </main>
      <Footer />
    </>
  );
}