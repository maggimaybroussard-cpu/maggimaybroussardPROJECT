import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Secure Checkout | Maggi May Broussard — Contract Legal Services',
  description: 'Complete your consultation deposit or retainer payment securely. Stripe-powered checkout for Maggi May Broussard contract paralegal services.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkout`,
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
