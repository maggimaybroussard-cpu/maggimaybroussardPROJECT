import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Consultation — Contract Paralegal Services',
  description: 'Schedule a free 30-minute consultation with Maggi May Broussard. Discuss your legal support needs and explore how we can help your firm.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/book-consultation`,
  },
  openGraph: {
    title: 'Book a Consultation — Contract Paralegal',
    description: 'Schedule a free 30-minute consultation. Discuss your legal support needs with Maggi May Broussard.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/book-consultation`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Book a Consultation — Contract Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book a Consultation — Contract Paralegal',
    description: 'Schedule a free 30-minute consultation. Discuss your legal support needs with Maggi May Broussard.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function BookConsultationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
