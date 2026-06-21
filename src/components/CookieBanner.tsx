'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  detectRegion,
  saveConsent,
  hasConsent,
  logConsentEvent,
  type ConsentRegion,
} from '@/lib/consent';
import ConsentPreferenceCenter from './ConsentPreferenceCenter';

export default function CookieBanner() {
  const [region, setRegion] = useState<ConsentRegion>('none');
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const detectedRegion = detectRegion();
    setRegion(detectedRegion);

    // Only show banner if no consent has been given and region is GDPR or CCPA
    if (!hasConsent() && (detectedRegion === 'gdpr' || detectedRegion === 'ccpa')) {
      setShowBanner(true);
      logConsentEvent('banner_shown', { region: detectedRegion });
    }
  }, []);

  const handleAcceptAll = () => {
    saveConsent(region, {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    });
    logConsentEvent('accept_all', { region });
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    saveConsent(region, {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
    logConsentEvent('reject_all', { region });
    setShowBanner(false);
  };

  const handleCCPADismiss = () => {
    // CCPA: analytics true, marketing false, preferences true
    saveConsent(region, {
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: true,
    });
    logConsentEvent('ccpa_dismiss', { region });
    setShowBanner(false);
  };

  if (!showBanner || region === 'none') {
    return (
      <>
        {showPreferences && (
          <ConsentPreferenceCenter
            isOpen={showPreferences}
            onClose={() => setShowPreferences(false)}
            region={region}
          />
        )}
      </>
    );
  }

  return (
    <>
      {region === 'gdpr' && (
        <div
          role="region"
          aria-label="Cookie consent"
          aria-live="polite"
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/60 shadow-lg"
        >
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-8">
            <div className="flex flex-col gap-6">
              {/* Banner Content */}
              <div className="flex flex-col gap-4">
                <h2 className="text-sm md:text-base font-semibold text-foreground">
                  Cookie Consent
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use cookies to enhance your experience, analyze site traffic, and serve personalized content.
                  By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or
                  learn more in our{' '}
                  <Link href="/privacy" className="text-foreground underline hover:opacity-70 font-medium">
                    Privacy Policy
                  </Link>
                  {' '}and{' '}
                  <Link href="/cookies" className="text-foreground underline hover:opacity-70 font-medium">
                    Cookie Policy
                  </Link>
                  .
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={handleRejectAll}
                  aria-label="Reject all cookies"
                  className="px-4 py-2.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors duration-200 border border-border/60"
                >
                  Reject All
                </button>
                <button
                  onClick={() => setShowPreferences(true)}
                  aria-label="Manage cookie preferences"
                  className="px-4 py-2.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors duration-200 border border-border/60"
                >
                  Manage Preferences
                </button>
                <button
                  onClick={handleAcceptAll}
                  aria-label="Accept all cookies"
                  className="px-4 py-2.5 text-sm font-medium text-foreground bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-200"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {region === 'ccpa' && (
        <div
          role="region"
          aria-label="Privacy notice"
          aria-live="polite"
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/60 shadow-lg"
        >
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                We use cookies and similar technologies to enhance your experience. See our{' '}
                <Link href="/privacy#do-not-sell" className="text-foreground underline hover:opacity-70 font-medium">
                  Do Not Sell My Personal Information
                </Link>
                {' '}for your privacy rights.
              </p>
              <button
                onClick={handleCCPADismiss}
                aria-label="Dismiss privacy notice"
                className="px-4 py-2.5 text-sm font-medium text-foreground bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-200 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preference Center Modal */}
      {showPreferences && (
        <ConsentPreferenceCenter
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          region={region}
        />
      )}
    </>
  );
}
