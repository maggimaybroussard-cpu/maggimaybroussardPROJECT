'use client';

/**
 * Mixpanel browser SDK wrapper.
 *
 * Initialises Mixpanel once (client-side only) and exposes:
 *  - mpTrack(eventName, props)  — fire a Mixpanel event
 *  - mpIdentify(userId)         — link events to an identified user
 *  - mpSetProfile(props)        — set / update People profile properties
 *  - mpReset()                  — reset identity on logout
 */

import type { Dict } from 'mixpanel-browser';

// ── Lazy-load the SDK so it never runs on the server ─────────────────────────

let _mp: typeof import('mixpanel-browser').default | null = null;
let _initialised = false;

async function getMixpanel() {
  if (typeof window === 'undefined') return null;
  if (_mp) return _mp;

  try {
    const mod = await import('mixpanel-browser');
    _mp = mod.default;

    if (!_initialised) {
      const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? '';
      if (!token) return null;

      _mp.init(token, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: false,          // we fire page views manually
        persistence: 'localStorage',
        ignore_dnt: false,
        batch_requests: true,
        batch_flush_interval_ms: 2000,
      });
      _initialised = true;
    }
    return _mp;
  } catch {
    return null;
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Fire a Mixpanel event with optional properties.
 * Safe to call server-side (no-ops silently).
 */
export async function mpTrack(eventName: string, props: Dict = {}) {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.track(eventName, props);
  } catch {
    // never throw — analytics must not break the app
  }
}

/**
 * Identify the current user so all subsequent events are linked to them.
 * Call after login / signup.
 */
export async function mpIdentify(userId: string) {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.identify(userId);
  } catch {
    // silent
  }
}

/**
 * Set People profile properties for the identified user.
 */
export async function mpSetProfile(props: Dict) {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.people.set(props);
  } catch {
    // silent
  }
}

/**
 * Set People profile properties only if not already set (first-touch values).
 */
export async function mpSetProfileOnce(props: Dict) {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.people.set_once(props);
  } catch {
    // silent
  }
}

/**
 * Increment a numeric People profile property (e.g. total_payments, message_count).
 */
export async function mpIncrementProfile(props: Record<string, number>) {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.people.increment(props);
  } catch {
    // silent
  }
}

/**
 * Reset identity — call on logout so the next session starts anonymous.
 */
export async function mpReset() {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.reset();
  } catch {
    // silent
  }
}
