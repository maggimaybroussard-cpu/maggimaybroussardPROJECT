'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalLogin } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';

export default function ClientPortalLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const redirectTo = searchParams.get('redirectTo') ?? '/portal/dashboard';
  const callbackError = searchParams.get('error');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo, mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      trackPortalLogin('email');
      logPortalEvent('portal_login', { method: 'email' });
      router.replace(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(redirectTo);
      trackPortalLogin('google');
      logPortalEvent('portal_login', { method: 'google' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  // Show spinner only after mount + while auth is loading
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal header */}
      <header className="px-6 md:px-10 py-5 border-b border-border/40">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <AppLogo size={32} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="font-serif text-base tracking-tight" style={{ color: '#355E3B' }}>
            Maggi May Broussard
          </span>
        </Link>
      </header>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-xs font-semibold uppercase tracking-widest text-primary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Client Portal
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <h1 className="font-serif text-3xl text-foreground mb-2">Welcome back</h1>
              <p className="text-sm text-muted-foreground font-light">
                Sign in to view your intake status, contracts, payments, and documents.
              </p>
            </div>

            {/* Callback error banner */}
            {callbackError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm mb-5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Your invite link has expired or is invalid. Please sign in with your credentials below.
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || submitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mb-5"
            >
              {googleLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-gray-500">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/portal/forgot-password"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  'Sign In to Portal'
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/portal/register" className="text-primary hover:underline font-medium">
              Click here to create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
