import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog & Resources — Paralegal Tips & Legal Guides',
  description: 'Paralegal tips, plain-language legal guides, and jurisdiction-specific articles. Resources to help you navigate the legal system with confidence.',
  keywords: [
    'paralegal tips',
    'legal guides',
    'legal resources',
    'law firm resources',
    'litigation tips',
    'legal research',
    'contract review',
    'case management',
    'legal articles',
    'attorney resources',
  ],
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Blog schema for keyword-targeted articles
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Broussard Legal Services — Legal Knowledge Hub',
    description: 'Paralegal tips, plain-language legal guides, and jurisdiction-specific articles for attorneys and legal professionals.',
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'Broussard Legal Services',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/assets/images/app_logo.png`,
        width: 250,
        height: 60,
      },
    },
    image: `${baseUrl}/assets/images/og-image.png`,
    mainEntity: {
      '@type': 'WebPage',
      name: 'Blog & Resources',
      url: `${baseUrl}/blog`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogSchema),
        }}
      />
      {children}
    </>
  );
}
