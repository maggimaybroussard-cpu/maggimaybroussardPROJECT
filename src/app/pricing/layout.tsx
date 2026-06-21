import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Pricing & Packages — Contract Paralegal Services',
  description: 'Flexible retainer pricing for paralegal services. Essential, Standard, and Full-Service tiers with transparent hourly rates, monthly billing, and no long-term contracts.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing`,
  },
  openGraph: {
    title: 'Pricing & Packages — Contract Paralegal Services',
    description: 'Flexible retainer pricing for paralegal services. Essential, Standard, and Full-Service tiers available.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pricing & Packages — Contract Paralegal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Packages — Contract Paralegal Services',
    description: 'Flexible retainer pricing for paralegal services. Essential, Standard, and Full-Service tiers available.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
