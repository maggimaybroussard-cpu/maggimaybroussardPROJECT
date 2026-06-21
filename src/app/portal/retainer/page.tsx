'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalRetainerView } from '@/lib/analytics';

// ── Retainer tier config ──────────────────────────────────────────────────────
const RETAINER_TIERS: Record<string, { label: string; hours: number; amount: number }> = {
  essential: { label: 'Essential', hours: 10, amount: 750 },
  standard: { label: 'Standard', hours: 20, amount: 1500 },
  'full-service': { label: 'Full-Service', hours: 40, amount: 2800 },
  full_service: { label: 'Full-Service', hours: 40, amount: 2800 },
};

function getTierFromAmount(amount: number): { label: string; hours: number } | null {
  const amt = Math.round(Number(amount));
  if (amt === 750) return { label: 'Essential', hours: 10 };
  if (amt === 1500) return { label: 'Standard', hours: 20 };
  if (amt === 2800) return { label: 'Full-Service', hours: 40 };
  return null;
}

function getTierHours(planName: string, amount: number): number {
  const key = planName?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (RETAINER_TIERS[key]) return RETAINER_TIERS[key].hours;
  const fromAmt = getTierFromAmount(amount);
  return fromAmt?.hours ?? 0;
}

interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  description: string | null;
  customer_name: string;
  customer_email: string;
  created_at: string;
}

interface RetainerSubscription {
  id: string;
  plan_name: string;
  amount: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  logged_at: string;
  logged_by: string | null;
}

interface MonthlyUsage {
  month: string; // "YYYY-MM"
  label: string; // "Jan 2026"
  hours: number;
}

const WORK_TYPE_COLORS: Record<string, string> = {
  Research: '#355E3B',
  Drafting: '#C8965A',
  Calls: '#4A6FA5',
  Review: '#8B5E3C',
  Filing: '#6B7280',
  Discovery: '#7C3AED',
  Other: '#0891B2',
};

function getWorkTypeFromDescription(desc: string | null): string {
  if (!desc) return 'Other';
  const d = desc.toLowerCase();
  if (d.includes('[research]')) return 'Research';
  if (d.includes('[drafting]')) return 'Drafting';
  if (d.includes('[calls]')) return 'Calls';
  if (d.includes('[review]')) return 'Review';
  if (d.includes('[filing]')) return 'Filing';
  if (d.includes('[discovery]')) return 'Discovery';
  return 'Other';
}

function getWorkTypeColor(workType: string): string {
  return WORK_TYPE_COLORS[workType] ?? '#6B7280';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function RetainerTrackingPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<RetainerSubscription | null>(null);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      const [paymentsRes, subRes, logsRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('payment_status', 'succeeded')
          .order('created_at', { ascending: false }),
        inquiryId
          ? supabase
              .from('retainer_subscriptions')
              .select('*')
              .eq('inquiry_id', inquiryId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : supabase
              .from('retainer_subscriptions')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
        // Fetch time logs — RLS now allows clients to read via inquiry_id
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, hours, description, work_date, logged_at, logged_by')
          .order('work_date', { ascending: false })
          .order('logged_at', { ascending: false }),
      ]);

      setPayments(paymentsRes.data || []);
      setSubscription(subRes.data ?? null);
      setTimeLogs(logsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load retainer data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    let cleanup: (() => void) | undefined;

    supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const inquiryId = data?.inquiry_id ?? null;

        const retainerChannel = supabase
          .channel('portal-retainer-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'retainer_time_logs' }, () => {
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` }, () => {
            fetchData();
          });

        if (inquiryId) {
          retainerChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'retainer_subscriptions', filter: `inquiry_id=eq.${inquiryId}` }, () => {
            fetchData();
          });
        }

        retainerChannel.subscribe();
        cleanup = () => { supabase.removeChannel(retainerChannel); };
      });

    return () => { cleanup?.(); };
  }, [user, fetchData]);

  // ── Track retainer page view after data loads ─────────────────────────────
  useEffect(() => {
    if (!loading && subscription) {
      const planName = subscription.plan_name;
      const total = getTierHours(planName, subscription.amount);
      const used = timeLogs.reduce((s, l) => s + Number(l.hours), 0);
      trackPortalRetainerView(planName, used, total);
    }
  }, [loading, subscription, timeLogs]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  // ── Derived: retainer payments ────────────────────────────────────────────
  const retainerPayments = payments.filter((p) => p.payment_type === 'retainer');

  // Total purchased hours
  const purchasedHours = subscription
    ? getTierHours(subscription.plan_name, subscription.amount)
    : retainerPayments.reduce((sum, p) => {
        const tier = getTierFromAmount(p.amount);
        return sum + (tier?.hours ?? 0);
      }, 0);

  const totalRetainerPaid = retainerPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // ── Hours from real time logs ─────────────────────────────────────────────
  const totalUsedHours = timeLogs.reduce((sum, l) => sum + Number(l.hours), 0);
  const remainingHours = Math.max(0, purchasedHours - totalUsedHours);
  const usedPercent = purchasedHours > 0 ? Math.min(100, (totalUsedHours / purchasedHours) * 100) : 0;
  const remainingPercent = 100 - usedPercent;

  const hourlyRate = purchasedHours > 0 ? totalRetainerPaid / purchasedHours : 0;
  const remainingValue = remainingHours * hourlyRate;

  // ── Depletion warning level ───────────────────────────────────────────────
  const depletionLevel: 'critical' | 'warning' | 'ok' =
    purchasedHours > 0 && remainingHours <= purchasedHours * 0.1
      ? 'critical'
      : purchasedHours > 0 && remainingHours <= purchasedHours * 0.25
      ? 'warning' :'ok';

  // ── Work type breakdown ───────────────────────────────────────────────────
  const workTypeMap: Record<string, number> = {};
  timeLogs.forEach((l) => {
    const wt = getWorkTypeFromDescription(l.description);
    workTypeMap[wt] = (workTypeMap[wt] ?? 0) + Number(l.hours);
  });
  const workTypeBreakdown = Object.entries(workTypeMap)
    .map(([type, hours]) => ({ type, hours, color: getWorkTypeColor(type) }))
    .sort((a, b) => b.hours - a.hours);

  // ── Monthly usage trend (last 6 months) ──────────────────────────────────
  const monthlyMap: Record<string, number> = {};
  timeLogs.forEach((l) => {
    const month = l.work_date.slice(0, 7); // "YYYY-MM"
    monthlyMap[month] = (monthlyMap[month] ?? 0) + Number(l.hours);
  });

  // Build last 6 months array
  const monthlyUsage: MonthlyUsage[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyUsage.push({
      month: key,
      label: getMonthLabel(key),
      hours: monthlyMap[key] ?? 0,
    });
  }

  const maxMonthlyHours = Math.max(...monthlyUsage.map((m) => m.hours), 1);

  // Current month hours
  const currentMonthKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const currentMonthHours = monthlyMap[currentMonthKey] ?? 0;

  // Current tier label
  const currentTier = subscription
    ? { label: subscription.plan_name, hours: getTierHours(subscription.plan_name, subscription.amount) }
    : retainerPayments[0]
    ? getTierFromAmount(retainerPayments[0].amount)
    : null;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
          <div className="mb-8">
            <div className="w-48 h-4 bg-muted/50 rounded animate-pulse mb-3" />
            <div className="w-72 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6">
                <div className="w-32 h-4 bg-muted/50 rounded animate-pulse mb-4" />
                <div className="w-16 h-10 bg-muted/60 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Link
                href="/portal/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                href="/portal/cases"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="hidden sm:inline">Cases</span>
              </Link>
              <Link
                href="/portal/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <span className="hidden sm:inline">Invoices</span>
              </Link>
              <Link
                href="/portal/billing"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <span className="hidden sm:inline">Billing</span>
              </Link>
              <Link
                href="/portal/retainer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="hidden sm:inline">Retainer</span>
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
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

      <main className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground">Retainer Hours</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Real-time view of your consumed hours, remaining balance, and monthly usage from admin-tracked time logs.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Depletion warning banner ── */}
        {depletionLevel === 'critical' && (
          <div className="mb-6 p-4 rounded-xl border flex items-start gap-3" style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>Critical: Less than 10% of retainer hours remaining</p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">
                You have <strong>{remainingHours.toFixed(1)} hrs</strong> left. Please contact Maggi May to add more hours or renew your retainer.
              </p>
            </div>
            <Link
              href="/retainer-payment"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              style={{ background: '#DC2626', color: '#fff' }}
            >
              Add Hours
            </Link>
          </div>
        )}

        {depletionLevel === 'warning' && (
          <div className="mb-6 p-4 rounded-xl border flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#D97706' }}>Low Balance: 25% or fewer retainer hours remaining</p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">
                You have <strong>{remainingHours.toFixed(1)} hrs</strong> left. Consider adding hours soon to avoid interruption.
              </p>
            </div>
            <Link
              href="/retainer-payment"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              style={{ background: '#D97706', color: '#fff' }}
            >
              Add Hours
            </Link>
          </div>
        )}

        {purchasedHours === 0 && !error ? (
          /* ── No retainer purchased yet ── */
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(53,94,59,0.08)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-foreground mb-2">No retainer on file</h2>
            <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto mb-6">
              You haven&apos;t purchased a retainer package yet. Choose a plan to get started with dedicated hours.
            </p>
            <Link
              href="/retainer-payment"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              View Retainer Plans
            </Link>
          </div>
        ) : (
          <>
            {/* ── Summary stat strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {/* Purchased */}
              <div
                className="bg-card border border-border rounded-2xl p-5"
                style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.08) 0%, rgba(53,94,59,0.02) 100%)' }}
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Purchased</p>
                <p className="text-3xl font-semibold text-foreground">{purchasedHours}</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">hours total</p>
              </div>

              {/* Consumed */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Consumed</p>
                <p className="text-3xl font-semibold text-foreground">{totalUsedHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">
                  {purchasedHours > 0 ? `${usedPercent.toFixed(0)}% used` : 'hours logged'}
                </p>
              </div>

              {/* Remaining */}
              <div
                className="bg-card border rounded-2xl p-5"
                style={{
                  borderColor:
                    depletionLevel === 'critical' ?'rgba(220,38,38,0.4)'
                      : depletionLevel === 'warning' ?'rgba(245,158,11,0.4)' :'var(--border)',
                  background:
                    depletionLevel === 'critical' ?'rgba(220,38,38,0.04)'
                      : depletionLevel === 'warning' ?'rgba(245,158,11,0.04)'
                      : undefined,
                }}
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Remaining</p>
                <p
                  className="text-3xl font-semibold"
                  style={{
                    color:
                      depletionLevel === 'critical' ?'#DC2626'
                        : depletionLevel === 'warning' ?'#D97706' :'var(--foreground)',
                  }}
                >
                  {remainingHours.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">
                  {depletionLevel === 'critical' ?'🔴 Critical'
                    : depletionLevel === 'warning' ?'⚠ Low balance' :'hours left'}
                </p>
              </div>

              {/* This month */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">This Month</p>
                <p className="text-3xl font-semibold text-foreground">{currentMonthHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">hours logged</p>
              </div>
            </div>

            {/* ── Main bento grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── LEFT: Consumption gauge + monthly trend ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Consumption gauge card */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground">Hours Consumption</p>
                    </div>
                    {currentTier && (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}
                      >
                        {currentTier.label} Plan
                      </span>
                    )}
                  </div>

                  {/* Stacked progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground font-light mb-2">
                      <span>{totalUsedHours.toFixed(1)} hrs consumed</span>
                      <span>{purchasedHours} hrs purchased</span>
                    </div>
                    <div className="h-4 bg-muted/30 rounded-full overflow-hidden flex">
                      {workTypeBreakdown.map((wt) => {
                        const pct = purchasedHours > 0 ? (wt.hours / purchasedHours) * 100 : 0;
                        return pct > 0 ? (
                          <div
                            key={wt.type}
                            className="h-full transition-all duration-700 first:rounded-l-full"
                            style={{ width: `${pct}%`, background: wt.color, opacity: 0.85 }}
                            title={`${wt.type}: ${wt.hours.toFixed(1)} hrs`}
                          />
                        ) : null;
                      })}
                      {remainingPercent > 0 && (
                        <div
                          className="h-full rounded-r-full"
                          style={{ width: `${remainingPercent}%`, background: 'var(--muted)', opacity: 0.4 }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-light mt-1.5">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#355E3B' }} />
                        Used ({usedPercent.toFixed(0)}%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block bg-muted opacity-60" />
                        Remaining ({remainingPercent.toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  {/* Circular gauge */}
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="10" strokeOpacity="0.3" />
                        <circle
                          cx="50" cy="50" r="40"
                          fill="none"
                          stroke={depletionLevel === 'critical' ? '#DC2626' : depletionLevel === 'warning' ? '#D97706' : '#355E3B'}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(usedPercent / 100) * 251.2} 251.2`}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-semibold text-foreground">{usedPercent.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground font-light">consumed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly usage trend */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,150,90,0.12)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground">Monthly Usage Trend</p>
                    <span className="ml-auto text-xs text-muted-foreground font-light">Last 6 months</span>
                  </div>

                  <div className="flex items-end gap-2 h-28">
                    {monthlyUsage.map((m) => {
                      const barHeight = maxMonthlyHours > 0 ? (m.hours / maxMonthlyHours) * 100 : 0;
                      const isCurrent = m.month === currentMonthKey;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                            {m.hours > 0 && (
                              <div
                                className="w-full rounded-t-lg transition-all duration-500 relative"
                                style={{
                                  height: `${Math.max(barHeight, 4)}%`,
                                  background: isCurrent ? '#355E3B' : 'rgba(53,94,59,0.35)',
                                  minHeight: m.hours > 0 ? '6px' : '0px',
                                }}
                                title={`${m.label}: ${m.hours.toFixed(1)} hrs`}
                              >
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {m.hours.toFixed(1)}h
                                </span>
                              </div>
                            )}
                            {m.hours === 0 && (
                              <div className="w-full rounded-t-lg" style={{ height: '3px', background: 'var(--muted)', opacity: 0.3 }} />
                            )}
                          </div>
                          <span className={`text-xs font-light ${isCurrent ? 'font-semibold' : 'text-muted-foreground'}`} style={{ color: isCurrent ? '#355E3B' : undefined }}>
                            {m.label.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend summary row */}
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
                    {monthlyUsage.slice(-3).map((m) => (
                      <div key={m.month}>
                        <p className="text-xs text-muted-foreground font-light">{m.label}</p>
                        <p className="text-sm font-semibold text-foreground">{m.hours.toFixed(1)} hrs</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Work type breakdown */}
                {workTypeBreakdown.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground">Hours by Work Type</p>
                    </div>
                    <div className="space-y-3">
                      {workTypeBreakdown.map((wt) => {
                        const pct = totalUsedHours > 0 ? (wt.hours / totalUsedHours) * 100 : 0;
                        return (
                          <div key={wt.type}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: wt.color }} />
                                <span className="text-sm font-medium text-foreground">{wt.type}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">{wt.hours.toFixed(1)} hrs</span>
                                <span className="w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: wt.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT: Plan details + payment history ── */}
              <div className="space-y-5">

                {/* Current plan card */}
                <div
                  className="bg-card border-2 rounded-2xl p-6"
                  style={{ borderColor: depletionLevel === 'critical' ? 'rgba(220,38,38,0.4)' : depletionLevel === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(53,94,59,0.3)' }}
                >
                  <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: '#355E3B' }}>
                    Active Retainer
                  </p>
                  {currentTier ? (
                    <>
                      <h2 className="font-serif text-2xl text-foreground mb-1">{currentTier.label}</h2>
                      <p className="text-sm text-muted-foreground font-light mb-4">
                        {currentTier.hours} hrs / engagement
                      </p>
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-light">Purchased</span>
                          <span className="font-semibold text-foreground">{purchasedHours} hrs</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-light">Consumed</span>
                          <span className="font-semibold text-foreground">{totalUsedHours.toFixed(1)} hrs</span>
                        </div>
                        <div className="h-px bg-border my-1" />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-light">Remaining</span>
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                depletionLevel === 'critical' ?'#DC2626'
                                  : depletionLevel === 'warning' ?'#D97706' :'#355E3B',
                            }}
                          >
                            {remainingHours.toFixed(1)} hrs
                          </span>
                        </div>
                        {hourlyRate > 0 && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground font-light">Balance value</span>
                              <span className="font-semibold text-foreground">{formatCurrency(remainingValue)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground font-light">Effective rate</span>
                              <span className="font-semibold text-foreground">{formatCurrency(hourlyRate)}/hr</span>
                            </div>
                          </>
                        )}
                      </div>

                      {subscription && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-xs text-muted-foreground font-light">
                            Status:{' '}
                            <span
                              className="font-semibold capitalize"
                              style={{ color: subscription.status === 'active' ? '#355E3B' : 'var(--muted-foreground)' }}
                            >
                              {subscription.status}
                            </span>
                          </p>
                          {subscription.current_period_end && (
                            <p className="text-xs text-muted-foreground font-light mt-0.5">
                              Renews {formatDateShort(subscription.current_period_end)}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground font-light">No active plan detected.</p>
                  )}
                </div>

                {/* Retainer payment history */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Payment History</p>
                  {retainerPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground font-light py-4 text-center">No retainer payments found.</p>
                  ) : (
                    <div className="space-y-3">
                      {retainerPayments.map((p) => {
                        const tier = getTierFromAmount(p.amount);
                        return (
                          <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(53,94,59,0.1)' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {tier ? `${tier.label} Retainer` : 'Retainer Payment'}
                              </p>
                              <p className="text-xs text-muted-foreground font-light">
                                {formatDate(p.created_at.slice(0, 10))}
                                {tier ? ` · ${tier.hours} hrs` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(p.amount))}</p>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                Paid
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add hours CTA */}
                {depletionLevel !== 'ok' && purchasedHours > 0 && (
                  <div
                    className="rounded-2xl p-5 border"
                    style={{
                      background: depletionLevel === 'critical' ? 'rgba(220,38,38,0.05)' : 'rgba(245,158,11,0.05)',
                      borderColor: depletionLevel === 'critical' ? 'rgba(220,38,38,0.2)' : 'rgba(245,158,11,0.2)',
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {depletionLevel === 'critical' ? 'Retainer nearly depleted' : 'Running low on hours?'}
                    </p>
                    <p className="text-xs text-muted-foreground font-light mb-3">
                      {remainingHours.toFixed(1)} hrs remaining. Add more hours to keep your engagement moving.
                    </p>
                    <Link
                      href="/retainer-payment"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                      style={{ background: '#355E3B', color: '#fff' }}
                    >
                      Add More Hours
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* ── Detailed time log table ── */}
            {timeLogs.length > 0 && (
              <section className="mt-5">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Admin Time Log</h2>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                          <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Work Type</th>
                          <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Description</th>
                          <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {timeLogs.map((log) => {
                          const workType = getWorkTypeFromDescription(log.description);
                          const color = getWorkTypeColor(workType);
                          // Strip the [WorkType] prefix from display description
                          const cleanDesc = log.description
                            ? log.description.replace(/^\[[^\]]+\]\s*/, '').trim()
                            : '—';
                          return (
                            <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-5 py-3.5 text-xs text-muted-foreground font-light whitespace-nowrap">
                                {formatDateShort(log.work_date)}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                  <span className="text-sm text-foreground">{workType}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-xs truncate">
                                {cleanDesc || '—'}
                              </td>
                              <td className="px-5 py-3.5 text-right text-sm font-semibold text-foreground">
                                {Number(log.hours).toFixed(2)} hrs
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-muted/10">
                          <td colSpan={3} className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total Logged</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-foreground">{totalUsedHours.toFixed(2)} hrs</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
