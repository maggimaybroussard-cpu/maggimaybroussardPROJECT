'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  status: string;
  inquiry_id: string | null;
  billing_cycle_start: string | null;
  next_billing_date: string | null;
  stripe_subscription_id: string | null;
}

interface AutomatedInvoice {
  id: string;
  subscription_id: string;
  client_name: string;
  client_email: string;
  amount: number;
  status: 'scheduled' | 'generated' | 'sent' | 'paid' | 'failed';
  scheduled_date: string;
  generated_at: string | null;
  sent_at: string | null;
  invoice_number: string;
  plan_name: string;
}

interface AutomationRule {
  id: string;
  subscription_id: string;
  client_name: string;
  frequency: 'monthly' | 'quarterly' | 'annual';
  auto_send: boolean;
  send_days_before: number;
  include_time_log: boolean;
  next_run: string;
  is_active: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  generated: 'bg-amber-100 text-amber-700 border-amber-200',
  sent: 'bg-purple-100 text-purple-700 border-purple-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RetainerInvoiceAutomationDashboard() {
  const [subscriptions, setSubscriptions] = useState<RetainerSubscription[]>([]);
  const [invoices, setInvoices] = useState<AutomatedInvoice[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'rules'>('overview');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    subscription_id: '',
    frequency: 'monthly\' as \'monthly\' | \'quarterly\' | \'annual',
    auto_send: true,
    send_days_before: 3,
    include_time_log: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [subRes, schedRes] = await Promise.all([
        supabase
          .from('retainer_subscriptions')
          .select('*')
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('retainer_invoice_schedules')
          .select('*')
          .order('next_run_at', { ascending: true })
          .limit(100),
      ]);

      if (subRes.data) {
        setSubscriptions(subRes.data.map((s: Record<string, unknown>) => ({
          id: String(s.id ?? ''),
          customer_name: String(s.customer_name ?? ''),
          customer_email: String(s.customer_email ?? ''),
          plan_name: String(s.plan_name ?? ''),
          amount: Number(s.amount ?? 0),
          status: String(s.status ?? 'active'),
          inquiry_id: s.inquiry_id ? String(s.inquiry_id) : null,
          billing_cycle_start: s.billing_cycle_start ? String(s.billing_cycle_start) : null,
          next_billing_date: s.next_billing_date ? String(s.next_billing_date) : null,
          stripe_subscription_id: s.stripe_subscription_id ? String(s.stripe_subscription_id) : null,
        })));
      }

      if (schedRes.data) {
        const mapped: AutomationRule[] = schedRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id ?? ''),
          subscription_id: String(r.retainer_subscription_id ?? ''),
          client_name: String(r.client_name ?? ''),
          frequency: (r.frequency as 'monthly' | 'quarterly' | 'annual') ?? 'monthly',
          auto_send: Boolean(r.is_active),
          send_days_before: Number(r.custom_interval_days ?? 3),
          include_time_log: Boolean(r.billing_type === 'hourly'),
          next_run: String(r.next_run_at ?? new Date().toISOString()),
          is_active: Boolean(r.is_active),
        }));
        setRules(mapped);

        // Build mock invoices from schedules
        const mockInvoices: AutomatedInvoice[] = schedRes.data.slice(0, 20).map((r: Record<string, unknown>, idx: number) => ({
          id: `inv-${r.id}`,
          subscription_id: String(r.retainer_subscription_id ?? ''),
          client_name: String(r.client_name ?? ''),
          client_email: String(r.client_email ?? ''),
          amount: Number(r.fixed_amount ?? r.hourly_rate ?? 0),
          status: r.last_run_at ? 'sent' : 'scheduled',
          scheduled_date: String(r.next_run_at ?? new Date().toISOString()),
          generated_at: r.last_run_at ? String(r.last_run_at) : null,
          sent_at: r.last_run_at ? String(r.last_run_at) : null,
          invoice_number: `RET-${String(new Date().getFullYear())}-${String(idx + 1).padStart(4, '0')}`,
          plan_name: String(r.billing_type === 'hourly' ? 'Hourly' : 'Fixed'),
        }));
        setInvoices(mockInvoices);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunNow = async (subId: string) => {
    setRunningId(subId);
    try {
      await fetch('/api/retainer-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subId, action: 'generate' }),
      });
      toast.success('Invoice generation triggered');
      fetchData();
    } catch {
      toast.error('Failed to trigger invoice generation');
    } finally {
      setRunningId(null);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.subscription_id) {
      toast.error('Please select a subscription');
      return;
    }
    try {
      const supabase = createClient();
      const sub = subscriptions.find((s) => s.id === newRule.subscription_id);
      const nextRun = new Date();
      if (newRule.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
      else if (newRule.frequency === 'quarterly') nextRun.setMonth(nextRun.getMonth() + 3);
      else nextRun.setFullYear(nextRun.getFullYear() + 1);

      await supabase.from('retainer_invoice_schedules').insert({
        retainer_subscription_id: newRule.subscription_id,
        inquiry_id: sub?.inquiry_id ?? null,
        client_name: sub?.customer_name ?? '',
        client_email: sub?.customer_email ?? '',
        frequency: newRule.frequency,
        billing_type: newRule.include_time_log ? 'hourly' : 'fixed',
        fixed_amount: newRule.include_time_log ? null : sub?.amount ?? 0,
        hourly_rate: newRule.include_time_log ? 75 : null,
        is_active: true,
        next_run_at: nextRun.toISOString(),
      });

      toast.success('Automation rule created');
      setShowAddRule(false);
      fetchData();
    } catch {
      toast.error('Failed to create automation rule');
    }
  };

  const toggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from('retainer_invoice_schedules').update({ is_active: !currentActive }).eq('id', ruleId);
      setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, is_active: !currentActive, auto_send: !currentActive } : r));
      toast.success(currentActive ? 'Rule paused' : 'Rule activated');
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const totalMonthlyRevenue = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const upcomingCount = rules.filter((r) => r.is_active && daysUntil(r.next_run) !== null && (daysUntil(r.next_run) ?? 999) <= 7).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Retainers', value: subscriptions.length, sub: 'billing monthly', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          ), color: 'text-foreground' },
          { label: 'Monthly Revenue', value: fmt(totalMonthlyRevenue), sub: 'from retainers', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          ), color: 'text-emerald-600' },
          { label: 'Active Rules', value: rules.filter((r) => r.is_active).length, sub: 'automation rules', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          ), color: 'text-blue-600' },
          { label: 'Due This Week', value: upcomingCount, sub: 'invoices upcoming', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          ), color: upcomingCount > 0 ? 'text-amber-600' : 'text-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            <p className="text-xs text-muted-foreground/60">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
        {(['overview', 'invoices', 'rules'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              activeTab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'overview' ? 'Subscriptions' : t === 'invoices' ? 'Invoice Queue' : 'Automation Rules'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-foreground">Active Retainer Subscriptions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">All active retainers with billing status and next invoice date</p>
            </div>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No active retainer subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Plan</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Next Billing</th>
                    <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub, i) => {
                    const days = daysUntil(sub.next_billing_date);
                    return (
                      <tr key={sub.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{sub.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{sub.customer_email}</p>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-foreground/80">{sub.plan_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground">{fmt(sub.amount)}</span>
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {sub.next_billing_date ? (
                            <span className={`text-sm ${days !== null && days <= 3 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                              {fmtDate(sub.next_billing_date)}
                              {days !== null && days <= 7 && (
                                <span className="ml-1.5 text-xs">({days}d)</span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRunNow(sub.id)}
                            disabled={runningId === sub.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50 ml-auto"
                          >
                            {runningId === sub.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                            )}
                            Generate Now
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-serif text-lg text-foreground">Automated Invoice Queue</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Scheduled and generated invoices from retainer automation</p>
          </div>
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No automated invoices yet. Set up automation rules to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Client</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-6 py-4">
                        <p className="font-mono text-sm font-medium text-foreground">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{inv.plan_name}</p>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <p className="text-foreground/80">{inv.client_name}</p>
                        <p className="text-xs text-muted-foreground">{inv.client_email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-foreground">{fmt(inv.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[inv.status]}`}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-muted-foreground text-xs">
                        {fmtDate(inv.scheduled_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-foreground">Automation Rules</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Configure when and how retainer invoices are auto-generated</p>
            </div>
            <button
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Rule
            </button>
          </div>

          {showAddRule && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h4 className="font-semibold text-foreground">New Automation Rule</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Subscription *</label>
                  <select
                    value={newRule.subscription_id}
                    onChange={(e) => setNewRule({ ...newRule, subscription_id: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  >
                    <option value="">Select subscription…</option>
                    {subscriptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.customer_name} — {s.plan_name} ({fmt(s.amount)}/mo)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Billing Frequency</label>
                  <select
                    value={newRule.frequency}
                    onChange={(e) => setNewRule({ ...newRule, frequency: e.target.value as 'monthly' | 'quarterly' | 'annual' })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRule.auto_send}
                      onChange={(e) => setNewRule({ ...newRule, auto_send: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-foreground">Auto-send to client</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRule.include_time_log}
                      onChange={(e) => setNewRule({ ...newRule, include_time_log: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-foreground">Include time log summary</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddRule}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Create Rule
                </button>
                <button
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {rules.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">No automation rules yet</p>
                <button onClick={() => setShowAddRule(true)} className="mt-2 text-xs text-accent underline underline-offset-2">
                  Create your first rule
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rules.map((rule) => {
                  const days = daysUntil(rule.next_run);
                  return (
                    <div key={rule.id} className="flex items-center justify-between px-6 py-4 gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{rule.client_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{rule.frequency} billing · {rule.include_time_log ? 'Hourly' : 'Fixed'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Next run</p>
                          <p className={`text-sm font-medium ${days !== null && days <= 3 ? 'text-amber-600' : 'text-foreground'}`}>
                            {fmtDate(rule.next_run)}
                            {days !== null && days <= 7 && <span className="ml-1 text-xs">({days}d)</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleRule(rule.id, rule.is_active)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
