import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payment Confirmation — Maggi May Broussard',
  description: 'Your payment has been processed successfully. Download your receipt.',
  robots: { index: false, follow: true },
};

export default function PaymentConfirmationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
