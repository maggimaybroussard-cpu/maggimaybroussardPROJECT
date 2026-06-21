import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimers — Maggi May Broussard',
  description: 'Important disclaimers and limitations regarding legal services provided by Maggi May Broussard to law firms and attorneys.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/disclaimers`,
  },
  openGraph: {
    title: 'Disclaimers — Maggi May Broussard',
    description: 'Important disclaimers and limitations regarding legal services provided to law firms and attorneys.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/disclaimers`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Disclaimers — Maggi May Broussard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Disclaimers — Maggi May Broussard',
    description: 'Important disclaimers and limitations regarding legal services provided to law firms and attorneys.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function DisclaimersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
