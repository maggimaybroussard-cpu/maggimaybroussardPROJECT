'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface TotpFactor {
  id: string;
  type: string;
  status: string;
  totp?: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export default function AdminSetupTotpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'loading' | 'enroll' | 'verify' | 'done'>('loading');
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    initSetup();
  }, []);

  const initSetup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/admin/login');
        return;
      }

      // Check if already enrolled
      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      const existing = mfaData?.totp?.find((f: any) => f.status === 'verified');
      if (existing) {
        // Already set up — go to verify
        router.replace('/admin/verify-totp');
        return;
      }

      // Enroll new TOTP factor
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Maggi May Admin' });
      if (error) throw error;

      setFactor(data as TotpFactor);
      setStep('enroll');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start TOTP setup.');
      setStep('enroll');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    setError(null);
    setSubmitting(true);
    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;

      // Verify challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ''),
      });
      if (verifyError) throw verifyError;

      setStep('done');
      setTimeout(() => router.replace('/admin'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ color: 'var(--accent)' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Authenticator Linked!</h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-10 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <AppLogo width={36} height={36} className="rounded-lg" />
            <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>Broussard Legal</span>
          </Link>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)', background: 'var(--muted)' }}>
            2FA Setup
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border p-8 shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--foreground)' }}>Set Up Authenticator</h1>
            <p className="text-sm text-center mb-8" style={{ color: 'var(--muted-foreground)' }}>
              Protect admin access with two-factor authentication
            </p>

            {/* Steps */}
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>1</div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Install an authenticator app</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Download <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP-compatible app on your phone.
                  </p>
                </div>
              </div>

              {/* Step 2 — QR Code */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>Scan the QR code</p>
                  {factor?.totp?.qr_code ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 rounded-xl border bg-white" style={{ borderColor: 'var(--border)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={factor.totp.qr_code}
                          alt="TOTP QR code — scan with your authenticator app"
                          width={180}
                          height={180}
                          className="block"
                        />
                      </div>
                      {/* Manual entry */}
                      <div className="w-full">
                        <button
                          type="button"
                          onClick={() => setShowSecret(v => !v)}
                          className="text-xs flex items-center gap-1.5 mx-auto"
                          style={{ color: 'var(--accent)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {showSecret ? 'Hide' : 'Can\'t scan? Enter key manually'}
                        </button>
                        {showSecret && factor.totp.secret && (
                          <div className="mt-2 p-3 rounded-xl border text-center" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Manual entry key:</p>
                            <code className="text-sm font-mono font-bold tracking-widest break-all" style={{ color: 'var(--foreground)' }}>
                              {factor.totp.secret}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-20 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading QR code…</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3 — Verify */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>3</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>Enter the 6-digit code</p>
                  {error && (
                    <div className="mb-3 px-3 py-2 rounded-xl text-xs border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleVerify} className="space-y-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      maxLength={7}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                      placeholder="000 000"
                      autoComplete="one-time-code"
                      className="w-full px-4 py-3 rounded-xl border text-center text-xl font-mono tracking-[0.3em] outline-none"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <button
                      type="submit"
                      disabled={submitting || code.replace(/\s/g, '').length < 6}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          Verifying…
                        </span>
                      ) : 'Activate 2FA'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
