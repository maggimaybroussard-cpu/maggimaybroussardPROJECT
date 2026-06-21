import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cases — Client Portal',
  robots: { index: false, follow: false },
};

export default function PortalCasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
