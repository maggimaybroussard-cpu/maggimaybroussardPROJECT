import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Testimonials — Contract Paralegal Services',
  description: 'Read reviews from attorneys and law firms who trust Maggi May Broussard for litigation support, legal research, document drafting, and case management.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/testimonials`,
  },
  openGraph: {
    title: 'Client Testimonials — Contract Paralegal',
    description: 'Reviews from attorneys and law firms. 200+ cases supported with 5.0 rating.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/testimonials`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Client Testimonials — Contract Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Client Testimonials — Contract Paralegal',
    description: 'Reviews from attorneys and law firms. 200+ cases supported with 5.0 rating.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function TestimonialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
