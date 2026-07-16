'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

export default function AttorneyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/admin?tab=billable-hours');
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error('Login failed. Please try again.');

      // Check TOTP enrollment
      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      const totpFactor = mfaData?.totp?.find((f: { status: string }) => f.status === 'verified');
      if (totpFactor) {
        router.replace('/admin/verify-totp');
      } else {
        router.replace('/admin?tab=billable-hours');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ color: 'var(--accent)' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.02]" style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 60%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-10 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <AppLogo width={36} height={36} className="rounded-lg" />
            <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>Broussard Legal</span>
          </Link>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)', background: 'var(--muted)' }}>
            Attorney Portal
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Welcome badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Secure Attorney Access
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

            {/* Card header strip */}
            <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(74,55,40,0.02)' }}>
              {/* Scales icon */}
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--primary)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="M3 9l4 8H3" />
                    <path d="M21 9l-4 8h4" />
                    <path d="M3 9h18" />
                    <path d="M8 21h8" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-serif)' }}>
                Attorney Sign In
              </h1>
              <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                Access your billable hours dashboard and case time logs
              </p>
            </div>

            {/* Form body */}
            <div className="px-8 py-7">
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="attorney@broussardlegal.com"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none transition-colors"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 mt-2 flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {submitting ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In to Attorney Portal
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Quick access info */}
              <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
                  After signing in you'll have access to:
                </p>
                <div className="space-y-2">
                  {[
                    { icon: '⏱', label: 'Billable hours logger with live timer' },
                    { icon: '📋', label: 'Case & engagement time tracking' },
                    { icon: '📊', label: 'Retainer consumption reports' },
                    { icon: '🧾', label: 'Invoice line item generation' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/admin/login" className="text-xs transition-colors hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              Admin Login
            </Link>
            <span style={{ color: 'var(--border)' }}>·</span>
            <Link href="/" className="text-xs transition-colors hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              Back to Site
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
