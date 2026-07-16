import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Client Intake Form — Maggi May Broussard',
  description: 'Complete a brief intake form before your consultation. Share details about your case.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/intake`,
  },
  openGraph: {
    title: 'Client Intake Form — Maggi May Broussard',
    description: 'Complete your intake form to prepare for your consultation.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/intake`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Client Intake Form — Maggi May Broussard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Client Intake Form — Maggi May Broussard',
    description: 'Complete your intake form to prepare for your consultation.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
