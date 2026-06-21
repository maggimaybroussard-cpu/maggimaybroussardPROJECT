import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Maggi May Broussard',
  description: 'Legal terms and conditions for contract paralegal services provided by Maggi May Broussard to law firms and attorneys nationwide.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/terms-of-service`,
  },
  openGraph: {
    title: 'Terms of Service — Maggi May Broussard',
    description: 'Legal terms and conditions for contract paralegal services provided to law firms and attorneys.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/terms-of-service`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Terms of Service — Maggi May Broussard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — Maggi May Broussard',
    description: 'Legal terms and conditions for contract paralegal services provided to law firms and attorneys.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function TermsOfServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
