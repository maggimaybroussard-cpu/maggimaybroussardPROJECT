import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Availability & Consultation Booking — Broussard Legal Services',
  description: 'Schedule a free 30-minute consultation with Maggi May Broussard. Book via Calendly or Google Calendar, view staff schedules, and find the time that works for you.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/availability`,
  },
  openGraph: {
    title: 'Availability & Consultation Booking — Broussard Legal Services',
    description: 'Book a free 30-minute consultation via Calendly or Google Calendar. View staff schedules and instant confirmation.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/availability`,
    type: 'website',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Availability & Consultation Booking — Broussard Legal Services',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Availability & Consultation Booking — Broussard Legal Services',
    description: 'Book a free 30-minute consultation via Calendly or Google Calendar. View staff schedules.',
    images: ['/assets/images/og-image.png'],
  },
};

export default function AvailabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
