'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetainerSub {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  billing_interval: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  renewal_email_sent_at: string | null;
  renewal_email_status: string | null;
  auto_renew_enabled?: boolean | null;
  renewal_accepted_at?: string | null;
  renewal_declined_at?: string | null;
}

interface RenewalLog {
  id: string;
  subscription_id: string;
  customer_name: string;
  customer_email: string;
  notification_type: string;
  channel: string;
  sent_at: string;
  status: string;
  days_before_expiry: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0 }).format(amount);
}

function getDaysUntil(dateStr: string | null): number {
  if (!dateStr) return 999;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number) {
  if (days <= 0) return 'bg-red-100 text-red-700 border-red-200';
  if (days <= 7) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (days <= 30) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RetainerRenewalNotificationsDashboard() {
  const [subs, setSubs] = useState<RetainerSub[]>([]);
  const [logs, setLogs] = useState<RenewalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'upcoming' | 'logs' | 'settings'>('upcoming');
  const [sending, setSending] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [autoRebillMap, setAutoRebillMap] = useState<Record<string, boolean>>({});

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: subsData } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, customer_email, plan_name, amount, currency, billing_interval, status, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, renewal_email_sent_at, renewal_email_status, auto_renew_enabled, renewal_accepted_at, renewal_declined_at')
      .in('status', ['active', 'trialing'])
      .order('current_period_end', { ascending: true });

    const { data: logsData } = await supabase
      .from('retainer_renewal_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);

    setSubs(subsData || []);
    setLogs(logsData || []);

    // Build auto-rebill map from DB
    const rebillMap: Record<string, boolean> = {};
    (subsData || []).forEach(s => { rebillMap[s.id] = s.auto_renew_enabled ?? false; });
    setAutoRebillMap(rebillMap);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Trigger 30-day renewal notification for a specific subscription
  const sendRenewalNotification = async (sub: RetainerSub, channels: ('email' | 'sms')[]) => {
    setSending(sub.id);
    try {
      const res = await fetch('/api/retainer/send-renewal-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          customerEmail: sub.customer_email,
          customerPhone: sub.customer_phone,
          planName: sub.plan_name,
          amount: sub.amount,
          interval: sub.billing_interval,
          currentPeriodEnd: sub.current_period_end,
          stripeSubscriptionId: sub.stripe_subscription_id,
          stripeCustomerId: sub.stripe_customer_id,
          channels,
          daysBeforeExpiry: getDaysUntil(sub.current_period_end),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send notification');
      showToast(`Renewal notification sent via ${channels.join(' + ')} to ${sub.customer_name}`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send notification', 'error');
    } finally {
      setSending(null);
    }
  };

  // Run the automated 30-day check
  const runAutoCheck = async () => {
    setRunningCheck(true);
    try {
      const res = await fetch('/api/retainer/renewal-check-30day', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      showToast(`Auto-check complete: ${data.sent || 0} notification(s) sent`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Auto-check failed', 'error');
    } finally {
      setRunningCheck(false);
    }
  };

  // Toggle auto-rebill for a subscription
  const toggleAutoRebill = async (subId: string, enabled: boolean) => {
    setAutoRebillMap(prev => ({ ...prev, [subId]: enabled }));
    const supabase = createClient();
    await supabase.from('retainer_subscriptions').update({ auto_renew_enabled: enabled }).eq('id', subId);
    showToast(enabled ? 'Auto-rebill enabled' : 'Auto-rebill disabled');
  };

  const upcoming30 = subs.filter(s => {
    const days = getDaysUntil(s.current_period_end);
    return days >= 0 && days <= 30 && !s.cancel_at_period_end;
  });
  const expiringSoon = subs.filter(s => getDaysUntil(s.current_period_end) <= 7 && getDaysUntil(s.current_period_end) >= 0);
  const renewalAccepted = subs.filter(s => s.renewal_accepted_at);
  const renewalDeclined = subs.filter(s => s.renewal_declined_at);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-serif text-foreground">Retainer Renewal Notifications</h2>
          <p className="text-sm text-muted-foreground">Automated 30-day alerts via email &amp; SMS with client acceptance flow</p>
        </div>
        <button
          onClick={runAutoCheck}
          disabled={runningCheck}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {runningCheck ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          )}
          Run 30-Day Check
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Expiring in 30 Days</p>
          <p className="text-2xl font-bold text-amber-600">{upcoming30.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Need renewal action</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Expiring in 7 Days</p>
          <p className="text-2xl font-bold text-red-600">{expiringSoon.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Urgent attention</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Renewal Accepted</p>
          <p className="text-2xl font-bold text-emerald-600">{renewalAccepted.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Client confirmed</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Renewal Declined</p>
          <p className="text-2xl font-bold text-foreground">{renewalDeclined.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Needs follow-up</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-border">
        {([
          { id: 'upcoming', label: '🔔 Upcoming Renewals' },
          { id: 'logs', label: '📋 Notification Logs' },
          { id: 'settings', label: '⚙️ Auto-Rebill Settings' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveView(tab.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 ${activeView === tab.id ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upcoming Renewals */}
      {activeView === 'upcoming' && (
        <div className="space-y-4">
          {upcoming30.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">No renewals due in the next 30 days</p>
              <p className="text-xs text-muted-foreground mt-1">All retainer subscriptions are in good standing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming30.map(sub => {
                const days = getDaysUntil(sub.current_period_end);
                const isAccepted = !!sub.renewal_accepted_at;
                const isDeclined = !!sub.renewal_declined_at;
                return (
                  <div key={sub.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-foreground">{sub.customer_name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${urgencyBadge(days)}`}>
                            {days === 0 ? 'Expires Today' : days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d left`}
                          </span>
                          {isAccepted && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">✓ Accepted</span>
                          )}
                          {isDeclined && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">✗ Declined</span>
                          )}
                          {autoRebillMap[sub.id] && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">⚡ Auto-Rebill</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{sub.customer_email}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-medium text-foreground">{sub.plan_name}</span>
                          <span>{fmtCurrency(sub.amount, sub.currency)} / {sub.billing_interval}</span>
                          <span>Expires: {fmtDate(sub.current_period_end)}</span>
                          {sub.renewal_email_sent_at && (
                            <span className="text-emerald-600">Last notified: {fmtDate(sub.renewal_email_sent_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => sendRenewalNotification(sub, ['email'])}
                          disabled={sending === sub.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-60"
                        >
                          {sending === sub.id ? <span className="w-3 h-3 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" /> : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                            </svg>
                          )}
                          Email
                        </button>
                        <button
                          onClick={() => sendRenewalNotification(sub, ['sms'])}
                          disabled={sending === sub.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-60"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          SMS
                        </button>
                        <button
                          onClick={() => sendRenewalNotification(sub, ['email', 'sms'])}
                          disabled={sending === sub.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          Both
                        </button>
                      </div>
                    </div>

                    {/* Renewal acceptance link */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">Client renewal link:</span>
                      <code className="text-xs bg-secondary px-2 py-1 rounded-lg text-foreground font-mono">
                        {process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'}/retainer-renewal/{sub.id}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'}/retainer-renewal/${sub.id}`);
                          showToast('Link copied!');
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notification Logs */}
      {activeView === 'logs' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">No renewal notifications sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Channel</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Days Before</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Sent At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{log.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{log.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{log.notification_type?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${log.channel === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {log.channel?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{log.days_before_expiry}d</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(log.sent_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Auto-Rebill Settings */}
      {activeView === 'settings' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h4 className="font-semibold text-blue-800 mb-1">⚡ Auto-Rebill via Stripe</h4>
            <p className="text-sm text-blue-700">When auto-rebill is enabled, Stripe will automatically charge the client's saved payment method at the end of each billing period. The client will receive a 30-day advance notice email and SMS before each renewal.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-secondary/20">
              <h3 className="font-semibold text-foreground text-sm">Subscription Auto-Rebill Configuration</h3>
            </div>
            {subs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No active subscriptions found</div>
            ) : (
              <div className="divide-y divide-border">
                {subs.map(sub => (
                  <div key={sub.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium text-foreground">{sub.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.plan_name} · {fmtCurrency(sub.amount, sub.currency)}/{sub.billing_interval} · Renews {fmtDate(sub.current_period_end)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{autoRebillMap[sub.id] ? 'Auto-rebill ON' : 'Auto-rebill OFF'}</span>
                      <button
                        onClick={() => toggleAutoRebill(sub.id, !autoRebillMap[sub.id])}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoRebillMap[sub.id] ? 'bg-primary' : 'bg-secondary border border-border'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoRebillMap[sub.id] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">Notification Schedule</h3>
            <div className="space-y-2">
              {[
                { days: 30, label: '30 days before expiry', desc: 'Initial renewal notice with acceptance link' },
                { days: 14, label: '14 days before expiry', desc: 'Follow-up reminder if not yet accepted' },
                { days: 7, label: '7 days before expiry', desc: 'Urgent reminder — email + SMS' },
                { days: 3, label: '3 days before expiry', desc: 'Final warning — email + SMS' },
                { days: 1, label: '1 day before expiry', desc: 'Last chance notice' },
              ].map(item => (
                <div key={item.days} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{item.days}d</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Email</span>
                    {item.days <= 7 && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">SMS</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
