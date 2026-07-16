'use client';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mixpanelInstance: any = null;

async function getMixpanel() {
  if (typeof window === 'undefined') return null;
  if (!mixpanelInstance) {
    const mod = await import('mixpanel-browser');
    mixpanelInstance = mod.default;
  }
  return mixpanelInstance;
}

export async function initMixpanel() {
  if (initialized || !MIXPANEL_TOKEN || typeof window === 'undefined') return;
  const mp = await getMixpanel();
  if (!mp) return;
  mp.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: false,
    persistence: 'localStorage',
    ignore_dnt: false,
    batch_requests: true,
  });
  initialized = true;
}

export async function mpTrack(eventName: string, properties: Record<string, unknown> = {}) {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    await initMixpanel();
    const mp = await getMixpanel();
    if (mp) mp.track(eventName, properties);
  } catch {
    // Silently fail — analytics should never break the app
  }
}

export async function mpPageView(path: string, title?: string) {
  await mpTrack('Page View', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    url: typeof window !== 'undefined' ? window.location.href : '',
  });
}

export async function mpIdentify(userId: string, traits?: Record<string, unknown>) {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    await initMixpanel();
    const mp = await getMixpanel();
    if (!mp) return;
    mp.identify(userId);
    if (traits) {
      mp.people.set(traits);
    }
  } catch {
    // Silently fail
  }
}

export async function mpReset() {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
  try {
    const mp = await getMixpanel();
    if (mp) mp.reset();
  } catch {
    // Silently fail
  }
}
