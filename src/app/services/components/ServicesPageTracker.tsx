'use client';

import { useEffect } from 'react';
import { trackServicePageView, trackHomepageToServicesConversion } from '@/lib/analytics';

/**
 * Lightweight client component that fires the service_page_view GA4 event
 * once on mount. Also fires homepage_to_services conversion when the user
 * arrived from the homepage — measures homepage-to-services conversion rate.
 */
export default function ServicesPageTracker() {
  useEffect(() => {
    trackServicePageView();

    // Detect homepage referral for conversion rate measurement
    if (typeof document !== 'undefined') {
      const referrer = document.referrer;
      const isFromHomepage =
        referrer?.includes(window.location?.hostname) &&
        (referrer?.endsWith('/') ||
          referrer?.endsWith(window.location?.hostname) ||
          new URL(referrer)?.pathname === '/');
      if (isFromHomepage) {
        trackHomepageToServicesConversion();
      }
    }
  }, []);

  return null;
}
