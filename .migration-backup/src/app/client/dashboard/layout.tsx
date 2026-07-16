import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Dashboard — Maggi May Broussard',
  robots: { index: false, follow: false },
};

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
