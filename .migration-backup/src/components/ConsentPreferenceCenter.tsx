'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  saveConsent,
  getConsent,
  logConsentEvent,
  type ConsentRegion,
} from '@/lib/consent';

interface ConsentPreferenceCenterProps {
  isOpen: boolean;
  onClose: () => void;
  region: ConsentRegion;
}

export default function ConsentPreferenceCenter({
  isOpen,
  onClose,
  region,
}: ConsentPreferenceCenterProps) {
  const [choices, setChoices] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Load current consent on open
  useEffect(() => {
    if (isOpen) {
      const current = getConsent();
      if (current) {
        setChoices(current.choices);
      }
    }
  }, [isOpen]);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button, [role="switch"]'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstFocusableRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleToggle = (category: keyof typeof choices) => {
    if (category === 'necessary') return; // Necessary is always on
    setChoices((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSave = () => {
    saveConsent(region, choices);
    logConsentEvent('preferences_saved', { choices });
    onClose();
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    setChoices(allAccepted);
    saveConsent(region, allAccepted);
    logConsentEvent('accept_all', { region });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preference-title"
        className="bg-background border border-border/60 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 md:p-8 flex flex-col gap-6">
          {/* Header */}
          <div>
            <h2 id="preference-title" className="text-lg md:text-xl font-semibold text-foreground">
              Cookie Preferences
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Manage your cookie consent preferences below.
            </p>
          </div>

          {/* Preference Toggles */}
          <div className="flex flex-col gap-4">
            {/* Necessary */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/30">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Necessary</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Always enabled. Required for site functionality, security, and fraud prevention.
                </p>
              </div>
              <button
                role="switch"
                aria-checked
                disabled
                className="w-12 h-7 bg-accent rounded-full flex items-center justify-end px-1 cursor-not-allowed"
              >
                <div className="w-5 h-5 bg-background rounded-full" />
              </button>
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/30">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Analytics</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Help us understand how you use our site to improve your experience.
                </p>
              </div>
              <button
                ref={firstFocusableRef}
                role="switch"
                aria-checked={choices.analytics}
                onClick={() => handleToggle('analytics')}
                className={`w-12 h-7 rounded-full flex items-center transition-colors duration-200 ${
                  choices.analytics ? 'bg-accent' : 'bg-secondary border border-border/60'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-background rounded-full transition-transform duration-200 ${
                    choices.analytics ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/30">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Marketing</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow us to personalize ads and measure campaign effectiveness.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={choices.marketing}
                onClick={() => handleToggle('marketing')}
                className={`w-12 h-7 rounded-full flex items-center transition-colors duration-200 ${
                  choices.marketing ? 'bg-accent' : 'bg-secondary border border-border/60'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-background rounded-full transition-transform duration-200 ${
                    choices.marketing ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Preferences */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Remember your settings and personalize your experience.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={choices.preferences}
                onClick={() => handleToggle('preferences')}
                className={`w-12 h-7 rounded-full flex items-center transition-colors duration-200 ${
                  choices.preferences ? 'bg-accent' : 'bg-secondary border border-border/60'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-background rounded-full transition-transform duration-200 ${
                    choices.preferences ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/30">
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-background bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-200"
            >
              Accept All
            </button>
            <button
              ref={lastFocusableRef}
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors duration-200 border border-border/60"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
