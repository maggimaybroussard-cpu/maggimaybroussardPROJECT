'use client';

import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    try {
      if (localStorage.getItem('pwa_install_dismissed') === 'true') return;
    } catch {
      // ignore
    }

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const safari = /safari/i.test(ua) && !/chrome/i.test(ua);
    setIsIOS(ios && safari);

    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    setIsStandalone(standalone);

    // Show iOS prompt after a short delay (no beforeinstallprompt on iOS)
    if (ios && safari && !standalone) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    try {
      localStorage.setItem('pwa_install_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  if (!showBanner || dismissed || isStandalone) return null;

  return (
    <div
      role="banner"
      aria-label="Install app prompt"
      className="fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-card border border-border sm:rounded-2xl shadow-2xl p-4 sm:p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {/* App icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Install Broussard Legal</p>

        {isIOS ? (
          <>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Add to your Home Screen for quick access.
            </p>
            {/* iOS-specific instructions */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 rounded-lg px-2.5 py-2">
              <span>Tap</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              <span>then <strong className="text-foreground">Add to Home Screen</strong></span>
            </div>
            <button
              onClick={handleDismiss}
              className="mt-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 min-h-[44px] flex items-center touch-manipulation"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Add to your home screen for quick access — works on Windows, Mac, iOS &amp; Android.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px] touch-manipulation"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px] touch-manipulation"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Close install prompt"
        className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors touch-manipulation"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
