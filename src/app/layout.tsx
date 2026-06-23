import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Raleway } from 'next/font/google';
import { Suspense } from 'react';
import '../styles/tailwind.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import ChatbotWidget from '@/components/ChatbotWidget';
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
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <html lang="en" className={`${playfairDisplay.variable} ${raleway.variable}`} suppressHydrationWarning>
      <head>
        {/* Resource hints for LCP — preconnect to image CDNs */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://img.rocket.new" />
        <link rel="dns-prefetch" href="https://assets.calendly.com" />
        <link rel="dns-prefetch" href="https://embed.typeform.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* PWA — Microsoft Edge / Windows */}
        <meta name="msapplication-TileColor" content="#4A3728" />
        <meta name="msapplication-TileImage" content="/assets/images/app_logo.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="application-name" content="Broussard Legal" />

        {/* PWA — iOS Safari */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Broussard Legal" />
        <link rel="apple-touch-icon" href="/assets/images/app_logo.png" />

        {/* PWA — Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                // Unregister all existing SWs and clear all caches first.
                // This purges any stale Next.js chunk files cached by the old SW
                // that caused "Cannot read properties of undefined (reading 'call')".
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(r) { r.unregister(); });
                });
                caches.keys().then(function(keys) {
                  keys.forEach(function(k) { caches.delete(k); });
                });
                // Re-register the fixed SW (which no longer caches /_next/ paths)
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />

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
              sameAs: [],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Service',
                availableLanguage: 'en',
                email: 'broussardlegalservices@gmail.com',
              },
            }),
          }}
        />

        {/* LocalBusiness structured data — New Orleans local SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LegalService',
              name: 'Broussard Legal Services — Contract Paralegal Services',
              description: 'Contract paralegal services for law firms in New Orleans, Louisiana and nationwide. Litigation support, legal research, document drafting, and case management by Maggi May Broussard.',
              url: baseUrl,
              image: `${baseUrl}/assets/images/og-image.png`,
              logo: `${baseUrl}/assets/images/app_logo.png`,
              priceRange: '$$',
              telephone: '',
              email: 'broussardlegalservices@gmail.com',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'New Orleans',
                addressRegion: 'LA',
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
        <ChatbotWidget />
        <LexiFloatingChat />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}