'use client';

import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mmb_optin_dismissed';

export default function EmailOptInModal() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  }, []);

  useEffect(() => {
    // Don't show if already dismissed this session
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}

    // Timed trigger: show after 8 seconds
    const timer = setTimeout(() => setVisible(true), 8000);

    // Exit-intent trigger: mouse leaves viewport from top
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        clearTimeout(timer);
        try {
          if (!sessionStorage.getItem(STORAGE_KEY)) setVisible(true);
        } catch {
          setVisible(true);
        }
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/email-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), leadMagnet: 'paralegal-checklist' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Something went wrong. Please try again.');
      }

      setStatus('success');
      setEmail('');
      // Auto-close after success
      setTimeout(() => dismiss(), 3500);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Free paralegal checklist offer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Accent top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-accent via-accent/70 to-accent/40" />

        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Close newsletter modal"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        <div className="px-6 pt-5 pb-6">
          {status === 'success' ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-foreground font-semibold text-lg mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                Check your inbox!
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We sent a <strong className="text-foreground">confirmation email</strong> to your address. Click the link inside to verify your subscription and receive your free checklist.
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground tracking-wide">
                Don&apos;t see it? Check your spam or promotions folder.
              </p>
            </div>
          ) : (
            <>
              {/* Eyebrow */}
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-accent mb-3 flex items-center gap-2">
                <span className="w-6 h-px bg-accent/60" />
                Free Resource
              </p>

              <h2 className="text-foreground mb-2 font-normal" style={{ fontSize: '1.3rem', lineHeight: 1.25, fontFamily: 'Georgia, serif' }}>
                The Paralegal
                <br />
                <span className="italic text-accent">Readiness Checklist</span>
              </h2>

              <p className="text-muted-foreground text-xs font-light leading-[1.7] mb-4 tracking-wide">
                Six attorney-tested areas where paralegal support makes the biggest difference — delivered free to your inbox.
              </p>

              {/* Mini checklist */}
              <ul className="space-y-1.5 mb-5">
                {[
                  'Pre-litigation document checklist',
                  'Contract review red-flag triggers',
                  'Deposition preparation timeline',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-xs text-foreground/80">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center">
                      <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
                <li className="text-xs text-muted-foreground pl-6 italic">+ more inside…</li>
              </ul>

              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  aria-label="Email address to receive the free paralegal checklist"
                  required
                  disabled={status === 'loading'}
                  className="w-full px-4 py-3 rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all duration-200 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  className="w-full px-7 py-3 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 shadow-md shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Sending…
                    </span>
                  ) : (
                    'Send Me the Checklist →'
                  )}
                </button>
              </form>

              {status === 'error' && (
                <p role="alert" className="mt-3 text-xs text-red-500 tracking-wide">{errorMsg}</p>
              )}

              <p className="mt-3 text-[11px] text-muted-foreground tracking-wide text-center">
                No spam, ever. Unsubscribe at any time.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
