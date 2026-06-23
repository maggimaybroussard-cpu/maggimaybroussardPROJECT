import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Retainer Pricing — New Orleans Contract Paralegal | Broussard Legal Services',
  description: 'Flexible monthly retainer packages for contract paralegal services in New Orleans, Louisiana. Essential ($750), Standard ($1,500), and Full-Service ($2,800) plans. Litigation support, legal research, and document drafting.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing`,
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
