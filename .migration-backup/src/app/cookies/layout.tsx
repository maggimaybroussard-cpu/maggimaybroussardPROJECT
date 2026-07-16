import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — Maggi May Broussard',
  description: 'Cookie policy for Maggi May Broussard. Learn about the cookies we use and how to manage your preferences.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cookies`,
  },
  openGraph: {
    title: 'Cookie Policy — Maggi May Broussard',
    description: 'Learn about the cookies we use and how to manage your preferences.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cookies`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Cookie Policy — Maggi May Broussard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cookie Policy — Maggi May Broussard',
    description: 'Learn about the cookies we use and how to manage your preferences.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
