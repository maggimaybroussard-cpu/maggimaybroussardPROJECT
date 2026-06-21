import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Maggi May Broussard',
  description: 'Privacy policy explaining how Maggi May Broussard collects, uses, and protects personal information from clients and website visitors.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/privacy-policy`,
  },
  openGraph: {
    title: 'Privacy Policy — Maggi May Broussard',
    description: 'Privacy policy explaining how we collect, use, and protect personal information from clients and website visitors.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/privacy-policy`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Privacy Policy — Maggi May Broussard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — Maggi May Broussard',
    description: 'Privacy policy explaining how we collect, use, and protect personal information from clients and website visitors.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
