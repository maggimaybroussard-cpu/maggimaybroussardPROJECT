import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Login — Maggi May Broussard',
  description: 'Secure client portal for invoices, payments, and billing details.',
  robots: { index: false, follow: true },
};

export default function ClientLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
