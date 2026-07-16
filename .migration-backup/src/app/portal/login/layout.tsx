import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Client Portal Login — Maggi May Broussard',
  robots: { index: false, follow: true },
};

export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
