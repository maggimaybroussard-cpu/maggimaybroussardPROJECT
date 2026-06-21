'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RetainerAlert {
  id: string;
  subscriptionId: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  remainingHours: number;
  totalHours: number;
  remainingPercent: number;
  threshold: number;
  alertLevel: 'critical' | 'warning';
  lastAlertSent: string | null;
}

interface AlertConfig {
  warningThreshold: number;
  criticalThreshold: number;
  autoEmail: boolean;
}

export default function RetainerAlertsDashboard() {
  const [alerts, setAlerts] = useState<RetainerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AlertConfig>({ warningThreshold: 30, criticalThreshold: 15, autoEmail: false });
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [subsRes, logsRes] = await Promise.all([
        supabase.from('retainer_subscriptions').select('id, customer_name, customer_email, plan_name, amount, status').eq('status', 'active'),
        supabase.from('retainer_time_logs').select('retainer_subscription_id, hours'),
      ]);

      const subs = subsRes.data || [];
      const logs = logsRes.data || [];

      const RETAINER_TIERS: Record<string, number> = { essential: 10, standard: 20, 'full-service': 40, full_service: 40, 'monthly retainer': 10 };
      function getTierHours(planName: string, amount: number): number {
        const key = planName?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        if (RETAINER_TIERS[key]) return RETAINER_TIERS[key];
        const amt = Math.round(Number(amount));
        if (amt >= 2800) return 40;
        if (amt >= 1500) return 20;
        if (amt >= 750) return 10;
        return 10;
      }

      const alertList: RetainerAlert[] = [];
      for (const sub of subs) {
        const totalHours = getTierHours(sub.plan_name, sub.amount);
        const usedHours = logs.filter(l => l.retainer_subscription_id === sub.id).reduce((s, l) => s + (Number(l.hours) || 0), 0);
        const remainingHours = Math.max(0, totalHours - usedHours);
        const remainingPercent = totalHours > 0 ? (remainingHours / totalHours) * 100 : 100;

        if (remainingPercent <= config.criticalThreshold) {
          alertList.push({ id: sub.id, subscriptionId: sub.id, clientName: sub.customer_name, clientEmail: sub.customer_email, planName: sub.plan_name, remainingHours, totalHours, remainingPercent, threshold: config.criticalThreshold, alertLevel: 'critical', lastAlertSent: null });
        } else if (remainingPercent <= config.warningThreshold) {
          alertList.push({ id: sub.id, subscriptionId: sub.id, clientName: sub.customer_name, clientEmail: sub.customer_email, planName: sub.plan_name, remainingHours, totalHours, remainingPercent, threshold: config.warningThreshold, alertLevel: 'warning', lastAlertSent: null });
        }
      }

      setAlerts(alertList.sort((a, b) => a.remainingPercent - b.remainingPercent));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendAlert = async (alert: RetainerAlert) => {
    setSending(alert.id);
    try {
      const supabase = createClient();
      await supabase.from('notifications').insert({
        audience: 'admin',
        user_id: null,
        inquiry_id: null,
        notification_type: 'retainer_alert',
        title: `Retainer Low Balance: ${alert.clientName}`,
        body: `${alert.clientName}'s retainer is at ${Math.round(alert.remainingPercent)}% (${alert.remainingHours.toFixed(1)}h remaining of ${alert.totalHours}h). Consider sending a renewal notice.`,
        link: '/admin',
        is_read: false,
        is_dismissed: false,
        is_archived: false,
        metadata: { subscriptionId: alert.subscriptionId, alertLevel: alert.alertLevel, remainingPercent: alert.remainingPercent },
      });
      setSentIds(prev => new Set([...prev, alert.id]));
    } catch (err: unknown) {
      alert && console.error(err);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Retainer Balance Alerts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Auto-notify clients and admin when retainer drops below threshold</p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          Refresh
        </button>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Alert Thresholds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Warning Threshold (%)</label>
            <input type="number" min={1} max={100} value={config.warningThreshold} onChange={e => setConfig(p => ({ ...p, warningThreshold: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <p className="text-xs text-muted-foreground mt-1">Alert when below {config.warningThreshold}% remaining</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Critical Threshold (%)</label>
            <input type="number" min={1} max={100} value={config.criticalThreshold} onChange={e => setConfig(p => ({ ...p, criticalThreshold: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <p className="text-xs text-muted-foreground mt-1">Critical alert when below {config.criticalThreshold}%</p>
          </div>
          <div className="flex items-end">
            <button onClick={fetchData} className="w-full py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>
              Apply Thresholds
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <p className="text-emerald-700 font-semibold">✓ All retainer balances are healthy</p>
          <p className="text-emerald-600 text-sm mt-1">No clients are below the {config.warningThreshold}% warning threshold.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className={`bg-card border rounded-2xl p-5 ${alert.alertLevel === 'critical' ? 'border-red-200' : 'border-amber-200'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${alert.alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <h3 className="font-semibold text-foreground">{alert.clientName}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alert.alertLevel === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {alert.alertLevel === 'critical' ? '🔴 Critical' : '🟡 Warning'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.clientEmail} · {alert.planName}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{alert.remainingHours.toFixed(1)}h remaining of {alert.totalHours}h</span>
                      <span className={`text-xs font-semibold ${alert.alertLevel === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{Math.round(alert.remainingPercent)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${alert.alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(alert.remainingPercent, 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={`mailto:${alert.clientEmail}?subject=Retainer Balance Update — Broussard Legal Services&body=Dear ${alert.clientName},%0A%0AYour retainer balance is running low. You have ${alert.remainingHours.toFixed(1)} hours remaining (${Math.round(alert.remainingPercent)}% of your ${alert.planName} plan).%0A%0APlease contact us to discuss renewal options.%0A%0ABroussard Legal Services`} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                    Email Client
                  </a>
                  <button onClick={() => handleSendAlert(alert)} disabled={sending === alert.id || sentIds.has(alert.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${sentIds.has(alert.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                    {sending === alert.id ? 'Sending…' : sentIds.has(alert.id) ? '✓ Notified' : 'Notify Admin'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
