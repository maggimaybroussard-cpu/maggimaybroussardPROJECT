'use client';

import React, { useState } from 'react';
import { trackEmailOptInSubmit } from '@/lib/analytics';

const CHECKLIST_ITEMS = [
  'Pre-litigation document checklist',
  'Contract review red-flag triggers',
  'Deposition preparation timeline',
  'Discovery request & response templates',
  'Court filing deadline tracker',
  'Client communication log best practices',
  'Settlement demand letter framework',
  'Witness interview preparation guide',
];

export default function EmailOptInSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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

      trackEmailOptInSubmit(email.trim());
      setStatus('success');
      setEmail('');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <section className="py-16 md:py-28 bg-secondary relative overflow-hidden" id="email-optin" aria-label="Free paralegal checklist download">
      {/* Subtle background accent */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, var(--accent) 0%, transparent 60%)' }}
      />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-10">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Left: Offer copy */}
          <div>
            {/* Eyebrow */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              Free Resource
            </p>

            <h2 className="text-foreground mb-4 font-normal" style={{ fontSize: 'clamp(1.7rem, 3vw, 2.6rem)', lineHeight: 1.2, fontFamily: 'Georgia, serif' }}>
              Six attorney-tested areas where paralegal support makes the
              <br />
              <span className="italic text-accent">biggest difference</span>
            </h2>

            <p className="text-muted-foreground text-base md:text-[16px] font-light leading-[1.8] mb-8 tracking-wide">
              Delivered free to your inbox.
            </p>

            {/* Checklist preview */}
            <ul className="space-y-2.5 mb-8">
              {CHECKLIST_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* micro-copy removed */}
          </div>

          {/* Right: Form card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            {status === 'success' ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-5">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-foreground font-semibold text-lg mb-2" style={{ fontFamily: 'Georgia, serif' }}>Check your inbox!</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We sent a <strong className="text-foreground">confirmation email</strong> to your address. Click the link inside to verify your subscription and receive your free checklist.
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground tracking-wide">
                  Don&apos;t see it? Check your spam or promotions folder.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-1">Get instant access</p>
                  <h3 className="text-foreground text-xl font-normal" style={{ fontFamily: 'Georgia, serif' }}>
                    Download the checklist — free
                  </h3>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    Enter your email and I&apos;ll send it straight to you, along with practical tips on working with a contract paralegal.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    aria-label="Email address to receive the free paralegal checklist"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-5 py-4 rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all duration-200 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading' || !email.trim()}
                    className="w-full px-7 py-4 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 shadow-md shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'loading' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

                <p className="mt-4 text-[11px] text-muted-foreground tracking-wide text-center">
                  No spam, ever. Unsubscribe at any time.
                </p>
              </>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
