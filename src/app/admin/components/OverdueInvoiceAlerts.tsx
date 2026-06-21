'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverdueAlert {
  id: string;
  invoice_id: string;
  inquiry_id: string | null;
  client_name: string | null;
  client_email: string | null;
  invoice_number: string | null;
  amount_due: number;
  due_date: string;
  days_overdue: number;
  reminder_sent_at: string | null;
  reminder_status: string;
  sms_sent: boolean | null;
  tier_label: string | null;
  dismissed: boolean;
  created_at: string;
}

interface TierCounts {
  early: number;
  overdue: number;
  critical: number;
}

interface OverdueAlertsState {
  alerts: OverdueAlert[];
  totalOverdue: number;
  activeAlerts: number;
  tierCounts: TierCounts;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTierStyle(tier: string | null, daysOverdue: number) {
  const resolved = tier ?? (daysOverdue >= 45 ? 'critical' : daysOverdue >= 30 ? 'overdue' : 'early');
  switch (resolved) {
    case 'critical':
      return {
        dot: 'bg-red-600',
        badge: 'bg-red-100 text-red-700',
        label: 'Critical',
        labelColor: 'text-red-600',
      };
    case 'overdue':
      return {
        dot: 'bg-orange-500',
        badge: 'bg-orange-100 text-orange-700',
        label: 'Overdue',
        labelColor: 'text-orange-600',
      };
    default:
      return {
        dot: 'bg-amber-400',
        badge: 'bg-amber-100 text-amber-700',
        label: '15-Day',
        labelColor: 'text-amber-600',
      };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OverdueInvoiceAlertsProps {
  onNavigate?: (tab: string) => void;
}

export default function OverdueInvoiceAlerts({ onNavigate }: OverdueInvoiceAlertsProps) {
  const supabase = createClient();
  const [state, setState] = useState<OverdueAlertsState>({
    alerts: [],
    totalOverdue: 0,
    activeAlerts: 0,
    tierCounts: { early: 0, overdue: 0, critical: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [runResult, setRunResult] = useState<{ flagged: number; emailsSent: number; smsSent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendSmsEnabled, setSendSmsEnabled] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overdue-invoice-alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      setState({
        alerts: data.alerts ?? [],
        totalOverdue: data.totalOverdue ?? 0,
        activeAlerts: data.activeAlerts ?? 0,
        tierCounts: data.tierCounts ?? { early: 0, overdue: 0, critical: 0 },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRunFlag = async (sendEmails: boolean) => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/overdue-invoice-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          action: 'run_flag',
          send_emails: sendEmails,
          send_sms: sendEmails ? sendSmsEnabled : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Run failed');
      setRunResult({
        flagged: data.flagged ?? 0,
        emailsSent: data.emailsSent ?? 0,
        smsSent: data.smsSent ?? 0,
      });
      setLastRun(new Date());
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setDismissingId(alertId);
    try {
      const res = await fetch('/api/admin/overdue-invoice-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alertId }),
      });
      if (!res.ok) throw new Error('Dismiss failed');
      setState((prev) => ({
        ...prev,
        alerts: prev.alerts.filter((a) => a.id !== alertId),
        activeAlerts: Math.max(0, prev.activeAlerts - 1),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setDismissingId(null);
    }
  };

  const handleDismissAll = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/overdue-invoice-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_all' }),
      });
      if (!res.ok) throw new Error('Dismiss all failed');
      setState((prev) => ({ ...prev, alerts: [], activeAlerts: 0, tierCounts: { early: 0, overdue: 0, critical: 0 } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss all failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <div className="h-4 w-48 bg-secondary animate-pulse rounded" />
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeAlerts = state.alerts.filter((a) => !a.dismissed);

  return (
    <div className="bg-card border border-red-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Overdue Invoice Alerts</h2>
            <p className="text-xs text-muted-foreground">15-day · 30-day · 45-day thresholds</p>
          </div>
          {activeAlerts.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold">
              {activeAlerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <button
              onClick={handleDismissAll}
              disabled={running}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary/40 transition-all disabled:opacity-50"
            >
              Dismiss All
            </button>
          )}
          <button
            onClick={() => handleRunFlag(false)}
            disabled={running}
            className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-all disabled:opacity-50"
          >
            {running ? 'Scanning…' : 'Scan Now'}
          </button>
          {/* SMS toggle */}
          <button
            onClick={() => setSendSmsEnabled((v) => !v)}
            title={sendSmsEnabled ? 'SMS reminders ON — click to disable' : 'SMS reminders OFF — click to enable'}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
              sendSmsEnabled
                ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
            }`}
          >
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              SMS {sendSmsEnabled ? 'On' : 'Off'}
            </span>
          </button>
          <button
            onClick={() => handleRunFlag(true)}
            disabled={running}
            className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {running ? 'Sending…' : 'Send Reminders'}
          </button>
        </div>
      </div>

      {/* Tier breakdown pills */}
      {(state.tierCounts.early > 0 || state.tierCounts.overdue > 0 || state.tierCounts.critical > 0) && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-red-100 bg-white">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">Tiers:</span>
          {state.tierCounts.early > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              15-day: {state.tierCounts.early}
            </span>
          )}
          {state.tierCounts.overdue > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
              30-day: {state.tierCounts.overdue}
            </span>
          )}
          {state.tierCounts.critical > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
              45-day: {state.tierCounts.critical}
            </span>
          )}
        </div>
      )}

      {/* Run result banner */}
      {runResult && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border-b border-emerald-100">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <p className="text-xs text-emerald-700 font-medium">
            Scan complete — {runResult.flagged} invoice{runResult.flagged !== 1 ? 's' : ''} flagged
            {runResult.emailsSent > 0 ? `, ${runResult.emailsSent} email${runResult.emailsSent !== 1 ? 's' : ''} sent` : ''}
            {runResult.smsSent > 0 ? `, ${runResult.smsSent} SMS sent` : ''}
            {lastRun ? ` · ${lastRun.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
          <button onClick={() => setRunResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Alert list */}
      {activeAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No active alerts</p>
          <p className="text-xs text-muted-foreground">
            {state.totalOverdue > 0
              ? `${state.totalOverdue} overdue invoice${state.totalOverdue !== 1 ? 's' : ''} detected. Click "Scan Now" to flag them.`
              : 'All invoices are within payment terms. Run a scan to check for new overdue invoices.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {activeAlerts.map((alert) => {
            const tierStyle = getTierStyle(alert.tier_label, alert.days_overdue);
            return (
              <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-red-50/30 transition-colors group">
                {/* Severity indicator */}
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${tierStyle.dot}`} />

                {/* Invoice info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {alert.client_name ?? 'Unknown Client'}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {alert.invoice_number ?? 'Invoice'}
                    </span>
                    {/* Tier badge */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tierStyle.badge}`}>
                      {tierStyle.label}
                    </span>
                    {/* Days overdue */}
                    <span className={`text-[10px] font-semibold ${tierStyle.labelColor}`}>
                      {alert.days_overdue}d overdue
                    </span>
                    {alert.reminder_sent_at && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        Email sent
                      </span>
                    )}
                    {alert.sms_sent && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 flex items-center gap-0.5">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        SMS sent
                      </span>
                    )}
                    {alert.reminder_status === 'failed' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                        Send failed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      Due {formatDate(alert.due_date)}
                    </span>
                    <span className={`text-xs font-semibold ${tierStyle.labelColor}`}>
                      {formatCurrency(Number(alert.amount_due))} outstanding
                    </span>
                    {alert.client_email && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {alert.client_email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('invoice_tracking')}
                      className="text-[11px] font-medium text-primary hover:underline px-2 py-1 rounded-lg hover:bg-secondary/40 transition-colors"
                    >
                      View
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={dismissingId === alert.id}
                    className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary/40 transition-colors disabled:opacity-50"
                  >
                    {dismissingId === alert.id ? '…' : 'Dismiss'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      {activeAlerts.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-red-100 bg-red-50/30">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-red-700">{activeAlerts.length}</span> alert{activeAlerts.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(activeAlerts.reduce((s, a) => s + Number(a.amount_due), 0))}
            </span>{' '}
            total outstanding
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('invoice_tracking')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Manage invoices →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
