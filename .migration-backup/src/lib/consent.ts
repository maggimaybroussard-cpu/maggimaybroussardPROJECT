'use client';

export type ConsentRegion = 'gdpr' | 'ccpa' | 'none';

export interface ConsentRecord {
  version: '1.0';
  timestamp: string;
  region: ConsentRegion;
  choices: {
    necessary: true;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  userAgent: string;
}

const APP_NAME = 'maggimaybroussard';
const CONSENT_KEY = APP_NAME.toLowerCase()
  .replace(/[^a-z0-9]/g, '_')
  .replace(/_+/g, '_') + '_consent_v1';

/**
 * Detect user's region based on browser locale and timezone
 * No external API calls — uses navigator.language and Intl API
 */
export function detectRegion(): ConsentRegion {
  if (typeof navigator === 'undefined') return 'gdpr'; // SSR default

  const lang = navigator.language || '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  const euTZPrefixes = [
    'Europe/',
    'Atlantic/Azores',
    'Atlantic/Canary',
    'Atlantic/Faroe',
    'Atlantic/Madeira',
    'Arctic/Longyearbyen',
  ];

  const usTZPrefixes = ['America/'];

  const euCountryCodes = [
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB', 'IS', 'LI',
    'NO', 'CH',
  ];

  const isEU =
    euTZPrefixes.some((p) => tz.startsWith(p)) ||
    euCountryCodes.some((c) => lang.toUpperCase().endsWith('-' + c));

  const isUS =
    usTZPrefixes.some((p) => tz.startsWith(p)) &&
    (lang.startsWith('en-US') || lang.startsWith('en-CA'));

  if (isEU) return 'gdpr';
  if (isUS) return 'ccpa';
  return 'none';
}

/**
 * Save consent choices to localStorage
 */
export function saveConsent(region: ConsentRegion, choices: ConsentRecord['choices']): void {
  if (typeof window === 'undefined') return;

  const record: ConsentRecord = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    region,
    choices,
    userAgent: navigator.userAgent,
  };

  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn('Failed to save consent:', e);
  }
}

/**
 * Retrieve consent choices from localStorage
 */
export function getConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ConsentRecord;
  } catch (e) {
    console.warn('Failed to retrieve consent:', e);
    return null;
  }
}

/**
 * Check if user has already given consent
 */
export function hasConsent(): boolean {
  return getConsent() !== null;
}

/**
 * Get current consent choices, or defaults if not set
 */
export function getConsentChoices(): ConsentRecord['choices'] {
  const record = getConsent();
  if (record) {
    return record.choices;
  }
  // Default: necessary ON, all others OFF
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  };
}

/**
 * Check if a specific consent category is enabled
 */
export function isConsentEnabled(category: keyof ConsentRecord['choices']): boolean {
  const choices = getConsentChoices();
  return choices[category] ?? false;
}

/**
 * Clear all consent data
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch (e) {
    console.warn('Failed to clear consent:', e);
  }
}

/**
 * Log consent event for audit trail
 */
export function logConsentEvent(
  action: 'banner_shown' | 'accept_all' | 'reject_all' | 'preferences_saved' | 'ccpa_dismiss',
  details?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'consent_' + action, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}
