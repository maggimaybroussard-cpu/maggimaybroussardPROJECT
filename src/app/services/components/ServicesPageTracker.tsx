'use client';

import { useEffect } from 'react';
import {
  trackServicePageView,
  trackHomepageToServicesConversion,
  trackServicesFunnelEntry,
} from '@/lib/analytics';

/**
 * Lightweight client component that fires the service_page_view GA4 event
 * once on mount. Also fires homepage_to_services conversion when the user
 * arrived from the homepage — measures homepage-to-services conversion rate.
 * Additionally fires services_funnel_entry to mark Step 1 of the
 * services → booking conversion funnel.
 */
export default function ServicesPageTracker() {
  useEffect(() => {
    trackServicePageView();

    // Detect referrer source for funnel attribution
    let referrerSource: 'homepage' | 'direct' | 'external' | 'other' = 'direct';
    let referrerPath = '';

    if (typeof document !== 'undefined') {
      const referrer = document.referrer;

      if (!referrer) {
        referrerSource = 'direct';
      } else {
        try {
          const referrerUrl = new URL(referrer);
          const isInternal = referrerUrl.hostname === window.location?.hostname;

          if (isInternal) {
            referrerPath = referrerUrl.pathname;
            const isFromHomepage =
              referrerUrl.pathname === '/' || referrerUrl.pathname === '';
            referrerSource = isFromHomepage ? 'homepage' : 'other';

            if (isFromHomepage) {
              trackHomepageToServicesConversion();
            }
          } else {
            referrerSource = 'external';
            referrerPath = referrer.slice(0, 100);
          }
        } catch {
          referrerSource = 'other';
        }
      }
    }

    // Store funnel entry context in sessionStorage for downstream attribution
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('funnel_origin_page', 'services');
        sessionStorage.setItem('funnel_referrer_source', referrerSource);
      } catch {
        // sessionStorage unavailable — non-blocking
      }
    }

    trackServicesFunnelEntry({ referrerSource, referrerPath });
  }, []);

  return null;
}
