import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — Client Portal',
  robots: { index: false, follow: false },
};

export default function PortalDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
