import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { Suspense } from 'react';
import '../styles/tailwind.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import MixpanelAnalytics from '@/components/MixpanelAnalytics';
import LexiFloatingChat from '@/components/LexiFloatingChat';
import CookieBanner from '@/components/CookieBanner';
import { AuthProvider } from '@/contexts/AuthContext';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { Toaster } from 'react-hot-toast';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // LocalBusiness schema for legal services visibility
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/#organization`,
    name: 'Broussard Legal Services',
    description: 'Professional contract paralegal services for law firms nationwide. Remote litigation support, legal research, document drafting, and case management.',
    url: baseUrl,
    telephone: '+1-844-493-6819',
    email: 'contact@broussardlegalservices.com',
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
    sameAs: [],
    priceRange: '$$',
    knowsAbout: [
      'Contract Paralegal Services',
      'Litigation Support',
      'Legal Research',
      'Document Drafting',
      'Case Management',
      'Discovery Assistance',
    ],
  };

  // Organization schema for structured data
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'Broussard Legal Services',
    url: baseUrl,
    logo: `${baseUrl}/assets/images/app_logo.png`,
    description: 'Professional contract paralegal services for law firms nationwide.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      telephone: '+1-844-493-6819',
      email: 'contact@broussardlegalservices.com',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${fraunces.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1B2A4A" />
        {/* LocalBusiness Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema),
          }}
        />
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        {/* Critical above-the-fold CSS inlined to eliminate render-blocking */}
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
          *,*::before,*::after{box-sizing:border-box}
          html{scroll-behavior:smooth}
          body{margin:0;background-color:#F9F0EC;color:#1B2A4A;font-family:'Raleway',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
          h1,h2,h3,h4,h5,h6,p{margin:0}
          :root{--background:#F9F0EC;--foreground:#1B2A4A;--primary:#1B2A4A;--primary-foreground:#F5ECD7;--accent:#B76E79;--font-sans:'Raleway',sans-serif;--font-serif:'Playfair Display',serif}
        ` }} />
      
      <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fmaggimaybr6854back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
      <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body
        className={`${dmSans.variable} ${fraunces.variable} font-sans text-gray-900 antialiased`}
      >
        <Suspense>
          <GoogleAnalytics />
          <MixpanelAnalytics />
        </Suspense>
        <AuthProvider>
          <LexiFloatingChat />
          <CookieBanner />
          <PWAInstallPrompt />
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}