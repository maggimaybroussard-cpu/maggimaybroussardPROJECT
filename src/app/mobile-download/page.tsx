'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';

interface InstallStep {
  platform: 'ios' | 'android' | 'desktop';
  steps: { icon: string; title: string; detail: string }[];
}

const INSTALL_STEPS: Record<string, InstallStep> = {
  ios: {
    platform: 'ios',
    steps: [
      { icon: '🌐', title: 'Open in Safari', detail: 'Make sure you\'re using Safari browser on your iPhone or iPad' },
      { icon: '⬆️', title: 'Tap the Share button', detail: 'Tap the Share icon at the bottom of the screen (box with arrow)' },
      { icon: '➕', title: 'Add to Home Screen', detail: 'Scroll down and tap "Add to Home Screen"' },
      { icon: '✅', title: 'Tap Add', detail: 'Confirm by tapping "Add" in the top right corner' },
    ],
  },
  android: {
    platform: 'android',
    steps: [
      { icon: '🌐', title: 'Open in Chrome', detail: 'Make sure you\'re using Chrome browser on your Android device' },
      { icon: '⋮', title: 'Tap the Menu', detail: 'Tap the three-dot menu icon in the top right corner' },
      { icon: '📲', title: 'Install App', detail: 'Tap "Install App" or "Add to Home Screen"' },
      { icon: '✅', title: 'Confirm Install', detail: 'Tap "Install" to add the app to your home screen' },
    ],
  },
  desktop: {
    platform: 'desktop',
    steps: [
      { icon: '🌐', title: 'Open in Chrome or Edge', detail: 'Use Chrome or Microsoft Edge browser on your computer' },
      { icon: '📥', title: 'Look for the install icon', detail: 'Find the install icon (⊕) in the address bar on the right side' },
      { icon: '📲', title: 'Click Install', detail: 'Click the install icon and select "Install" from the popup' },
      { icon: '✅', title: 'Launch from Desktop', detail: 'The app will appear in your taskbar and as a desktop shortcut' },
    ],
  },
};

const APP_FEATURES = [
  { icon: '📁', title: 'Document Hub', desc: 'Access and download all your legal documents instantly', color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-200/50' },
  { icon: '💬', title: 'Secure Messaging', desc: 'Direct communication with your legal team', color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-200/50' },
  { icon: '🧾', title: 'Invoice & Payments', desc: 'View and pay invoices from anywhere', color: 'from-violet-500/20 to-violet-500/5', border: 'border-violet-200/50' },
  { icon: '✍️', title: 'E-Signatures', desc: 'Sign documents electronically with ease', color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-200/50' },
  { icon: '📅', title: 'Appointments', desc: 'Book and manage consultations', color: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-200/50' },
  { icon: '🤖', title: 'AI Secretary', desc: 'Get instant answers from Victoria, your AI legal secretary', color: 'from-primary/20 to-primary/5', border: 'border-primary/20' },
];

export default function MobileDownloadPage() {
  const [activePlatform, setActivePlatform] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [activeStep, setActiveStep] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [phoneScreen, setPhoneScreen] = useState<'home' | 'docs' | 'chat' | 'invoice'>('home');
  const phoneScreenInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    phoneScreenInterval.current = setInterval(() => {
      setPhoneScreen(prev => {
        const screens: Array<'home' | 'docs' | 'chat' | 'invoice'> = ['home', 'docs', 'chat', 'invoice'];
        const idx = screens.indexOf(prev);
        return screens[(idx + 1) % screens.length];
      });
    }, 3000);
    return () => { if (phoneScreenInterval.current) clearInterval(phoneScreenInterval.current); };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setCanInstall(false);
      }
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const steps = INSTALL_STEPS[activePlatform].steps;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <AppLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link
              href="/portal/login"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-all"
            >
              Open Portal
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — Full viewport */}
      <section className="min-h-screen pt-16 flex flex-col lg:flex-row items-center relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/8 rounded-full blur-2xl" />

        {/* Left content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-16 lg:py-0 max-w-2xl mx-auto lg:mx-0 lg:max-w-none">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary uppercase tracking-widest mb-6 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Client Portal App
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-foreground leading-tight mb-6">
            Your legal matters,
            <br />
            <span className="italic text-primary/80">always in your pocket</span>
          </h1>

          <p className="text-lg text-muted-foreground font-light leading-relaxed mb-8 max-w-lg">
            Install the Broussard Legal client portal as an app on your phone or computer. No app store required — works on iOS, Android, and desktop.
          </p>

          {/* Platform selector */}
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {(['ios', 'android', 'desktop'] as const).map(platform => (
              <button
                key={platform}
                onClick={() => { setActivePlatform(platform); setActiveStep(0); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  activePlatform === platform
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-card border border-border text-foreground hover:border-primary/40'
                }`}
              >
                <span>{platform === 'ios' ? '🍎' : platform === 'android' ? '🤖' : '💻'}</span>
                <span className="capitalize">{platform === 'ios' ? 'iPhone / iPad' : platform === 'android' ? 'Android' : 'Desktop'}</span>
              </button>
            ))}
          </div>

          {/* Install steps */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-8 max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              How to install on {activePlatform === 'ios' ? 'iPhone / iPad' : activePlatform === 'android' ? 'Android' : 'Desktop'}
            </p>
            <div className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`flex items-start gap-4 p-3 rounded-xl text-left transition-all duration-200 ${
                    activeStep === i ? 'bg-primary/8 border border-primary/20' : 'hover:bg-secondary/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm transition-all ${
                    activeStep === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                  }`}>
                    {i < activeStep ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold mb-0.5 ${activeStep === i ? 'text-primary' : 'text-foreground'}`}>
                      {step.icon} {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Step navigation */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
                disabled={activeStep === 0}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all"
              >
                ← Back
              </button>
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`rounded-full transition-all ${i === activeStep ? 'w-4 h-2 bg-primary' : 'w-2 h-2 bg-border hover:bg-muted-foreground'}`}
                  />
                ))}
              </div>
              {activeStep < steps.length - 1 ? (
                <button
                  onClick={() => setActiveStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
                >
                  Next →
                </button>
              ) : (
                <div className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold">
                  ✓ Done!
                </div>
              )}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            {canInstall && !installed && (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60"
              >
                {isInstalling ? (
                  <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Installing…</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install App Now</>
                )}
              </button>
            )}
            {installed && (
              <div className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 text-white rounded-full text-sm font-semibold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                App Installed!
              </div>
            )}
            <Link
              href="/portal/login"
              className="flex items-center gap-2.5 px-6 py-3.5 border border-border text-foreground rounded-full text-sm font-semibold hover:border-primary/40 hover:text-primary transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              Open in Browser
            </Link>
          </div>
        </div>

        {/* Right — Animated phone mockup */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-16 lg:py-0 lg:min-h-screen">
          <div className="relative">
            {/* Glow */}
            <div className="absolute inset-0 bg-primary/20 rounded-[3rem] blur-3xl scale-110" />

            {/* Phone */}
            <div className="relative w-64 h-[520px] bg-foreground rounded-[3rem] shadow-2xl border-4 border-foreground/80 overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-7 bg-foreground rounded-b-2xl z-10 flex items-center justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-background/20" />
                <div className="w-8 h-1.5 rounded-full bg-background/20" />
              </div>

              {/* Screen */}
              <div className="absolute inset-1 rounded-[2.5rem] overflow-hidden bg-background">
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 pt-8 pb-2">
                  <span className="text-[10px] font-semibold text-foreground">9:41</span>
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5 items-end">
                      {[2, 3, 4, 5].map(h => <div key={h} className="w-1 bg-foreground rounded-sm" style={{ height: `${h * 2}px` }} />)}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-foreground"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
                    <div className="w-5 h-2.5 border border-foreground rounded-sm relative"><div className="absolute inset-0.5 right-1 bg-foreground rounded-sm" /></div>
                  </div>
                </div>

                {/* App content — animated screens */}
                <div className="px-4 pb-4 flex flex-col h-full">
                  {/* App header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Welcome back</p>
                      <p className="text-xs font-bold text-foreground">Broussard Legal</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-[8px] font-bold text-primary-foreground">JD</span>
                    </div>
                  </div>

                  {/* Screen content */}
                  <div className="flex-1 transition-all duration-500">
                    {phoneScreen === 'home' && (
                      <div className="flex flex-col gap-2">
                        <div className="bg-primary rounded-xl p-3">
                          <p className="text-[9px] text-primary-foreground/70 mb-0.5">Active Matter</p>
                          <p className="text-[10px] font-bold text-primary-foreground">Business Formation</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <div className="flex-1 h-1 bg-primary-foreground/20 rounded-full"><div className="w-3/4 h-full bg-primary-foreground/60 rounded-full" /></div>
                            <span className="text-[8px] text-primary-foreground/70">75%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ icon: '📄', label: '8 Docs', sub: 'Available' }, { icon: '💬', label: '2 New', sub: 'Messages' }, { icon: '🧾', label: '$450', sub: 'Due' }, { icon: '📅', label: 'Mon 2pm', sub: 'Next Appt' }].map(item => (
                            <div key={item.label} className="bg-secondary rounded-xl p-2.5">
                              <span className="text-sm">{item.icon}</span>
                              <p className="text-[10px] font-bold text-foreground mt-1">{item.label}</p>
                              <p className="text-[8px] text-muted-foreground">{item.sub}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {phoneScreen === 'docs' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-foreground mb-1">📁 Documents</p>
                        {[{ name: 'Retainer Agreement.pdf', type: 'PDF', date: 'Jun 10' }, { name: 'Articles of Incorp.docx', type: 'DOC', date: 'Jun 8' }, { name: 'Operating Agreement.pdf', type: 'PDF', date: 'Jun 5' }].map(doc => (
                          <div key={doc.name} className="flex items-center gap-2 bg-secondary rounded-xl p-2.5">
                            <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                              <span className="text-[7px] font-bold text-red-600">{doc.type}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-semibold text-foreground truncate">{doc.name}</p>
                              <p className="text-[8px] text-muted-foreground">{doc.date}</p>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </div>
                        ))}
                      </div>
                    )}
                    {phoneScreen === 'chat' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-foreground mb-1">🤖 AI Secretary</p>
                        <div className="bg-secondary rounded-xl p-2.5">
                          <p className="text-[8px] font-semibold text-primary mb-1">Victoria</p>
                          <p className="text-[9px] text-foreground leading-relaxed">Good day! I'm here to help with your legal matter. How can I assist you today?</p>
                        </div>
                        <div className="bg-primary rounded-xl p-2.5 ml-4">
                          <p className="text-[9px] text-primary-foreground leading-relaxed">What does my retainer agreement mean?</p>
                        </div>
                        <div className="bg-secondary rounded-xl p-2.5">
                          <p className="text-[8px] font-semibold text-primary mb-1">Victoria</p>
                          <p className="text-[9px] text-foreground leading-relaxed">A retainer agreement establishes the attorney-client relationship and outlines fees…</p>
                        </div>
                      </div>
                    )}
                    {phoneScreen === 'invoice' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-foreground mb-1">🧾 Invoices</p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[9px] font-bold text-foreground">INV-2024-047</p>
                              <p className="text-[8px] text-muted-foreground">Due Jun 30</p>
                            </div>
                            <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Due</span>
                          </div>
                          <p className="text-sm font-bold text-foreground mt-1">$450.00</p>
                          <div className="mt-2 bg-primary rounded-lg py-1.5 text-center">
                            <p className="text-[9px] font-bold text-primary-foreground">Pay Now</p>
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[9px] font-bold text-foreground">INV-2024-046</p>
                              <p className="text-[8px] text-muted-foreground">Paid Jun 1</p>
                            </div>
                            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Paid</span>
                          </div>
                          <p className="text-sm font-bold text-foreground mt-1">$1,200.00</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom nav */}
                  <div className="flex items-center justify-around pt-2 border-t border-border mt-2">
                    {[
                      { icon: '🏠', label: 'Home', screen: 'home' },
                      { icon: '📁', label: 'Docs', screen: 'docs' },
                      { icon: '🤖', label: 'AI', screen: 'chat' },
                      { icon: '🧾', label: 'Bills', screen: 'invoice' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => setPhoneScreen(item.screen as typeof phoneScreen)}
                        className={`flex flex-col items-center gap-0.5 transition-all ${phoneScreen === item.screen ? 'opacity-100' : 'opacity-40'}`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[7px] font-medium text-foreground">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-foreground/30 rounded-full" />
            </div>

            {/* Floating badges */}
            <div className="absolute -left-8 top-16 bg-card border border-border rounded-2xl px-3 py-2 shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">✓</div>
                <div>
                  <p className="text-[9px] font-bold text-foreground">Document Ready</p>
                  <p className="text-[8px] text-muted-foreground">Retainer Agreement.pdf</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-8 bottom-24 bg-card border border-border rounded-2xl px-3 py-2 shadow-lg animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">🤖</div>
                <div>
                  <p className="text-[9px] font-bold text-foreground">AI Secretary</p>
                  <p className="text-[8px] text-muted-foreground">Available 24/7</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="py-20 px-4 sm:px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-primary mb-3">Everything in one place</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground">Built for your legal journey</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {APP_FEATURES.map(feature => (
              <div
                key={feature.title}
                className={`bg-gradient-to-br ${feature.color} border ${feature.border} rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-200`}
              >
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Install the app in under 60 seconds. No download required — it works directly from your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/portal/login"
              className="flex items-center gap-2.5 px-8 py-4 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              Open Client Portal
            </Link>
            <Link
              href="/client-deliverable-hub"
              className="flex items-center gap-2.5 px-8 py-4 border border-border text-foreground rounded-full text-sm font-semibold hover:border-primary/40 transition-all"
            >
              📁 View Your Documents
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Already have an account? <Link href="/portal/login" className="text-primary hover:underline">Sign in here</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <AppLogo className="h-7 w-auto opacity-70" />
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Broussard Legal Services. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
