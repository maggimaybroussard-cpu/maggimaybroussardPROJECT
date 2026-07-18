'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

import AppLogo from '@/components/ui/AppLogo';
import TypeformIntakeEmbed from '@/components/TypeformIntakeEmbed';

export default function ClientIntakePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router?.replace('/portal/login?redirectTo=/portal/intake-questionnaire');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setClientName(user?.user_metadata?.full_name || user?.email?.split('@')?.[0] || '');
      setClientEmail(user?.email || '');
    }
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router?.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/portal/dashboard" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Broussard Legal Services
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/portal/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <span className="text-muted-foreground/40 text-xs">›</span>
            <span className="text-xs text-foreground font-medium">Intake Questionnaire</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-foreground mb-2">Pre-Consultation Questionnaire</h1>
          <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xl">
            Please complete this intake form before your consultation. Your answers help Maggi May prepare and make the most of your time together.
          </p>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-6 border"
          style={{ background: 'rgba(53,94,59,0.06)', borderColor: 'rgba(53,94,59,0.2)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(53,94,59,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">Confidential &amp; Secure</p>
            <p className="text-xs text-muted-foreground font-light leading-relaxed">
              Your responses are protected by attorney-client privilege and stored securely. This form typically takes 5–10 minutes to complete.
            </p>
          </div>
        </div>

        {/* Typeform embed */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <TypeformIntakeEmbed
            clientName={clientName}
            clientEmail={clientEmail}
            onSubmit={() => setSubmitted(true)}
          />
        </div>

        {submitted && (
          <div
            className="mt-6 flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: 'rgba(53,94,59,0.06)', borderColor: 'rgba(53,94,59,0.2)' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Intake submitted successfully!</p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">
                Maggi May will review your responses before your consultation.{' '}
                <Link href="/portal/dashboard" className="underline" style={{ color: '#355E3B' }}>Return to dashboard →</Link>
              </p>
            </div>
          </div>
        )}

        {/* Navigation links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/portal/signatures"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Sign Retainer Agreement
          </Link>
          <Link
            href="/portal/documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            View Documents
          </Link>
        </div>
      </main>
    </div>
  );
}
