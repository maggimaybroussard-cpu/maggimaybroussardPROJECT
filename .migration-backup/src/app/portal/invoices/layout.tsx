import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoices — Client Portal',
  robots: { index: false, follow: false },
};

export default function PortalInvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
