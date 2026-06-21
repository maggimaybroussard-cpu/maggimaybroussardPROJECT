'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  contact_inquiries?: { name: string } | null;
}

interface AgingBucket {
  label: string;
  range: string;
  count: number;
  total: number;
  collected: number;
  outstanding: number;
  color: string;
  bgColor: string;
}

interface MonthlyProjection {
  month: string;
  projected: number;
  collected: number;
  outstanding: number;
  writeOff: number;
}

interface VelocityPoint {
  week: string;
  avgDaysToPay: number;
  invoicesIssued: number;
  invoicesPaid: number;
  collectionRate: number;
}

interface AlertSettings {
  id?: string;
  threshold_amount: number;
  alert_enabled: boolean;
  look_ahead_months: number;
  notify_email: string;
}

interface CashFlowAlert {
  month: string;
  projected: number;
  threshold: number;
  deficit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const ACCENT = '#355E3B';
const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#f59e0b', '#ef4444'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CashPositionProjectionDashboard() {
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'projection' | 'aging' | 'velocity' | 'alerts'>('projection');

  // Alert settings state
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    threshold_amount: 5000,
    alert_enabled: true,
    look_ahead_months: 3,
    notify_email: '',
  });
  const [alertSettingsLoading, setAlertSettingsLoading] = useState(false);
  const [alertSettingsSaved, setAlertSettingsSaved] = useState(false);
  const [alertSettingsError, setAlertSettingsError] = useState('');
  const [editingThreshold, setEditingThreshold] = useState('5000');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_invoices')
      .select('id, invoice_number, invoice_date, due_date, amount, amount_paid, payment_status, status, contact_inquiries(name)')
      .order('invoice_date', { ascending: false });
    setInvoices((data as Invoice[]) ?? []);
    setLoading(false);
  }, [supabase]);

  const fetchAlertSettings = useCallback(async () => {
    const { data } = await supabase
      .from('cash_flow_alert_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setAlertSettings({
        id: data.id,
        threshold_amount: data.threshold_amount,
        alert_enabled: data.alert_enabled,
        look_ahead_months: data.look_ahead_months,
        notify_email: data.notify_email ?? '',
      });
      setEditingThreshold(String(data.threshold_amount));
    }
  }, [supabase]);

  useEffect(() => { fetchData(); fetchAlertSettings(); }, [fetchData, fetchAlertSettings]);

  const saveAlertSettings = async () => {
    setAlertSettingsLoading(true);
    setAlertSettingsError('');
    const parsed = parseFloat(editingThreshold.replace(/[^0-9.]/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      setAlertSettingsError('Please enter a valid threshold amount.');
      setAlertSettingsLoading(false);
      return;
    }
    const payload = {
      threshold_amount: parsed,
      alert_enabled: alertSettings.alert_enabled,
      look_ahead_months: alertSettings.look_ahead_months,
      notify_email: alertSettings.notify_email || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (alertSettings.id) {
      ({ error } = await supabase.from('cash_flow_alert_settings').update(payload).eq('id', alertSettings.id));
    } else {
      const { data, error: insertError } = await supabase.from('cash_flow_alert_settings').insert(payload).select().single();
      error = insertError;
      if (data) setAlertSettings(prev => ({ ...prev, id: data.id }));
    }
    if (error) {
      setAlertSettingsError('Failed to save settings. Please try again.');
    } else {
      setAlertSettings(prev => ({ ...prev, threshold_amount: parsed }));
      setAlertSettingsSaved(true);
      setTimeout(() => setAlertSettingsSaved(false), 3000);
    }
    setAlertSettingsLoading(false);
  };

  // ── Derived Metrics ──────────────────────────────────────────────────────────

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const totalAR = invoices.reduce((s, inv) => s + Math.max(0, inv.amount - inv.amount_paid), 0);
  const totalIssued = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalCollected = invoices.reduce((s, inv) => s + inv.amount_paid, 0);
  const overdueInvoices = invoices.filter(inv => inv.due_date < todayStr && inv.payment_status !== 'paid');
  const overdueAR = overdueInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - inv.amount_paid), 0);
  const collectionRate = totalIssued > 0 ? (totalCollected / totalIssued) * 100 : 0;

  const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid' && inv.invoice_date);
  const avgDaysToPay = paidInvoices.length > 0
    ? paidInvoices.reduce((s, inv) => s + daysBetween(inv.invoice_date, inv.due_date), 0) / paidInvoices.length
    : 30;

  // ── Aging Buckets ────────────────────────────────────────────────────────────

  const agingBuckets: AgingBucket[] = [
    { label: 'Current', range: '0–30 days', count: 0, total: 0, collected: 0, outstanding: 0, color: '#355E3B', bgColor: 'bg-emerald-50' },
    { label: '31–60 Days', range: '31–60 days', count: 0, total: 0, collected: 0, outstanding: 0, color: '#f59e0b', bgColor: 'bg-amber-50' },
    { label: '61–90 Days', range: '61–90 days', count: 0, total: 0, collected: 0, outstanding: 0, color: '#f97316', bgColor: 'bg-orange-50' },
    { label: '90+ Days', range: '90+ days', count: 0, total: 0, collected: 0, outstanding: 0, color: '#ef4444', bgColor: 'bg-red-50' },
  ];

  invoices.forEach(inv => {
    if (inv.payment_status === 'paid') return;
    const daysOld = daysBetween(inv.due_date || inv.invoice_date, todayStr);
    const outstanding = Math.max(0, inv.amount - inv.amount_paid);
    let bucket: AgingBucket;
    if (daysOld <= 30) bucket = agingBuckets[0];
    else if (daysOld <= 60) bucket = agingBuckets[1];
    else if (daysOld <= 90) bucket = agingBuckets[2];
    else bucket = agingBuckets[3];
    bucket.count++;
    bucket.total += inv.amount;
    bucket.collected += inv.amount_paid;
    bucket.outstanding += outstanding;
  });

  // ── Monthly Projections (6 months forward) ───────────────────────────────────

  const monthlyProjections: MonthlyProjection[] = [];

  // Historical: last 3 months
  for (let i = -3; i <= 0; i++) {
    const monthStart = addMonths(today, i);
    monthStart.setDate(1);
    const monthEnd = addMonths(monthStart, 1);
    const monthInvs = invoices.filter(inv => {
      const d = new Date(inv.invoice_date);
      return d >= monthStart && d < monthEnd;
    });
    const projected = monthInvs.reduce((s, inv) => s + inv.amount, 0);
    const collected = monthInvs.reduce((s, inv) => s + inv.amount_paid, 0);
    const outstanding = monthInvs.reduce((s, inv) => s + Math.max(0, inv.amount - inv.amount_paid), 0);
    monthlyProjections.push({
      month: formatMonth(monthStart),
      projected,
      collected,
      outstanding,
      writeOff: projected > 0 ? projected * (1 - collectionRate / 100) * 0.1 : 0,
    });
  }

  // Forward projection: next 6 months using avg monthly billing velocity
  const last3Months = monthlyProjections.slice(-3);
  const avgMonthlyBilling = last3Months.length > 0
    ? last3Months.reduce((s, m) => s + m.projected, 0) / last3Months.length
    : 0;
  const avgMonthlyCollected = last3Months.length > 0
    ? last3Months.reduce((s, m) => s + m.collected, 0) / last3Months.length
    : 0;

  // Distribute outstanding AR across next months based on aging
  const arRecoverySchedule = [
    agingBuckets[0].outstanding * 0.85,  // current → mostly collected next month
    agingBuckets[1].outstanding * 0.60,  // 31-60 → partial
    agingBuckets[2].outstanding * 0.35,  // 61-90 → some
    agingBuckets[3].outstanding * 0.10,  // 90+ → unlikely
  ];
  const totalProjectedARRecovery = arRecoverySchedule.reduce((s, v) => s + v, 0);

  for (let i = 1; i <= 6; i++) {
    const monthStart = addMonths(today, i);
    monthStart.setDate(1);
    const arRecovery = i === 1 ? totalProjectedARRecovery * 0.5
      : i === 2 ? totalProjectedARRecovery * 0.3
      : i === 3 ? totalProjectedARRecovery * 0.15
      : totalProjectedARRecovery * 0.05 / 3;
    const newBilling = avgMonthlyBilling * (1 + 0.02 * i); // slight growth assumption
    const projectedCollected = newBilling * (collectionRate / 100) + arRecovery;
    monthlyProjections.push({
      month: formatMonth(monthStart),
      projected: Math.round(newBilling),
      collected: Math.round(projectedCollected),
      outstanding: Math.round(newBilling * (1 - collectionRate / 100)),
      writeOff: Math.round(newBilling * 0.03),
    });
  }

  // ── Cash Flow Alerts Computation ─────────────────────────────────────────────

  const forecastMonths = monthlyProjections.slice(4); // forward projections only
  const activeAlerts: CashFlowAlert[] = alertSettings.alert_enabled
    ? forecastMonths
        .slice(0, alertSettings.look_ahead_months)
        .filter(m => m.collected < alertSettings.threshold_amount)
        .map(m => ({
          month: m.month,
          projected: m.collected,
          threshold: alertSettings.threshold_amount,
          deficit: alertSettings.threshold_amount - m.collected,
        }))
    : [];

  // ── Payment Velocity (weekly, last 12 weeks) ──────────────────────────────────

  const velocityData: VelocityPoint[] = [];
  for (let w = 11; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);

    const weekInvs = invoices.filter(inv => {
      const d = new Date(inv.invoice_date);
      return d >= weekStart && d <= weekEnd;
    });
    const weekPaid = invoices.filter(inv => {
      const d = new Date(inv.invoice_date);
      return d >= weekStart && d <= weekEnd && inv.payment_status === 'paid';
    });

    const avgDays = weekPaid.length > 0
      ? weekPaid.reduce((s, inv) => s + daysBetween(inv.invoice_date, inv.due_date), 0) / weekPaid.length
      : avgDaysToPay;

    const wkCollRate = weekInvs.length > 0 ? (weekPaid.length / weekInvs.length) * 100 : collectionRate;

    velocityData.push({
      week: `Wk ${12 - w}`,
      avgDaysToPay: Math.round(avgDays),
      invoicesIssued: weekInvs.length,
      invoicesPaid: weekPaid.length,
      collectionRate: Math.round(wkCollRate),
    });
  }

  // ── KPI Cards ────────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'Total Outstanding AR',
      value: formatCurrency(totalAR),
      sub: `${invoices.filter(i => i.payment_status !== 'paid').length} open invoices`,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      label: 'Overdue AR',
      value: formatCurrency(overdueAR),
      sub: `${overdueInvoices.length} overdue invoices`,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
    },
    {
      label: 'Collection Rate',
      value: `${collectionRate.toFixed(1)}%`,
      sub: `Avg ${Math.round(avgDaysToPay)} days to pay`,
      color: collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 60 ? 'text-amber-600' : 'text-red-600',
      bg: collectionRate >= 80 ? 'bg-emerald-50' : collectionRate >= 60 ? 'bg-amber-50' : 'bg-red-50',
      border: collectionRate >= 80 ? 'border-emerald-200' : collectionRate >= 60 ? 'border-amber-200' : 'border-red-200',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      ),
    },
    {
      label: 'Projected Next Month',
      value: formatCurrency(monthlyProjections[monthlyProjections.length - 6]?.collected ?? 0),
      sub: `From ${formatCurrency(monthlyProjections[monthlyProjections.length - 6]?.projected ?? 0)} billed`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cash Position Projection</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monthly cash forecast based on invoice age, payment velocity, and outstanding AR trends
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Active Alert Banner */}
      {alertSettings.alert_enabled && activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                Cash Flow Alert — {activeAlerts.length} month{activeAlerts.length > 1 ? 's' : ''} below threshold
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Projected collections drop below {formatCurrency(alertSettings.threshold_amount)} in the following months:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-semibold text-red-700">{alert.month}</span>
                    <span className="text-xs text-red-500">—</span>
                    <span className="text-xs text-red-600">{formatCurrency(alert.projected)} projected</span>
                    <span className="text-xs text-red-400">({formatCurrency(alert.deficit)} shortfall)</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setActiveView('alerts')}
              className="shrink-0 text-xs text-red-600 font-medium underline hover:no-underline"
            >
              Configure
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className={`rounded-xl border p-4 ${kpi.bg} ${kpi.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <span className={kpi.color}>{kpi.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 w-fit flex-wrap">
        {(['projection', 'aging', 'velocity', 'alerts'] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize flex items-center gap-1.5 ${
              activeView === v
                ? 'bg-white text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'projection' ? 'Monthly Projection' : v === 'aging' ? 'AR Aging' : v === 'velocity' ? 'Payment Velocity' : (
              <>
                Alert Settings
                {activeAlerts.length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {activeAlerts.length}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Monthly Cash Projection View ── */}
      {activeView === 'projection' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monthly Cash Position (9-Month View)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">3 months historical + 6 months projected</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: ACCENT }} />Collected</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-amber-400" />Projected</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-300" />Outstanding</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyProjections} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <ReferenceLine x={formatMonth(today)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#94a3b8' }} />
                {alertSettings.alert_enabled && (
                  <ReferenceLine y={alertSettings.threshold_amount} stroke="#ef4444" strokeDasharray="6 3" label={{ value: `Alert: ${formatCurrency(alertSettings.threshold_amount)}`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
                )}
                <Area type="monotone" dataKey="projected" name="Projected Billed" stroke="#f59e0b" fill="url(#gradProjected)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={ACCENT} fill="url(#gradCollected)" strokeWidth={2} />
                <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Projection Table */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-secondary/20">
              <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/10">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Month</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Projected Billed</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Collected</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Outstanding</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Est. Write-Off</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Collection %</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyProjections.map((row, i) => {
                    const isProjected = i >= 4;
                    const rate = row.projected > 0 ? (row.collected / row.projected) * 100 : 0;
                    const isBelowThreshold = isProjected && alertSettings.alert_enabled && row.collected < alertSettings.threshold_amount;
                    return (
                      <tr key={i} className={`border-b border-border/50 hover:bg-secondary/10 ${isProjected ? 'bg-blue-50/30' : ''} ${isBelowThreshold ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {row.month}
                          {isProjected && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Forecast</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(row.projected)}</td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: isBelowThreshold ? '#dc2626' : ACCENT }}>{formatCurrency(row.collected)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{formatCurrency(row.outstanding)}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(row.writeOff)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-semibold ${rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                            {rate.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isBelowThreshold ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                              Below
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── AR Aging View ── */}
      {activeView === 'aging' && (
        <div className="space-y-4">
          {/* Aging Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {agingBuckets.map((bucket, i) => (
              <div key={i} className={`rounded-xl border p-4 ${bucket.bgColor}`} style={{ borderColor: bucket.color + '40' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: bucket.color }}>{bucket.label}</span>
                  <span className="text-xs text-muted-foreground">{bucket.range}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{formatCurrency(bucket.outstanding)}</p>
                <p className="text-xs text-muted-foreground mt-1">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
                <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${totalAR > 0 ? (bucket.outstanding / totalAR) * 100 : 0}%`, background: bucket.color }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {totalAR > 0 ? ((bucket.outstanding / totalAR) * 100).toFixed(1) : 0}% of total AR
                </p>
              </div>
            ))}
          </div>

          {/* Aging Bar Chart */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">AR Aging Distribution</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={agingBuckets} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="outstanding" name="Outstanding" radius={[4, 4, 0, 0]}>
                  {agingBuckets.map((bucket, i) => (
                    <rect key={i} fill={bucket.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recovery Probability */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">AR Recovery Probability</h3>
            <p className="text-xs text-muted-foreground mb-4">Estimated collectability based on invoice age and historical payment velocity</p>
            <div className="space-y-3">
              {[
                { label: 'Current (0–30 days)', outstanding: agingBuckets[0].outstanding, rate: 85, color: '#355E3B' },
                { label: '31–60 Days', outstanding: agingBuckets[1].outstanding, rate: 60, color: '#f59e0b' },
                { label: '61–90 Days', outstanding: agingBuckets[2].outstanding, rate: 35, color: '#f97316' },
                { label: '90+ Days', outstanding: agingBuckets[3].outstanding, rate: 10, color: '#ef4444' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-36 text-xs text-muted-foreground shrink-0">{row.label}</div>
                  <div className="flex-1 h-2 bg-secondary/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${row.rate}%`, background: row.color }} />
                  </div>
                  <div className="text-xs font-semibold w-10 text-right" style={{ color: row.color }}>{row.rate}%</div>
                  <div className="text-xs text-muted-foreground w-24 text-right">{formatCurrency(row.outstanding * row.rate / 100)} est.</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Total Estimated Recoverable</span>
              <span className="text-sm font-bold" style={{ color: ACCENT }}>
                {formatCurrency(
                  agingBuckets[0].outstanding * 0.85 +
                  agingBuckets[1].outstanding * 0.60 +
                  agingBuckets[2].outstanding * 0.35 +
                  agingBuckets[3].outstanding * 0.10
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Velocity View ── */}
      {activeView === 'velocity' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Weekly Payment Velocity (Last 12 Weeks)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Average days to pay and collection rate per week</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={velocityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="avgDaysToPay" name="Avg Days to Pay" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="collectionRate" name="Collection Rate %" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Velocity Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Avg Days to Pay</p>
              <p className="text-3xl font-bold text-foreground">{Math.round(avgDaysToPay)}</p>
              <p className="text-xs text-muted-foreground mt-1">days from invoice date</p>
              <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit ${avgDaysToPay <= 30 ? 'bg-emerald-100 text-emerald-700' : avgDaysToPay <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {avgDaysToPay <= 30 ? 'Healthy' : avgDaysToPay <= 60 ? 'Moderate' : 'Slow'}
              </div>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Overall Collection Rate</p>
              <p className="text-3xl font-bold" style={{ color: ACCENT }}>{collectionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">of all invoiced amounts</p>
              <div className="mt-2 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${collectionRate}%`, background: ACCENT }} />
              </div>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">AR Turnover Rate</p>
              <p className="text-3xl font-bold text-blue-600">
                {totalAR > 0 && avgMonthlyCollected > 0 ? (avgMonthlyCollected / totalAR * 30).toFixed(1) : '—'}x
              </p>
              <p className="text-xs text-muted-foreground mt-1">monthly collections / AR balance</p>
              <p className="text-xs text-muted-foreground mt-2">
                Est. {totalAR > 0 && avgMonthlyCollected > 0 ? Math.round(totalAR / avgMonthlyCollected) : '—'} months to clear current AR
              </p>
            </div>
          </div>

          {/* Invoice Volume Chart */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Invoice Volume</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={velocityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="invoicesIssued" name="Issued" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="invoicesPaid" name="Paid" fill={ACCENT} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Alert Settings View ── */}
      {activeView === 'alerts' && (
        <div className="space-y-5">
          {/* Current Alert Status */}
          <div className={`rounded-xl border p-5 ${activeAlerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeAlerts.length > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                {activeAlerts.length > 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${activeAlerts.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {activeAlerts.length > 0
                    ? `${activeAlerts.length} Alert${activeAlerts.length > 1 ? 's' : ''} Active`
                    : 'All Clear — No Alerts'}
                </p>
                <p className={`text-xs mt-0.5 ${activeAlerts.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {activeAlerts.length > 0
                    ? `Projected collections fall below ${formatCurrency(alertSettings.threshold_amount)} in ${activeAlerts.map(a => a.month).join(', ')}`
                    : `All projected months exceed the ${formatCurrency(alertSettings.threshold_amount)} threshold`}
                </p>
              </div>
            </div>
          </div>

          {/* Alert Breakdown (if active) */}
          {activeAlerts.length > 0 && (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Alert Details</h3>
                <span className="text-xs text-muted-foreground">Next {alertSettings.look_ahead_months} months</span>
              </div>
              <div className="divide-y divide-border">
                {activeAlerts.map((alert, i) => (
                  <div key={i} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{alert.month}</p>
                        <p className="text-xs text-muted-foreground">Projected: {formatCurrency(alert.projected)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">−{formatCurrency(alert.deficit)}</p>
                      <p className="text-xs text-muted-foreground">below threshold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Form */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Alert Configuration</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Set a minimum projected collection threshold. You'll be notified when any forecast month drops below this amount.
            </p>

            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Cash Flow Alerts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Show alert banners when projections drop below threshold</p>
                </div>
                <button
                  onClick={() => setAlertSettings(prev => ({ ...prev, alert_enabled: !prev.alert_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${alertSettings.alert_enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${alertSettings.alert_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Threshold amount */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Minimum Collection Threshold
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Alert when any projected month's collections fall below this amount
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                  <input
                    type="text"
                    value={editingThreshold}
                    onChange={e => setEditingThreshold(e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    placeholder="5000"
                  />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[2500, 5000, 10000, 15000, 25000].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setEditingThreshold(String(preset))}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        editingThreshold === String(preset)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium' :'border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
                      }`}
                    >
                      {formatCurrency(preset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Look-ahead months */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Look-Ahead Window
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  How many months ahead to monitor for threshold breaches
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 6].map(m => (
                    <button
                      key={m}
                      onClick={() => setAlertSettings(prev => ({ ...prev, look_ahead_months: m }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        alertSettings.look_ahead_months === m
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold' :'border-border text-muted-foreground hover:border-emerald-300'
                      }`}
                    >
                      {m} mo
                    </button>
                  ))}
                </div>
              </div>

              {/* Notify email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notification Email <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Email address to receive alert notifications (for future email integration)
                </p>
                <input
                  type="email"
                  value={alertSettings.notify_email}
                  onChange={e => setAlertSettings(prev => ({ ...prev, notify_email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="admin@example.com"
                />
              </div>

              {/* Error */}
              {alertSettingsError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{alertSettingsError}</p>
              )}

              {/* Save button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveAlertSettings}
                  disabled={alertSettingsLoading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                  style={{ background: ACCENT }}
                >
                  {alertSettingsLoading ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  )}
                  {alertSettingsLoading ? 'Saving…' : 'Save Settings'}
                </button>
                {alertSettingsSaved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Settings saved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Projection preview with threshold line */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Projection vs. Threshold Preview</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Red dashed line shows your alert threshold ({formatCurrency(alertSettings.threshold_amount)}) against projected collections
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyProjections} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradAlertCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <ReferenceLine
                  y={alertSettings.threshold_amount}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
                />
                <Area type="monotone" dataKey="collected" name="Projected Collections" stroke={ACCENT} fill="url(#gradAlertCollected)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
