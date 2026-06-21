'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SMSLog {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_type: 'client' | 'staff';
  message_type: 'deadline' | 'overdue_payment';
  message_body: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  error?: string;
}

interface DeadlineItem {
  id: string;
  title: string;
  case_name: string;
  due_date: string;
  days_until: number;
  assigned_to: string;
  phone?: string;
  email: string;
  type: 'deadline' | 'court_date' | 'meeting' | 'milestone';
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone?: string;
  client_email: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  payment_link?: string;
}

interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number, isOverdue = false) {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days <= 1) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Tomorrow</span>;
  if (days <= 3) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{days}d left</span>;
  if (days <= 7) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{days}d left</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{days}d left</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SMSRemindersDashboard() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'deadlines' | 'overdue' | 'logs'>('deadlines');
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sendAll, setSendAll] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [filterDays, setFilterDays] = useState<number>(7);
  const [stats, setStats] = useState({ totalSent: 0, totalFailed: 0, deadlinesSent: 0, paymentsSent: 0 });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadDeadlines = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + filterDays);

    const { data, error } = await supabase
      .from('case_events')
      .select(`
        id, title, event_type, event_date, event_time, notes,
        case_id,
        paralegal_roster!inner(id, name, email, phone)
      `)
      .lte('event_date', cutoff.toISOString().split('T')[0])
      .gte('event_date', new Date().toISOString().split('T')[0])
      .in('event_type', ['deadline', 'court_date', 'meeting', 'milestone'])
      .order('event_date', { ascending: true })
      .limit(50);

    if (!error && data) {
      const items: DeadlineItem[] = data.map((row: any) => ({
        id: row.id,
        title: row.title,
        case_name: row.case_id ?? 'N/A',
        due_date: row.event_date,
        days_until: getDaysUntil(row.event_date),
        assigned_to: row.paralegal_roster?.name ?? 'Staff',
        phone: row.paralegal_roster?.phone ?? '',
        email: row.paralegal_roster?.email ?? '',
        type: row.event_type,
      }));
      setDeadlines(items);
    } else {
      // Fallback mock data for preview
      setDeadlines([
        { id: 'mock-1', title: 'File Motion for Summary Judgment', case_name: 'Johnson v. Smith', due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], days_until: 1, assigned_to: 'Maggi May Broussard', phone: '', email: 'staff@broussardlegalservices.com', type: 'deadline' },
        { id: 'mock-2', title: 'Court Hearing — Preliminary Injunction', case_name: 'Davis Estate Matter', due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], days_until: 3, assigned_to: 'Paralegal Team', phone: '', email: 'staff@broussardlegalservices.com', type: 'court_date' },
        { id: 'mock-3', title: 'Client Document Review Deadline', case_name: 'Williams Contract', due_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], days_until: 5, assigned_to: 'Maggi May Broussard', phone: '', email: 'staff@broussardlegalservices.com', type: 'milestone' },
      ]);
    }
  }, [supabase, filterDays]);

  const loadOverdueInvoices = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('client_invoices')
      .select(`
        id, invoice_number, amount, due_date, payment_link, status,
        contact_inquiries!inner(name, email, phone)
      `)
      .in('status', ['unpaid', 'overdue', 'pending'])
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(50);

    if (!error && data) {
      const items: OverdueInvoice[] = data.map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number ?? `INV-${row.id.slice(0, 6).toUpperCase()}`,
        client_name: row.contact_inquiries?.name ?? 'Client',
        client_phone: row.contact_inquiries?.phone ?? '',
        client_email: row.contact_inquiries?.email ?? '',
        amount: row.amount,
        due_date: row.due_date,
        days_overdue: Math.abs(getDaysUntil(row.due_date)),
        payment_link: row.payment_link ?? `https://broussardlegalservices.com/portal/invoices`,
      }));
      setOverdueInvoices(items);
    } else {
      // Fallback mock data for preview
      setOverdueInvoices([
        { id: 'mock-inv-1', invoice_number: 'INV-2024-001', client_name: 'Robert Johnson', client_phone: '', client_email: 'client@example.com', amount: 1500, due_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], days_overdue: 5, payment_link: 'https://broussardlegalservices.com/portal/invoices' },
        { id: 'mock-inv-2', invoice_number: 'INV-2024-002', client_name: 'Sarah Williams', client_phone: '', client_email: 'sarah@example.com', amount: 2750, due_date: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0], days_overdue: 12, payment_link: 'https://broussardlegalservices.com/portal/invoices' },
        { id: 'mock-inv-3', invoice_number: 'INV-2024-003', client_name: 'Michael Davis', client_phone: '', client_email: 'mdavis@example.com', amount: 875, due_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], days_overdue: 2, payment_link: 'https://broussardlegalservices.com/portal/invoices' },
      ]);
    }
  }, [supabase]);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('sms_reminder_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (data) {
      setSmsLogs(data as SMSLog[]);
      const sent = data.filter((l: any) => l.status === 'sent').length;
      const failed = data.filter((l: any) => l.status === 'failed').length;
      const deadlinesSent = data.filter((l: any) => l.status === 'sent' && l.message_type === 'deadline').length;
      const paymentsSent = data.filter((l: any) => l.status === 'sent' && l.message_type === 'overdue_payment').length;
      setStats({ totalSent: sent, totalFailed: failed, deadlinesSent, paymentsSent });
    }
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadDeadlines(), loadOverdueInvoices(), loadLogs()]);
      setLoading(false);
    };
    load();
  }, [loadDeadlines, loadOverdueInvoices, loadLogs]);

  // ── Send SMS ───────────────────────────────────────────────────────────────

  const sendDeadlineSMS = async (item: DeadlineItem) => {
    const phone = phoneOverrides[item.id] || item.phone;
    if (!phone) {
      showToast('error', `No phone number for ${item.assigned_to}. Enter one in the phone field.`);
      return;
    }

    setSending((prev) => ({ ...prev, [item.id]: true }));

    const urgencyPrefix = item.days_until <= 1 ? '🚨 URGENT — TOMORROW' : item.days_until <= 3 ? '⚠️ URGENT' : '📅 Reminder';
    const typeLabel = { deadline: 'Case Deadline', court_date: 'Court Date', meeting: 'Meeting', milestone: 'Case Milestone' }[item.type] ?? 'Event';
    const message = `Broussard Legal Services\n\n${urgencyPrefix}: ${typeLabel} — "${item.title}" is due ${item.days_until <= 1 ? 'TOMORROW' : `in ${item.days_until} days`} (${formatDate(item.due_date)}).\n\nCase: ${item.case_name}\n\nLog in to the admin portal for full details.\n\nReply STOP to opt out.`;

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'custom', to: phone, message }),
      });
      const result: SendResult = await res.json();

      if (result.success) {
        showToast('success', `SMS sent to ${item.assigned_to} (${phone})`);
        await logSMS({ recipientName: item.assigned_to, recipientPhone: phone, recipientType: 'staff', messageType: 'deadline', messageBody: message, status: 'sent' });
        await loadLogs();
      } else {
        showToast('error', `Failed: ${result.error}`);
        await logSMS({ recipientName: item.assigned_to, recipientPhone: phone, recipientType: 'staff', messageType: 'deadline', messageBody: message, status: 'failed', error: result.error });
      }
    } catch (err) {
      showToast('error', 'Network error sending SMS');
    } finally {
      setSending((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const sendOverdueSMS = async (invoice: OverdueInvoice) => {
    const phone = phoneOverrides[invoice.id] || invoice.client_phone;
    if (!phone) {
      showToast('error', `No phone number for ${invoice.client_name}. Enter one in the phone field.`);
      return;
    }

    setSending((prev) => ({ ...prev, [invoice.id]: true }));

    const firstName = invoice.client_name.split(' ')[0];
    const message = `Broussard Legal Services\n\nHi ${firstName}, invoice #${invoice.invoice_number} for ${formatCurrency(invoice.amount)} is OVERDUE by ${invoice.days_overdue} day${invoice.days_overdue !== 1 ? 's' : ''} (was due ${formatDate(invoice.due_date)}).\n\nPlease pay now: ${invoice.payment_link}\n\nQuestions? Call our office.\n\nReply STOP to opt out.`;

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'custom', to: phone, message }),
      });
      const result: SendResult = await res.json();

      if (result.success) {
        showToast('success', `SMS sent to ${invoice.client_name} (${phone})`);
        await logSMS({ recipientName: invoice.client_name, recipientPhone: phone, recipientType: 'client', messageType: 'overdue_payment', messageBody: message, status: 'sent' });
        await loadLogs();
      } else {
        showToast('error', `Failed: ${result.error}`);
        await logSMS({ recipientName: invoice.client_name, recipientPhone: phone, recipientType: 'client', messageType: 'overdue_payment', messageBody: message, status: 'failed', error: result.error });
      }
    } catch (err) {
      showToast('error', 'Network error sending SMS');
    } finally {
      setSending((prev) => ({ ...prev, [invoice.id]: false }));
    }
  };

  const logSMS = async (opts: {
    recipientName: string;
    recipientPhone: string;
    recipientType: 'client' | 'staff';
    messageType: 'deadline' | 'overdue_payment';
    messageBody: string;
    status: 'sent' | 'failed';
    error?: string;
  }) => {
    await supabase.from('sms_reminder_logs').insert({
      recipient_name: opts.recipientName,
      recipient_phone: opts.recipientPhone,
      recipient_type: opts.recipientType,
      message_type: opts.messageType,
      message_body: opts.messageBody,
      status: opts.status,
      sent_at: new Date().toISOString(),
      error: opts.error ?? null,
    });
  };

  const sendAllDeadlines = async () => {
    setSendAll(true);
    const urgentItems = deadlines.filter((d) => d.days_until <= filterDays);
    for (const item of urgentItems) {
      await sendDeadlineSMS(item);
    }
    setSendAll(false);
    showToast('success', `Sent ${urgentItems.length} deadline reminder${urgentItems.length !== 1 ? 's' : ''}`);
  };

  const sendAllOverdue = async () => {
    setSendAll(true);
    for (const invoice of overdueInvoices) {
      await sendOverdueSMS(invoice);
    }
    setSendAll(false);
    showToast('success', `Sent ${overdueInvoices.length} overdue payment reminder${overdueInvoices.length !== 1 ? 's' : ''}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'deadlines' as const, label: 'Matter Deadlines', count: deadlines.length, icon: '⚖️' },
    { id: 'overdue' as const, label: 'Overdue Payments', count: overdueInvoices.length, icon: '💳' },
    { id: 'logs' as const, label: 'SMS Logs', count: smsLogs.length, icon: '📋' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <span className="text-2xl">📱</span>
            SMS Reminders
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send urgent matter deadline and overdue payment reminders via Twilio SMS to clients and staff
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Powered by Twilio
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: stats.totalSent, icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Failed', value: stats.totalFailed, icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Deadline SMS', value: stats.deadlinesSent, icon: '⚖️', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Payment SMS', value: stats.paymentsSent, icon: '💳', color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} border border-border/40 rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              <span className="text-base">{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Deadlines Tab ── */}
          {activeTab === 'deadlines' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground font-medium">Show deadlines within</label>
                  <select
                    value={filterDays}
                    onChange={(e) => setFilterDays(Number(e.target.value))}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
                <button
                  onClick={sendAllDeadlines}
                  disabled={sendAll || deadlines.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendAll ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending all...</>
                  ) : (
                    <><span>📤</span>Send All Deadline Reminders ({deadlines.length})</>
                  )}
                </button>
              </div>

              {deadlines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <span className="text-4xl block mb-3">✅</span>
                  <p className="font-medium">No upcoming deadlines in the next {filterDays} day{filterDays !== 1 ? 's' : ''}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deadlines.map((item) => (
                    <div key={item.id} className="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm truncate">{item.title}</span>
                            {urgencyBadge(item.days_until)}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{item.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            <span className="font-medium">Case:</span> {item.case_name} &nbsp;·&nbsp;
                            <span className="font-medium">Assigned:</span> {item.assigned_to} &nbsp;·&nbsp;
                            <span className="font-medium">Due:</span> {formatDate(item.due_date)}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">📱 Phone:</span>
                            <input
                              type="tel"
                              placeholder="+1 (555) 000-0000"
                              value={phoneOverrides[item.id] ?? item.phone ?? ''}
                              onChange={(e) => setPhoneOverrides((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground w-44 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => sendDeadlineSMS(item)}
                          disabled={sending[item.id]}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                        >
                          {sending[item.id] ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                          ) : (
                            <><span>📤</span>Send SMS</>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Overdue Payments Tab ── */}
          {activeTab === 'overdue' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''} — send SMS reminders directly to clients
                </p>
                <button
                  onClick={sendAllOverdue}
                  disabled={sendAll || overdueInvoices.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendAll ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending all...</>
                  ) : (
                    <><span>📤</span>Send All Overdue Reminders ({overdueInvoices.length})</>
                  )}
                </button>
              </div>

              {overdueInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <span className="text-4xl block mb-3">🎉</span>
                  <p className="font-medium">No overdue invoices — all payments are current!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueInvoices.map((invoice) => (
                    <div key={invoice.id} className="bg-card border border-border/60 rounded-xl p-4 hover:border-red-300 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm">{invoice.client_name}</span>
                            <span className="text-xs font-mono text-muted-foreground">{invoice.invoice_number}</span>
                            {urgencyBadge(-invoice.days_overdue, true)}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            <span className="font-semibold text-red-600">{formatCurrency(invoice.amount)}</span> &nbsp;·&nbsp;
                            <span className="font-medium">Due:</span> {formatDate(invoice.due_date)} &nbsp;·&nbsp;
                            <span className="font-medium">Email:</span> {invoice.client_email}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">📱 Phone:</span>
                            <input
                              type="tel"
                              placeholder="+1 (555) 000-0000"
                              value={phoneOverrides[invoice.id] ?? invoice.client_phone ?? ''}
                              onChange={(e) => setPhoneOverrides((prev) => ({ ...prev, [invoice.id]: e.target.value }))}
                              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground w-44 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => sendOverdueSMS(invoice)}
                          disabled={sending[invoice.id]}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                        >
                          {sending[invoice.id] ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                          ) : (
                            <><span>📤</span>Send SMS</>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Logs Tab ── */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{smsLogs.length} SMS message{smsLogs.length !== 1 ? 's' : ''} logged</p>
                <button
                  onClick={loadLogs}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  ↻ Refresh
                </button>
              </div>

              {smsLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <span className="text-4xl block mb-3">📋</span>
                  <p className="font-medium">No SMS messages sent yet</p>
                  <p className="text-xs mt-1">Sent reminders will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipient</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {smsLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{log.recipient_name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{log.recipient_type}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${log.message_type === 'deadline' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {log.message_type === 'deadline' ? '⚖️ Deadline' : '💳 Payment'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.recipient_phone}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                              log.status === 'failed'? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {log.status === 'sent' ? '✓' : log.status === 'failed' ? '✕' : '⏳'} {log.status}
                            </span>
                            {log.error && <div className="text-xs text-red-500 mt-0.5 truncate max-w-[160px]" title={log.error}>{log.error}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(log.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
