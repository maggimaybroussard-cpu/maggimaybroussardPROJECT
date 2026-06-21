import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Studies — Real Results from Contract Paralegal Work',
  description: 'Real case studies showing how Maggi May Broussard delivers results. Multi-party litigation, contract audits, legal research, and estate administration.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/case-studies`,
  },
  openGraph: {
    title: 'Case Studies — Contract Paralegal Results',
    description: 'Real case studies showing litigation support, contract review, legal research, and estate administration results.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/case-studies`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Case Studies — Real Results from Contract Paralegal Work',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Case Studies — Contract Paralegal Results',
    description: 'Real case studies showing litigation support, contract review, legal research, and estate administration results.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function CaseStudiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
