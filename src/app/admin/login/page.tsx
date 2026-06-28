'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { logAuditEvent } from '@/lib/auditLogger';

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // ── 2FA CHECK (commented out — re-enable when ready) ──────────────────
        // checkTotpAndRedirect(session.user.id);
        // ─────────────────────────────────────────────────────────────────────
        router.replace('/admin');
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  // ── 2FA redirect helper (kept for future activation) ──────────────────────
  // const checkTotpAndRedirect = async (userId: string) => {
  //   try {
  //     const { data, error } = await supabase.auth.mfa.listFactors();
  //     if (error) throw error;
  //     const totpFactor = data?.totp?.find((f: any) => f.status === 'verified');
  //     if (totpFactor) {
  //       router.replace('/admin/verify-totp');
  //     } else {
  //       router.replace('/admin/setup-totp');
  //     }
  //   } catch {
  //     router.replace('/admin');
  //   }
  // };
  // ──────────────────────────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Authentication service is not configured. Please contact the administrator.');
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('not confirmed')
        ) {
          setError('Your admin account email has not been confirmed yet. Please check your inbox for the confirmation link and click it to activate your account.');
          return;
        }
        throw error;
      }

      if (!data.user) throw new Error('Login failed. Please try again.');

      logAuditEvent({
        action_type: 'user_login',
        actor_email: data.user.email ?? email,
        actor_id: data.user.id,
        description: `Admin login: ${data.user.email ?? email}`,
        metadata: { provider: 'email' },
      });

      // ── 2FA MFA check (commented out — re-enable when ready) ──────────────
      // const { data: mfaData, error: mfaError } = await supabase.auth.mfa.listFactors();
      // if (mfaError) throw mfaError;
      // const totpFactor = mfaData?.totp?.find((f: any) => f.status === 'verified');
      // if (totpFactor) {
      //   router.replace('/admin/verify-totp');
      // } else {
      //   router.replace('/admin/setup-totp');
      // }
      // ──────────────────────────────────────────────────────────────────────

      router.replace('/admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : 'Invalid email or password.');
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as any).status : null;
      if (status === 401 || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('apikey') || msg.toLowerCase().includes('invalid key')) {
        setError('Authentication service configuration error. Please contact the administrator.');
      } else {
        setError(msg || 'Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Authentication service is not configured. Please contact the administrator.');
      }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=/admin/email-confirmed`,
        },
      });
      if (error) throw error;

      if (data.user && !data.session) {
        setSuccessMessage('Account created! A confirmation link has been sent to your email. Click that link to activate your admin account before signing in.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else if (data.session) {
        router.replace('/admin');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : 'Sign up failed. Please try again.');
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as any).status : null;
      if (status === 401 || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('apikey') || msg.toLowerCase().includes('invalid key')) {
        setError('Authentication service configuration error. Please contact the administrator.');
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Authentication service is not configured. Please contact the administrator.');
      }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/admin/reset-password`,
      });
      if (error) throw error;
      setSuccessMessage('Password reset link sent! Check your email inbox (and spam folder). The link expires in 1 hour.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : 'Failed to send reset email. Please try again.');
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as any).status : null;
      if (status === 401 || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('apikey') || msg.toLowerCase().includes('invalid key')) {
        setError('Authentication service configuration error. Please contact the administrator.');
      } else {
        setError(msg || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
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
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-10 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <AppLogo width={36} height={36} className="rounded-lg" />
            <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>Broussard Legal</span>
          </Link>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)', background: 'var(--muted)' }}>
            Admin Access
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border p-8 shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)', opacity: 0.9 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>

            {/* Mode Toggle — only show for signin/signup */}
            {mode !== 'forgot' && (
              <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--muted)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{
                    background: mode === 'signin' ? 'var(--card)' : 'transparent',
                    color: mode === 'signin' ? 'var(--foreground)' : 'var(--muted-foreground)',
                    boxShadow: mode === 'signin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{
                    background: mode === 'signup' ? 'var(--card)' : 'transparent',
                    color: mode === 'signup' ? 'var(--foreground)' : 'var(--muted-foreground)',
                    boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Titles */}
            <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--foreground)' }}>
              {mode === 'signin' ? 'Admin Sign In' : mode === 'signup' ? 'Create Admin Account' : 'Reset Password'}
            </h1>
            <p className="text-sm text-center mb-8" style={{ color: 'var(--muted-foreground)' }}>
              {mode === 'signin' ? "Secure access to Maggi May's dashboard"
                : mode === 'signup' ?'Register a new admin account' : "Enter your email and we'll send a reset link"}
            </p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)', color: '#16a34a' }}>
                {successMessage}
              </div>
            )}

            {/* ── SIGN IN FORM ── */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Forgot password?
                    </button>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 mt-2"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Signing in…
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>
            )}

            {/* ── SIGN UP FORM ── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none transition-colors"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none transition-colors"
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 mt-2"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Creating account…
                    </span>
                  ) : 'Create Account'}
                </button>
              </form>
            )}

            {/* ── FORGOT PASSWORD FORM ── */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Sending…
                    </span>
                  ) : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full py-2 text-sm text-center hover:underline"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  ← Back to Sign In
                </button>
              </form>
            )}

            {/* Security note */}
            {mode !== 'forgot' && (
              <div className="mt-6 pt-5 border-t flex items-start gap-2.5" style={{ borderColor: 'var(--border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  {mode === 'signin' ?'This is a secure admin area. Only authorized personnel may access this dashboard.' :'After creating your account, you\'ll need to confirm your email before accessing the admin dashboard.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
