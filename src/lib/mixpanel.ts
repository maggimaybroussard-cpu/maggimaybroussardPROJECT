'use client';

import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

export function initMixpanel() {
  if (initialized || !MIXPANEL_TOKEN || typeof window === 'undefined') return;
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: false, // We handle page views manually for SPA routing
    persistence: 'localStorage',
    ignore_dnt: false,
    batch_requests: true,
  });
  initialized = true;
}

export function mpTrack(eventName: string, properties: Record<string, unknown> = {}) {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    initMixpanel();
    mixpanel.track(eventName, properties);
  } catch {
    // Silently fail — analytics should never break the app
  }
}

export function mpPageView(path: string, title?: string) {
  mpTrack('Page View', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    url: typeof window !== 'undefined' ? window.location.href : '',
  });
}

export function mpIdentify(userId: string, traits?: Record<string, unknown>) {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    initMixpanel();
    mixpanel.identify(userId);
    if (traits) {
      mixpanel.people.set(traits);
    }
  } catch {
    // Silently fail
  }
}

export function mpReset() {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    mixpanel.reset();
  } catch {
    // Silently fail
  }
}
