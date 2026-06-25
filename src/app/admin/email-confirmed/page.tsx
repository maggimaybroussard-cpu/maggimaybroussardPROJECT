'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';

export default function AdminEmailConfirmedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    if (countdown <= 0) {
      router?.replace('/admin/login');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

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
          <div className="rounded-2xl border p-8 shadow-sm text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

            {/* Success icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              Email Confirmed!
            </h1>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Your admin account email has been verified. You can now sign in and complete two-factor authentication setup to access the admin dashboard.
            </p>

            {/* Steps */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {[
                { label: 'Account created', done: true },
                { label: 'Email confirmed', done: true },
                { label: 'Set up 2FA', done: false },
                { label: 'Admin access', done: false },
              ]?.map((step, i, arr) => (
                <div key={step?.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: step?.done ? '#16a34a' : 'var(--muted)',
                        color: step?.done ? '#fff' : 'var(--muted-foreground)',
                      }}
                    >
                      {step?.done ? '✓' : String(i + 1)}
                    </div>
                    <p className="text-center leading-tight" style={{ fontSize: '10px', color: step?.done ? '#16a34a' : 'var(--muted-foreground)', maxWidth: '56px' }}>
                      {step?.label}
                    </p>
                  </div>
                  {i < arr?.length - 1 && (
                    <div
                      className="mb-4 mx-1"
                      style={{ width: '24px', height: '2px', background: step?.done ? '#16a34a' : 'var(--border)', flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Sign In to Admin Panel
            </Link>

            <p className="mt-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Redirecting automatically in{' '}
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>{countdown}s</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
