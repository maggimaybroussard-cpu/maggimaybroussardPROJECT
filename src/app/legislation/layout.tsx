import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Federal & State Legislation Search — Broussard Legal Services',
  description: 'Search Congress.gov legislation by terminology. Browse all 50 U.S. state legal codes, statutes, and every category of law — civil, criminal, family, tax, and more.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://maggimaybr6854.builtwithrocket.new'}/legislation`,
  },
  openGraph: {
    title: 'Federal & State Legislation Search — Broussard Legal Services',
    description: 'Search Congress.gov legislation by terminology. Browse all 50 U.S. state legal codes and every category of federal law.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://maggimaybr6854.builtwithrocket.new'}/legislation`,
    type: 'website',
  },
};

export default function LegislationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
