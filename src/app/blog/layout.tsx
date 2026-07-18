import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog & Resources — Paralegal Tips & Legal Guides',
  description: 'Paralegal tips, plain-language legal guides, and jurisdiction-specific articles. Resources to help you navigate the legal system with confidence.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/blog`,
  },
  openGraph: {
    title: 'Blog & Resources — Paralegal Tips & Guides',
    description: 'Paralegal tips, legal guides, and jurisdiction-specific articles for law firms and attorneys.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/blog`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Blog & Resources — Paralegal Tips & Legal Guides',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog & Resources — Paralegal Tips & Guides',
    description: 'Paralegal tips, legal guides, and jurisdiction-specific articles for law firms and attorneys.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
