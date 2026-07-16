'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initMixpanel, mpPageView } from '@/lib/mixpanel';

export default function MixpanelAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize Mixpanel once on mount
  useEffect(() => {
    initMixpanel();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams?.toString()}` : '');
    mpPageView(url);
  }, [pathname, searchParams]);

  return null;
}
