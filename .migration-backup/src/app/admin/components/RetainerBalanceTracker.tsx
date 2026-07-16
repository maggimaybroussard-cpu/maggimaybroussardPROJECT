'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  inquiry_id: string | null;
  created_at: string;
}

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
}

interface RetainerBalance {
  subscription: RetainerSubscription;
  purchasedHours: number;
  usedHours: number;
  remainingHours: number;
  usedPercent: number;
  remainingFunds: number;
  totalFunds: number;
  hourlyRate: number;
  depletionLevel: 'critical' | 'warning' | 'ok';
  recentLogs: TimeLog[];
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const RETAINER_TIERS: Record<string, number> = {
  essential: 10,
  standard: 20,
  'full-service': 40,
  full_service: 40,
  'monthly retainer': 10,
};

function getTierHours(planName: string, amount: number): number {
  const key = planName?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (RETAINER_TIERS[key]) return RETAINER_TIERS[key];
  const amt = Math.round(Number(amount));
  if (amt === 750) return 10;
  if (amt === 1500) return 20;
  if (amt === 2800) return 40;
  if (amt >= 2000) return 20;
  if (amt >= 1000) return 10;
  if (amt >= 500) return 5;
  return 10;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RetainerBalanceTracker() {
  const [balances, setBalances] = useState<RetainerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [subsRes, logsRes] = await Promise.all([
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, currency, status, current_period_start, current_period_end, cancel_at_period_end, inquiry_id, created_at')
          .in('status', ['active', 'past_due', 'trialing'])
          .order('created_at', { ascending: false }),
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, hours, description, work_date')
          .order('work_date', { ascending: false }),
      ]);

      if (subsRes.error) throw new Error(subsRes.error.message);
      if (logsRes.error) throw new Error(logsRes.error.message);

      const subs: RetainerSubscription[] = subsRes.data || [];
      const logs: TimeLog[] = logsRes.data || [];

      // Group logs by subscription
      const logsBySubId: Record<string, TimeLog[]> = {};
      logs.forEach((l) => {
        if (!logsBySubId[l.retainer_subscription_id]) logsBySubId[l.retainer_subscription_id] = [];
        logsBySubId[l.retainer_subscription_id].push(l);
      });

      const computed: RetainerBalance[] = subs.map((sub) => {
        const subLogs = logsBySubId[sub.id] ?? [];
        const purchasedHours = getTierHours(sub.plan_name, sub.amount);
        const usedHours = subLogs.reduce((sum, l) => sum + Number(l.hours), 0);
        const remainingHours = Math.max(0, purchasedHours - usedHours);
        const usedPercent = purchasedHours > 0 ? Math.min(100, (usedHours / purchasedHours) * 100) : 0;
        const hourlyRate = purchasedHours > 0 ? Number(sub.amount) / purchasedHours : 0;
        const remainingFunds = remainingHours * hourlyRate;
        const totalFunds = Number(sub.amount);

        const depletionLevel: 'critical' | 'warning' | 'ok' =
          purchasedHours > 0 && remainingHours <= purchasedHours * 0.1
            ? 'critical'
            : purchasedHours > 0 && remainingHours <= purchasedHours * 0.25
            ? 'warning' :'ok';

        return {
          subscription: sub,
          purchasedHours,
          usedHours,
          remainingHours,
          usedPercent,
          remainingFunds,
          totalFunds,
          hourlyRate,
          depletionLevel,
          recentLogs: subLogs.slice(0, 5),
        };
      });

      // Sort: critical first, then warning, then ok; within each group by remaining % ascending
      computed.sort((a, b) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        if (order[a.depletionLevel] !== order[b.depletionLevel]) return order[a.depletionLevel] - order[b.depletionLevel];
        return a.usedPercent - b.usedPercent;
      });

      setBalances(computed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load retainer balances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const criticalCount = balances.filter((b) => b.depletionLevel === 'critical').length;
  const warningCount = balances.filter((b) => b.depletionLevel === 'warning').length;
  const totalRemainingFunds = balances.reduce((sum, b) => sum + b.remainingFunds, 0);
  const totalRemainingHours = balances.reduce((sum, b) => sum + b.remainingHours, 0);

  const filtered = balances.filter((b) => {
    const matchSearch =
      !search ||
      b.subscription.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      b.subscription.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      b.subscription.plan_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || b.depletionLevel === filter;
    return matchSearch && matchFilter;
  });

  // ── Loading ───────────────────────────────────────────────────────────────

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
      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Active Retainers</p>
          <p className="text-2xl font-semibold text-foreground">{balances.length}</p>
          <p className="text-xs text-muted-foreground mt-1">clients tracked</p>
        </div>

        <div className={`rounded-2xl p-5 relative overflow-hidden border ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Critical</p>
          <p className={`text-2xl font-semibold ${criticalCount > 0 ? 'text-red-700' : 'text-foreground'}`}>{criticalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">&lt;10% hours left</p>
        </div>

        <div className={`rounded-2xl p-5 relative overflow-hidden border ${warningCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Low Balance</p>
          <p className={`text-2xl font-semibold ${warningCount > 0 ? 'text-amber-700' : 'text-foreground'}`}>{warningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">&lt;25% hours left</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#C8965A', transform: 'translate(30%,-30%)' }} />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Remaining Funds</p>
          <p className="text-2xl font-semibold text-foreground">{fmt(totalRemainingFunds)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalRemainingHours.toFixed(1)} hrs total</p>
        </div>
      </div>

      {/* ── Alert banners ── */}
      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-700">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {criticalCount} client{criticalCount !== 1 ? 's' : ''} critically low on retainer hours
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {balances.filter((b) => b.depletionLevel === 'critical').map((b) => `${b.subscription.customer_name} (${b.remainingHours.toFixed(1)} hrs left)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {warningCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {warningCount} client{warningCount !== 1 ? 's' : ''} running low on retainer hours
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {balances.filter((b) => b.depletionLevel === 'warning').map((b) => `${b.subscription.customer_name} (${b.remainingHours.toFixed(1)} hrs left)`).join(' · ')}
            </p>
          </div>
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
            placeholder="Search by client name, email, or plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Clients ({balances.length})</option>
          <option value="critical">Critical ({criticalCount})</option>
          <option value="warning">Low Balance ({warningCount})</option>
          <option value="ok">Healthy ({balances.filter((b) => b.depletionLevel === 'ok').length})</option>
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

      {/* ── Balance Cards ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Retainer Balances by Client</h2>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {filtered.length} client{filtered.length !== 1 ? 's' : ''}{filter !== 'all' || search ? ' (filtered)' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-light">Total Remaining</p>
            <p className="text-base font-semibold" style={{ color: '#355E3B' }}>{fmt(totalRemainingFunds)}</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground font-light">
              {balances.length === 0
                ? 'No active retainer subscriptions found.' :'No clients match your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((b) => {
              const isExpanded = expandedId === b.subscription.id;
              const depColor =
                b.depletionLevel === 'critical' ? '#DC2626' :
                b.depletionLevel === 'warning' ? '#D97706' : '#355E3B';
              const depBg =
                b.depletionLevel === 'critical' ? 'rgba(220,38,38,0.08)' :
                b.depletionLevel === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(53,94,59,0.06)';
              const depBorder =
                b.depletionLevel === 'critical' ? 'rgba(220,38,38,0.25)' :
                b.depletionLevel === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(53,94,59,0.2)';

              return (
                <div key={b.subscription.id}>
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : b.subscription.id)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Status dot */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: depBg, border: `1px solid ${depBorder}` }}
                      >
                        {b.depletionLevel === 'critical' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={depColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        ) : b.depletionLevel === 'warning' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={depColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={depColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{b.subscription.customer_name}</p>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold"
                            style={{ background: depBg, borderColor: depBorder, color: depColor }}
                          >
                            {b.depletionLevel === 'critical' ? 'Critical' : b.depletionLevel === 'warning' ? 'Low Balance' : 'Healthy'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-light truncate">{b.subscription.customer_email}</p>
                        <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">{b.subscription.plan_name}</p>

                        {/* Inline progress bar */}
                        <div className="mt-2 max-w-xs">
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${b.usedPercent}%`, background: depColor }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      {/* Hours remaining */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground font-light">Remaining Hours</p>
                        <p className="text-sm font-semibold" style={{ color: depColor }}>
                          {b.remainingHours.toFixed(1)} / {b.purchasedHours} hrs
                        </p>
                        <p className="text-xs text-muted-foreground font-light">{(100 - b.usedPercent).toFixed(0)}% left</p>
                      </div>

                      {/* Remaining funds */}
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground font-light">Remaining Funds</p>
                        <p className="text-sm font-semibold text-foreground">{fmt(b.remainingFunds)}</p>
                        <p className="text-xs text-muted-foreground font-light">of {fmt(b.totalFunds)}</p>
                      </div>

                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/60 px-6 py-5 bg-secondary/10 space-y-5">
                      {/* Stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Purchased Hours', value: `${b.purchasedHours} hrs` },
                          { label: 'Hours Used', value: `${b.usedHours.toFixed(1)} hrs` },
                          { label: 'Hours Remaining', value: `${b.remainingHours.toFixed(1)} hrs`, highlight: true, color: depColor },
                          { label: 'Used %', value: `${b.usedPercent.toFixed(0)}%` },
                          { label: 'Total Retainer', value: fmt(b.totalFunds, b.subscription.currency) },
                          { label: 'Funds Used', value: fmt(b.totalFunds - b.remainingFunds, b.subscription.currency) },
                          { label: 'Funds Remaining', value: fmt(b.remainingFunds, b.subscription.currency), highlight: true, color: depColor },
                          { label: 'Effective Rate', value: b.hourlyRate > 0 ? `${fmt(b.hourlyRate, b.subscription.currency)}/hr` : '—' },
                        ].map((item) => (
                          <div key={item.label} className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs text-muted-foreground font-light mb-1">{item.label}</p>
                            <p
                              className="text-sm font-semibold truncate"
                              style={{ color: item.highlight ? item.color : 'var(--foreground)' }}
                            >
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Visual gauge */}
                      <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Hours Balance</p>
                          <p className="text-xs text-muted-foreground font-light">
                            {b.usedHours.toFixed(1)} used · {b.remainingHours.toFixed(1)} remaining
                          </p>
                        </div>
                        <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${b.usedPercent}%`, background: depColor }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-xs text-muted-foreground font-light">0 hrs</span>
                          <span className="text-xs text-muted-foreground font-light">{b.purchasedHours} hrs</span>
                        </div>
                      </div>

                      {/* Subscription info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Plan', value: b.subscription.plan_name },
                          { label: 'Status', value: b.subscription.status.charAt(0).toUpperCase() + b.subscription.status.slice(1) },
                          { label: 'Period End', value: fmtDate(b.subscription.current_period_end) },
                        ].map((item) => (
                          <div key={item.label} className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs text-muted-foreground font-light mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground truncate">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Recent time logs */}
                      {b.recentLogs.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Recent Time Logs</p>
                          <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/20">
                                  <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                                  <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Description</th>
                                  <th className="text-right px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Hours</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {b.recentLogs.map((log) => {
                                  const cleanDesc = log.description
                                    ? log.description.replace(/^\[[^\]]+\]\s*/, '').trim()
                                    : '—';
                                  return (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-light whitespace-nowrap">
                                        {fmtDate(log.work_date)}
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-xs truncate">{cleanDesc}</td>
                                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                                        {Number(log.hours).toFixed(2)} hrs
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
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
