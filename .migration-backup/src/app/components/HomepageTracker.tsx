'use client';

import { useEffect } from 'react';
import { trackLeadSourceAttribution, trackFunnelHomepageView } from '@/lib/analytics';

/**
 * Fires lead source attribution (UTM + referrer) and funnel step 1
 * once when the homepage mounts. Rendered client-side only.
 */
export default function HomepageTracker() {
  useEffect(() => {
    trackLeadSourceAttribution();
    trackFunnelHomepageView();
  }, []);

  return null;
}
