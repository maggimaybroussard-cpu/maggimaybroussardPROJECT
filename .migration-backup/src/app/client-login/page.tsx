'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

export default function ClientLoginPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/portal/invoices');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/portal/invoices');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
      </div>

      {/* Header */}
      <header
        className="relative z-10 px-6 md:px-10 py-5 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <AppLogo
              size={34}
              className="transition-transform duration-300 group-hover:scale-105"
            />
            <span
              className="font-serif text-base tracking-tight"
              style={{ color: '#355E3B' }}
            >
              Maggi May Broussard
            </span>
          </Link>
          <Link
            href="/contact"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-200"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Need help?
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-[440px]">

          {/* Portal badge */}
          <div className="flex justify-center mb-8">
            <div
              className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(200, 150, 90, 0.08)',
                borderColor: 'rgba(200, 150, 90, 0.25)',
                color: 'var(--accent)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secure Client Access
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-4xl md:text-5xl mb-3" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Invoice &amp; Payment Portal
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Enter your credentials to access your invoices, payment history, and billing details.
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border p-8 shadow-sm"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: '0 4px 32px rgba(74, 55, 40, 0.07)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border text-sm placeholder:opacity-40 transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--input)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    // @ts-ignore
                    '--tw-ring-color': 'rgba(200, 150, 90, 0.3)',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-xl border text-sm placeholder:opacity-40 transition-all duration-200 focus:outline-none focus:ring-2"
                    style={{
                      background: 'var(--input)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity duration-200 hover:opacity-70"
                    style={{ color: 'var(--muted-foreground)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-2.5 p-3.5 rounded-xl border text-sm"
                  style={{
                    background: 'rgba(220, 38, 38, 0.05)',
                    borderColor: 'rgba(220, 38, 38, 0.2)',
                    color: '#dc2626',
                  }}
                  role="alert"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                {submitting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Access Portal
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* Portal dashboard link */}
            <Link
              href="/portal/login"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                background: 'transparent',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Full Client Portal
            </Link>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/contact"
                className="font-semibold underline underline-offset-2 transition-opacity duration-200 hover:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                Submit an inquiry
              </Link>{' '}
              to receive access credentials.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secured with 256-bit encryption
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
