'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminMessagesDashboard from '../components/AdminMessagesDashboard';
import AppLogo from '@/components/ui/AppLogo';

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/messages', label: 'Messages' },
];

export default function AdminMessagesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) {
        router?.replace('/admin/login');
        return;
      }
      setIsAdmin(true);
      setAdminName(user?.email ?? 'Admin');
      setAuthChecked(true);
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase?.auth?.signOut();
    router?.replace('/admin/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <AppLogo className="h-7 w-auto" />
              </Link>
              <span className="text-muted-foreground/40 text-sm hidden sm:block">·</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:block">
                Admin
              </span>
            </div>

            <nav className="hidden sm:flex items-center gap-0.5">
              {ADMIN_NAV?.map((item) => {
                const active = item?.href === '/admin/messages';
                return (
                  <Link
                    key={item?.href}
                    href={item?.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors ${
                      active
                        ? 'bg-secondary/60 text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                    }`}
                  >
                    {item?.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[180px]">
                {adminName}
              </span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-50"
              >
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Page title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-foreground mb-1">Messages</h1>
            <p className="text-sm text-muted-foreground font-light">
              All client conversation threads — view, reply, and track read receipts.
            </p>
          </div>
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Messages dashboard */}
        <AdminMessagesDashboard />
      </main>
    </div>
  );
}
