'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface RetainerSub {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  currency: string;
  billing_interval: string;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string;
  renewal_accepted_at: string | null;
  renewal_declined_at: string | null;
  auto_renew_enabled: boolean | null;
}

function fmtCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RetainerRenewalPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sub, setSub] = useState<RetainerSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<'idle' | 'accepting' | 'declining' | 'done_accept' | 'done_decline'>('idle');
  const [autoRebill, setAutoRebill] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('retainer_subscriptions')
        .select('id, customer_name, customer_email, plan_name, amount, currency, billing_interval, status, current_period_end, stripe_subscription_id, renewal_accepted_at, renewal_declined_at, auto_renew_enabled')
        .eq('id', id)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setSub(data);
      setAutoRebill(data.auto_renew_enabled ?? false);

      // Pre-set state if already actioned
      if (data.renewal_accepted_at) setAction('done_accept');
      else if (data.renewal_declined_at) setAction('done_decline');

      setLoading(false);
    };
    load();
  }, [id]);

  const handleAccept = async () => {
    if (!sub) return;
    setAction('accepting');
    setError(null);
    try {
      const res = await fetch('/api/retainer/renewal-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id, response: 'accept', autoRebill }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm renewal');
      setAction('done_accept');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setAction('idle');
    }
  };

  const handleDecline = async () => {
    if (!sub) return;
    setAction('declining');
    setError(null);
    try {
      const res = await fetch('/api/retainer/renewal-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id, response: 'decline', autoRebill: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process response');
      setAction('done_decline');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setAction('declining');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !sub) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 className="text-xl font-serif text-foreground mb-2">Renewal Link Not Found</h1>
          <p className="text-sm text-muted-foreground mb-6">This renewal link may have expired or is invalid. Please contact our office for assistance.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const days = getDaysUntil(sub.current_period_end);

  // Success — Accepted
  if (action === 'done_accept') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h1 className="text-2xl font-serif text-foreground mb-2">Renewal Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you, <strong>{sub.customer_name.split(' ')[0]}</strong>. Your <strong>{sub.plan_name}</strong> retainer has been confirmed for renewal.
              {autoRebill && ' Your payment method on file will be automatically charged on the renewal date.'}
            </p>
            <div className="bg-secondary/40 rounded-2xl p-5 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold text-foreground">{sub.plan_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">{fmtCurrency(sub.amount, sub.currency)} / {sub.billing_interval}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Renewal Date</span>
                <span className="font-semibold text-foreground">{fmtDate(sub.current_period_end)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Auto-Rebill</span>
                <span className={`font-semibold ${autoRebill ? 'text-emerald-600' : 'text-muted-foreground'}`}>{autoRebill ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-5">A confirmation email has been sent to {sub.customer_email}. If you have any questions, please contact our office.</p>
            <Link href="/portal/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              Go to Client Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success — Declined
  if (action === 'done_decline') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h1 className="text-2xl font-serif text-foreground mb-2">Response Received</h1>
            <p className="text-muted-foreground mb-6">
              We've noted that you've chosen not to renew your <strong>{sub.plan_name}</strong> retainer. Your current retainer will remain active until <strong>{fmtDate(sub.current_period_end)}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-6">Our team will reach out to discuss your options and ensure a smooth transition. If you change your mind, please contact us before the expiry date.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Contact Us
              </Link>
              <Link href="/portal/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors">
                Client Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <p className="text-lg font-serif text-foreground">Broussard Legal Services</p>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          {/* Banner */}
          <div className={`px-6 py-4 ${days <= 7 ? 'bg-red-600' : days <= 14 ? 'bg-orange-500' : 'bg-primary'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Retainer Renewal Notice</p>
                <p className="text-white/80 text-xs">
                  {days <= 0 ? 'Your retainer has expired' : `Your retainer expires in ${days} day${days !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Greeting */}
            <div>
              <h1 className="text-xl font-serif text-foreground mb-1">Hello, {sub.customer_name.split(' ')[0]}</h1>
              <p className="text-sm text-muted-foreground">
                Your retainer agreement with Broussard Legal Services is coming up for renewal. Please review the details below and confirm your renewal preference.
              </p>
            </div>

            {/* Plan Details */}
            <div className="bg-secondary/40 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Renewal Summary</h2>
              <div className="space-y-2">
                {[
                  { label: 'Plan', value: sub.plan_name },
                  { label: 'Renewal Amount', value: `${fmtCurrency(sub.amount, sub.currency)} / ${sub.billing_interval}` },
                  { label: 'Current Period Ends', value: fmtDate(sub.current_period_end) },
                  { label: 'New Period Starts', value: fmtDate(sub.current_period_end) },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Rebill Toggle */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-800">⚡ Enable Auto-Rebill</p>
                  <p className="text-xs text-blue-600 mt-0.5">Automatically charge your saved payment method on the renewal date — no action needed each cycle.</p>
                </div>
                <button
                  onClick={() => setAutoRebill(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${autoRebill ? 'bg-blue-600' : 'bg-blue-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoRebill ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={action === 'accepting' || action === 'declining'}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {action === 'accepting' ? (
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                )}
                {action === 'accepting' ? 'Confirming...' : `Confirm Renewal${autoRebill ? ' with Auto-Rebill' : ''}`}
              </button>

              <button
                onClick={handleDecline}
                disabled={action === 'accepting' || action === 'declining'}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-secondary border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-60"
              >
                {action === 'declining' ? (
                  <span className="w-4 h-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                ) : null}
                {action === 'declining' ? 'Processing...' : 'I do not wish to renew'}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Questions? Contact us at{' '}
              <a href="mailto:maggimay@broussardlegalservices.com" className="text-primary hover:underline">
                maggimay@broussardlegalservices.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
