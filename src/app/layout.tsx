import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Raleway } from 'next/font/google';
import { Suspense } from 'react';
import '../styles/tailwind.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import LexiFloatingChat from '@/components/LexiFloatingChat';
import CookieBanner from '@/components/CookieBanner';
import { AuthProvider } from '@/contexts/AuthContext';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { Toaster } from 'react-hot-toast';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  preload: true,
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1B2A4A',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Broussard Legal Services — Contract Paralegal Services',
    template: '%s | Broussard Legal Services',
  },
  description: 'Professional contract paralegal services for law firms nationwide. Remote litigation support, legal research, document drafting, and case management assistance.',
  keywords: [
    'contract paralegal',
    'paralegal services',
    'litigation support',
    'legal research',
    'document drafting',
    'case management',
    'remote paralegal',
    'Louisiana paralegal',
    'New Orleans paralegal',
    'New Orleans legal services',
    'New Orleans contract paralegal',
    'Louisiana legal support',
    'paralegal New Orleans LA',
    'legal document drafting New Orleans',
    'litigation support New Orleans',
    'law firm support New Orleans',
    'Maggi May Broussard',
    'Broussard Legal Services',
    'paralegal services Louisiana',
    'remote legal support',
  ],
  authors: [{ name: 'Broussard Legal Services', url: process.env.NEXT_PUBLIC_SITE_URL }],
  creator: 'Broussard Legal Services',
  publisher: 'Broussard Legal Services',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
  openGraph: {
    title: 'Broussard Legal Services — Contract Paralegal Services',
    description: 'Professional contract paralegal services for law firms nationwide. Remote litigation support, legal research, and document drafting.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    siteName: 'Broussard Legal Services',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Broussard Legal Services — Professional Contract Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Broussard Legal Services — Contract Paralegal Services',
    description: 'Professional contract paralegal services for law firms nationwide. Remote litigation support, legal research, and document drafting.',
    images: ['/assets/images/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/assets/images/app_logo.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/assets/images/app_logo.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Broussard Legal',
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  verification: {
    // Add Google Search Console verification token here when available
    // google: 'your-verification-token',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1B2A4A" />
        {/* Preconnect to Google Fonts to eliminate DNS/TCP render-blocking delay */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Broussard Legal" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              description: 'Professional contract paralegal services nationwide',
              url: baseUrl,
              logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/assets/images/app_logo.png`,
                width: 512,
                height: 512,
              },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Service',
                availableLanguage: 'en',
                email: 'broussardlegalservices@gmail.com',
                telephone: '+1-504-458-2831',
              },
            }),
          }}
        />

        {/* LocalBusiness structured data — New Orleans local SEO with business hours */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              '@id': baseUrl,
              name: 'Broussard Legal Services — Contract Paralegal Services',
              description: 'Contract paralegal services for law firms in New Orleans, Louisiana and nationwide. Litigation support, legal research, document drafting, and case management by Maggi May Broussard.',
              url: baseUrl,
              image: `${baseUrl}/assets/images/og-image.png`,
              logo: `${baseUrl}/assets/images/app_logo.png`,
              priceRange: '$750–$2,800/month',
              telephone: '+1-504-458-2831',
              email: 'broussardlegalservices@gmail.com',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '900 Camp Street Suite 3rd Fl. PMB 70111',
                addressLocality: 'New Orleans',
                addressRegion: 'LA',
                postalCode: '70130',
                addressCountry: 'US',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: 29.9511,
                longitude: -90.0715,
              },
              areaServed: [
                { '@type': 'City', name: 'New Orleans', containedInPlace: { '@type': 'State', name: 'Louisiana' } },
                { '@type': 'State', name: 'Louisiana' },
                { '@type': 'Country', name: 'United States' },
              ],
              serviceArea: {
                '@type': 'GeoCircle',
                geoMidpoint: { '@type': 'GeoCoordinates', latitude: 29.9511, longitude: -90.0715 },
                geoRadius: '50000',
              },
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
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: 'Sunday',
                  opens: '00:00',
                  closes: '00:00',
                },
              ],
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Paralegal Services',
                itemListElement: [
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Litigation Support', areaServed: 'New Orleans, LA' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Legal Research', areaServed: 'New Orleans, LA' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Document Drafting', areaServed: 'New Orleans, LA' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Case Management', areaServed: 'New Orleans, LA' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Discovery Assistance', areaServed: 'New Orleans, LA' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Contract Review', areaServed: 'New Orleans, LA' } },
                ],
              },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Service',
                availableLanguage: 'en',
                email: 'broussardlegalservices@gmail.com',
                telephone: '+1-504-458-2831',
              },
              founder: {
                '@type': 'Person',
                name: 'Maggi May Broussard',
                jobTitle: 'Contract Paralegal',
                worksFor: { '@type': 'Organization', name: 'Broussard Legal Services' },
              },
            }),
          }}
        />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fmaggimaybr6854back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body className={raleway.className}>
        {/* Skip to main content — keyboard navigation / accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <CookieBanner />
        <LexiFloatingChat />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}