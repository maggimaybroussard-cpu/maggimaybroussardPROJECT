'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  billing_interval: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  renewal_email_sent_at: string | null;
  renewal_email_status: string | null;
  inquiry_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function statusBadge(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'past_due') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'canceled' || status === 'cancelled') return 'bg-gray-100 text-gray-500 border-gray-200';
  if (status === 'trialing') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'unpaid') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function statusLabel(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return 'Cancels at Period End';
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past Due';
  if (status === 'canceled' || status === 'cancelled') return 'Cancelled';
  if (status === 'trialing') return 'Trialing';
  if (status === 'unpaid') return 'Unpaid';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RetainerSubscriptionsDashboard() {
  const [subscriptions, setSubscriptions] = useState<RetainerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [checkingHours, setCheckingHours] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningAutoRenew, setRunningAutoRenew] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('retainer_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw new Error(fetchError.message);
      setSubscriptions(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancelSubscription = async (sub: RetainerSubscription, immediately = false) => {
    setCancellingId(sub.id);
    setActionMessage(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/cancel-retainer-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subscriptionId: sub.stripe_subscription_id,
          cancelImmediately: immediately,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? 'Cancellation failed');

      setActionMessage({ type: 'success', text: result.message ?? 'Subscription updated.' });
      await fetchData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cancellation failed.' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleSendRenewalReminder = async (sub: RetainerSubscription) => {
    setSendingEmailId(sub.id);
    setActionMessage(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const daysUntil = getDaysUntil(sub.current_period_end);

      const res = await fetch(`${supabaseUrl}/functions/v1/send-retainer-renewal-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emailType: 'renewal_reminder',
          customerName: sub.customer_name,
          customerEmail: sub.customer_email,
          planName: sub.plan_name,
          amount: Number(sub.amount),
          interval: sub.billing_interval,
          currentPeriodEnd: sub.current_period_end,
          subscriptionId: sub.stripe_subscription_id,
          daysUntilRenewal: daysUntil > 0 ? daysUntil : 1,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? 'Email send failed');

      // Update renewal_email_sent_at in DB
      await supabase
        .from('retainer_subscriptions')
        .update({
          renewal_email_sent_at: new Date().toISOString(),
          renewal_email_status: 'sent',
        })
        .eq('id', sub.id);

      setActionMessage({ type: 'success', text: `Renewal reminder sent to ${sub.customer_email}.` });
      await fetchData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send email.' });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleAutoRenewCheck = async (dryRun = false) => {
    setRunningAutoRenew(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/retainer/auto-renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Auto-renew check failed');
      setActionMessage({
        type: 'success',
        text: data.message ?? `Auto-renewal check complete: ${data.sent ?? 0} email(s) sent.`,
      });
      if (!dryRun) await fetchData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Auto-renewal check failed.' });
    } finally {
      setRunningAutoRenew(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active' && !s.cancel_at_period_end);
  const pastDueSubscriptions = subscriptions.filter((s) => s.status === 'past_due');
  const cancellingSubscriptions = subscriptions.filter((s) => s.cancel_at_period_end);
  const cancelledSubscriptions = subscriptions.filter((s) => s.status === 'canceled' || s.status === 'cancelled');
  const monthlyRecurringRevenue = activeSubscriptions
    .filter((s) => s.billing_interval === 'month')
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const annualRecurringRevenue = activeSubscriptions
    .filter((s) => s.billing_interval === 'year')
    .reduce((sum, s) => sum + Number(s.amount) / 12, 0);
  const totalMRR = monthlyRecurringRevenue + annualRecurringRevenue;

  const renewingSoon = subscriptions.filter((s) => {
    if (s.status !== 'active' || s.cancel_at_period_end) return false;
    const days = getDaysUntil(s.current_period_end);
    return days >= 0 && days <= 7;
  });

  const filtered = subscriptions.filter((s) => {
    const matchSearch =
      !search ||
      s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      s.plan_name.toLowerCase().includes(search.toLowerCase()) ||
      s.stripe_subscription_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'active' && !s.cancel_at_period_end) ||
      (statusFilter === 'past_due' && s.status === 'past_due') ||
      (statusFilter === 'cancelling' && s.cancel_at_period_end) ||
      (statusFilter === 'cancelled' && (s.status === 'canceled' || s.status === 'cancelled'));
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Monthly MRR</p>
          <p className="text-2xl font-semibold text-foreground">{fmt(totalMRR)}</p>
          <p className="text-xs text-muted-foreground mt-1">{activeSubscriptions.length} active retainers</p>
        </div>
        <div className={`rounded-2xl p-5 relative overflow-hidden border ${pastDueSubscriptions.length > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Past Due</p>
          <p className={`text-2xl font-semibold ${pastDueSubscriptions.length > 0 ? 'text-red-700' : 'text-foreground'}`}>
            {pastDueSubscriptions.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pastDueSubscriptions.length > 0 ? 'Requires attention' : 'All current'}
          </p>
        </div>
        <div className={`rounded-2xl p-5 relative overflow-hidden border ${renewingSoon.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Renewing Soon</p>
          <p className={`text-2xl font-semibold ${renewingSoon.length > 0 ? 'text-amber-700' : 'text-foreground'}`}>
            {renewingSoon.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">within 7 days</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#C8965A', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total</p>
          <p className="text-2xl font-semibold text-foreground">{subscriptions.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{cancelledSubscriptions.length} cancelled</p>
        </div>
      </div>

      {/* ── Renewing Soon Alert ── */}
      {renewingSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {renewingSoon.length} retainer{renewingSoon.length !== 1 ? 's' : ''} renewing within 7 days
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {renewingSoon.map((s) => `${s.customer_name} (${fmtDate(s.current_period_end)})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Action Message ── */}
      {actionMessage && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {actionMessage.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          )}
          {actionMessage.text}
          <button onClick={() => setActionMessage(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or subscription ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active ({activeSubscriptions.length})</option>
          <option value="past_due">Past Due ({pastDueSubscriptions.length})</option>
          <option value="cancelling">Cancelling ({cancellingSubscriptions.length})</option>
          <option value="cancelled">Cancelled ({cancelledSubscriptions.length})</option>
        </select>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
        {/* Auto-Renew Scheduler Button */}
        <button
          onClick={() => handleAutoRenewCheck(false)}
          disabled={runningAutoRenew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 transition-all whitespace-nowrap disabled:opacity-60"
        >
          {runningAutoRenew ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          )}
          {runningAutoRenew ? 'Running…' : 'Auto-Renew Check'}
        </button>
        <button
          onClick={async () => {
            setCheckingHours(true);
            setActionMessage(null);
            try {
              const res = await fetch('/api/retainer/check-hours', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error ?? 'Check failed');
              const alertCount = data.alerts?.length ?? 0;
              setActionMessage({
                type: 'success',
                text: alertCount > 0
                  ? `Hours check complete — ${alertCount} depletion alert${alertCount !== 1 ? 's' : ''} sent.`
                  : `Hours check complete — no depletion alerts triggered (${data.checked ?? 0} subscriptions checked).`,
              });
            } catch (err) {
              setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Hours check failed.' });
            } finally {
              setCheckingHours(false);
            }
          }}
          disabled={checkingHours}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold uppercase tracking-widest text-amber-700 hover:bg-amber-100 transition-all whitespace-nowrap disabled:opacity-60"
        >
          {checkingHours ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          )}
          {checkingHours ? 'Checking…' : 'Check Hours'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Subscriptions Table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Retainer Subscriptions</h2>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' || search ? ' (filtered)' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-light">Active MRR</p>
            <p className="text-base font-semibold" style={{ color: '#355E3B' }}>{fmt(totalMRR)}/mo</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground font-light">
              {subscriptions.length === 0
                ? 'No retainer subscriptions yet. Subscriptions created via checkout will appear here.' :'No subscriptions match your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((sub) => {
              const daysUntilRenewal = getDaysUntil(sub.current_period_end);
              const isExpanded = expandedId === sub.id;
              const isActive = sub.status === 'active' && !sub.cancel_at_period_end;
              const isPastDue = sub.status === 'past_due';

              return (
                <div key={sub.id}>
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-emerald-100' : isPastDue ? 'bg-red-100' : 'bg-secondary/60'
                        }`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isActive ? 'text-emerald-600' : isPastDue ? 'text-red-600' : 'text-muted-foreground'}>
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{sub.customer_name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${statusBadge(sub.status, sub.cancel_at_period_end)}`}>
                            {statusLabel(sub.status, sub.cancel_at_period_end)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-light truncate">{sub.customer_email}</p>
                        <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">{sub.plan_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground font-light">Amount</p>
                        <p className="text-sm font-semibold text-foreground">
                          {fmt(Number(sub.amount), sub.currency)}/{sub.billing_interval === 'year' ? 'yr' : 'mo'}
                        </p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground font-light">Next Renewal</p>
                        <p className={`text-sm font-semibold ${
                          daysUntilRenewal <= 0 ? 'text-red-600' :
                          daysUntilRenewal <= 7 ? 'text-amber-600' : 'text-foreground'
                        }`}>
                          {sub.current_period_end ? (
                            daysUntilRenewal <= 0 ? `${Math.abs(daysUntilRenewal)}d overdue` :
                            daysUntilRenewal <= 7 ? `in ${daysUntilRenewal}d` :
                            fmtDate(sub.current_period_end)
                          ) : '—'}
                        </p>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/60 px-6 py-5 bg-secondary/10 space-y-5">
                      {/* Details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'Plan', value: sub.plan_name },
                          { label: 'Amount', value: `${fmt(Number(sub.amount), sub.currency)} / ${sub.billing_interval}` },
                          { label: 'Status', value: statusLabel(sub.status, sub.cancel_at_period_end) },
                          { label: 'Period Start', value: fmtDate(sub.current_period_start) },
                          { label: 'Period End', value: fmtDate(sub.current_period_end) },
                          { label: 'Renewal Email', value: sub.renewal_email_sent_at ? `Sent ${fmtDate(sub.renewal_email_sent_at)}` : 'Not sent' },
                          { label: 'Stripe Customer', value: sub.stripe_customer_id.slice(-12) },
                          { label: 'Subscription ID', value: sub.stripe_subscription_id.slice(-16) },
                          { label: 'Created', value: fmtDate(sub.created_at) },
                        ].map((item) => (
                          <div key={item.label} className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs text-muted-foreground font-light mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground truncate">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {/* Send renewal reminder */}
                        {isActive && (
                          <button
                            onClick={() => handleSendRenewalReminder(sub)}
                            disabled={sendingEmailId === sub.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {sendingEmailId === sub.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                            )}
                            Send Renewal Reminder
                          </button>
                        )}

                        {/* Cancel at period end */}
                        {isActive && (
                          <button
                            onClick={() => handleCancelSubscription(sub, false)}
                            disabled={cancellingId === sub.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 text-xs font-semibold uppercase tracking-widest text-amber-700 hover:bg-amber-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {cancellingId === sub.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            )}
                            Cancel at Period End
                          </button>
                        )}

                        {/* Cancel immediately */}
                        {(isActive || sub.cancel_at_period_end) && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Cancel ${sub.customer_name}'s subscription immediately? This cannot be undone.`)) {
                                handleCancelSubscription(sub, true);
                              }
                            }}
                            disabled={cancellingId === sub.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-xs font-semibold uppercase tracking-widest text-red-700 hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                            Cancel Immediately
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
