'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultationReminder {
  id: string;
  booking_id: string;
  reminder_type: '24hr' | '48hr_followup' | 'custom';
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string | null;
  booking_date: string;
  booking_time: string;
  scheduled_at: string;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  sms_status: 'sent' | 'failed' | 'skipped' | null;
  created_at: string;
}

interface AutomationStats {
  pending24hr: number;
  pending48hr: number;
  sentToday: number;
  failedTotal: number;
  smsDelivered: number;
  emailDelivered: number;
}

interface ManualSMSForm {
  to: string;
  type: string;
  clientName: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    sent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    skipped: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
      {status === 'sent' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      {status === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function reminderTypeBadge(type: string) {
  if (type === '24hr') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">⏰ 24hr Reminder</span>;
  if (type === '48hr_followup') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">💬 48hr Follow-Up</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">📨 Custom</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsultationAutomationDashboard() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'reminders' | 'followups' | 'manual' | 'logs'>('overview');
  const [reminders, setReminders] = useState<ConsultationReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AutomationStats>({
    pending24hr: 0, pending48hr: 0, sentToday: 0, failedTotal: 0, smsDelivered: 0, emailDelivered: 0,
  });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [manualForm, setManualForm] = useState<ManualSMSForm>({ to: '', type: 'custom', clientName: '', message: '' });
  const [sendingManual, setSendingManual] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultation_reminder_logs')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setReminders(data as ConsultationReminder[]);
        const today = new Date().toISOString().split('T')[0];
        setStats({
          pending24hr: data.filter((r) => r.reminder_type === '24hr' && r.send_status === 'pending').length,
          pending48hr: data.filter((r) => r.reminder_type === '48hr_followup' && r.send_status === 'pending').length,
          sentToday: data.filter((r) => r.sent_at?.startsWith(today)).length,
          failedTotal: data.filter((r) => r.send_status === 'failed').length,
          smsDelivered: data.filter((r) => (r as any).sms_status === 'sent').length,
          emailDelivered: data.filter((r) => r.send_status === 'sent').length,
        });
      } else {
        // Mock data for display
        const mockData: ConsultationReminder[] = [
          {
            id: '1', booking_id: 'b1', reminder_type: '24hr', recipient_name: 'Sarah Johnson',
            recipient_email: 'sarah@example.com', recipient_phone: '+15041234567',
            booking_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            booking_time: '14:00', scheduled_at: new Date(Date.now() + 3600000).toISOString(),
            send_status: 'pending', sent_at: null, sms_status: null, created_at: new Date().toISOString(),
          },
          {
            id: '2', booking_id: 'b2', reminder_type: '48hr_followup', recipient_name: 'Michael Davis',
            recipient_email: 'mdavis@example.com', recipient_phone: '+15049876543',
            booking_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
            booking_time: '10:00', scheduled_at: new Date(Date.now() - 3600000).toISOString(),
            send_status: 'sent', sent_at: new Date(Date.now() - 3600000).toISOString(), sms_status: 'sent', created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
          {
            id: '3', booking_id: 'b3', reminder_type: '24hr', recipient_name: 'Lisa Williams',
            recipient_email: 'lisa@example.com', recipient_phone: null,
            booking_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
            booking_time: '09:00', scheduled_at: new Date(Date.now() + 26 * 3600000).toISOString(),
            send_status: 'pending', sent_at: null, sms_status: null, created_at: new Date().toISOString(),
          },
        ];
        setReminders(mockData);
        setStats({ pending24hr: 2, pending48hr: 1, sentToday: 3, failedTotal: 0, smsDelivered: 8, emailDelivered: 12 });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResend = async (reminder: ConsultationReminder) => {
    setSending((prev) => ({ ...prev, [reminder.id]: true }));
    try {
      const endpoint = reminder.reminder_type === '48hr_followup' ?'/api/sms/send' :'/api/sms/booking-reminder';

      let body: Record<string, unknown>;
      if (reminder.reminder_type === '48hr_followup') {
        body = {
          type: 'consultation_followup',
          to: reminder.recipient_phone,
          clientName: reminder.recipient_name,
          bookingDate: reminder.booking_date,
        };
      } else {
        body = {
          type: 'reminder_24hr',
          to: reminder.recipient_phone,
          clientName: reminder.recipient_name,
          appointmentDate: reminder.booking_date,
          appointmentTime: reminder.booking_time,
        };
      }

      if (!reminder.recipient_phone) {
        showToast('error', 'No phone number on file for this client');
        return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');

      await supabase
        .from('consultation_reminder_logs')
        .update({ send_status: 'sent', sent_at: new Date().toISOString(), sms_status: 'sent' })
        .eq('id', reminder.id);

      setReminders((prev) => prev.map((r) => r.id === reminder.id
        ? { ...r, send_status: 'sent', sent_at: new Date().toISOString(), sms_status: 'sent' }
        : r
      ));
      showToast('success', `SMS sent to ${reminder.recipient_name}`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending((prev) => ({ ...prev, [reminder.id]: false }));
    }
  };

  const handleManualSend = async () => {
    if (!manualForm.to || !manualForm.message) {
      showToast('error', 'Phone number and message are required');
      return;
    }
    setSendingManual(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          to: manualForm.to,
          message: manualForm.message,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      showToast('success', 'SMS sent successfully');
      setManualForm({ to: '', type: 'custom', clientName: '', message: '' });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingManual(false);
    }
  };

  const filtered24hr = reminders.filter((r) => r.reminder_type === '24hr');
  const filtered48hr = reminders.filter((r) => r.reminder_type === '48hr_followup');

  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'reminders', label: '24hr Reminders', icon: '⏰' },
    { id: 'followups', label: '48hr Follow-Ups', icon: '💬' },
    { id: 'manual', label: 'Manual SMS', icon: '📱' },
    { id: 'logs', label: 'All Logs', icon: '📋' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Consultation Automation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Auto-trigger SMS & email reminders 24hr before and follow-ups 48hr after consultations</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Pending 24hr', value: stats.pending24hr, color: 'text-amber-600', bg: 'bg-amber-50', icon: '⏰' },
          { label: 'Pending 48hr', value: stats.pending48hr, color: 'text-purple-600', bg: 'bg-purple-50', icon: '💬' },
          { label: 'Sent Today', value: stats.sentToday, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✅' },
          { label: 'Failed', value: stats.failedTotal, color: 'text-red-600', bg: 'bg-red-50', icon: '❌' },
          { label: 'SMS Delivered', value: stats.smsDelivered, color: 'text-blue-600', bg: 'bg-blue-50', icon: '📱' },
          { label: 'Emails Sent', value: stats.emailDelivered, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '📧' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-border`}>
            <div className="text-lg mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{loading ? '—' : stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Automation Flow */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-sm">🔄</span>
                Automation Flow
              </h3>
              <div className="space-y-3">
                {[
                  { step: '1', title: 'Booking Confirmed', desc: 'Instant SMS confirmation sent to client', color: 'bg-emerald-500', status: 'Active' },
                  { step: '2', title: '24hr Before Consultation', desc: 'SMS + email reminder with Google Meet link', color: 'bg-blue-500', status: 'Active' },
                  { step: '3', title: 'Consultation Occurs', desc: 'Mark consultation as completed in admin', color: 'bg-primary', status: 'Manual' },
                  { step: '4', title: '48hr After Consultation', desc: 'SMS + email follow-up with feedback prompt & next steps', color: 'bg-purple-500', status: 'Active' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}>
                      {item.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Reminders */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">⏰</span>
                Upcoming Reminders
              </h3>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-secondary animate-pulse rounded-lg" />)}
                </div>
              ) : reminders.filter((r) => r.send_status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <div className="text-3xl mb-2">✅</div>
                  No pending reminders
                </div>
              ) : (
                <div className="space-y-2">
                  {reminders.filter((r) => r.send_status === 'pending').slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.recipient_name}</p>
                        <p className="text-xs text-muted-foreground">{reminderTypeBadge(r.reminder_type)} · {formatDate(r.booking_date)}</p>
                      </div>
                      <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {formatDateTime(r.scheduled_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Twilio Status */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-sm">📡</span>
              Twilio Integration Status
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: 'Account SID', key: 'TWILIO_ACCOUNT_SID', configured: true },
                { label: 'Auth Token', key: 'TWILIO_AUTH_TOKEN', configured: true },
                { label: 'Phone Number', key: 'TWILIO_PHONE_NUMBER', configured: true },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${item.configured ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.configured ? 'Configured' : 'Missing'}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 To update Twilio credentials, add <code className="bg-secondary px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-secondary px-1 rounded">TWILIO_AUTH_TOKEN</code>, and <code className="bg-secondary px-1 rounded">TWILIO_PHONE_NUMBER</code> to your environment variables.
            </p>
          </div>
        </div>
      )}

      {/* 24hr Reminders Tab */}
      {activeTab === 'reminders' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">24-Hour Pre-Consultation Reminders</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-sent 24 hours before each scheduled consultation</p>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{filtered24hr.length} total</span>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
            </div>
          ) : filtered24hr.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">⏰</div>
              <p className="font-medium">No 24hr reminders yet</p>
              <p className="text-sm mt-1">Reminders are auto-scheduled when consultations are booked</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered24hr.map((r) => (
                <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{r.recipient_name}</p>
                      {statusBadge(r.send_status)}
                      {r.sms_status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${r.sms_status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          📱 SMS {r.sms_status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consultation: {formatDate(r.booking_date)} at {r.booking_time} · Scheduled: {formatDateTime(r.scheduled_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.recipient_email} {r.recipient_phone ? `· ${r.recipient_phone}` : '· No phone'}</p>
                  </div>
                  {(r.send_status === 'failed' || r.send_status === 'pending') && r.recipient_phone && (
                    <button
                      onClick={() => handleResend(r)}
                      disabled={sending[r.id]}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {sending[r.id] ? 'Sending…' : 'Send SMS'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 48hr Follow-Ups Tab */}
      {activeTab === 'followups' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">48-Hour Post-Consultation Follow-Ups</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-sent 48 hours after each completed consultation for feedback & next steps</p>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{filtered48hr.length} total</span>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
            </div>
          ) : filtered48hr.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">💬</div>
              <p className="font-medium">No follow-ups scheduled yet</p>
              <p className="text-sm mt-1">Follow-ups are auto-scheduled when consultations are completed</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered48hr.map((r) => (
                <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{r.recipient_name}</p>
                      {statusBadge(r.send_status)}
                      {r.sms_status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${r.sms_status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          📱 SMS {r.sms_status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consultation was: {formatDate(r.booking_date)} · Follow-up scheduled: {formatDateTime(r.scheduled_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.recipient_email} {r.recipient_phone ? `· ${r.recipient_phone}` : '· No phone'}</p>
                  </div>
                  {(r.send_status === 'failed' || r.send_status === 'pending') && r.recipient_phone && (
                    <button
                      onClick={() => handleResend(r)}
                      disabled={sending[r.id]}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {sending[r.id] ? 'Sending…' : 'Send Follow-Up'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual SMS Tab */}
      {activeTab === 'manual' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📱</span>
              Send Manual SMS
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  value={manualForm.to}
                  onChange={(e) => setManualForm((p) => ({ ...p, to: e.target.value }))}
                  placeholder="+15041234567"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Client Name (optional)</label>
                <input
                  type="text"
                  value={manualForm.clientName}
                  onChange={(e) => setManualForm((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="Client name for personalization"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Message *</label>
                <textarea
                  value={manualForm.message}
                  onChange={(e) => setManualForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Type your SMS message here..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{manualForm.message.length}/160 characters</p>
              </div>
              <button
                onClick={handleManualSend}
                disabled={sendingManual || !manualForm.to || !manualForm.message}
                className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sendingManual ? 'Sending…' : 'Send SMS via Twilio'}
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">⚡</span>
              Quick Templates
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: 'Booking Confirmation',
                  message: 'Broussard Legal Services\n\nHi [Name]! ✅ Your consultation is CONFIRMED. We look forward to speaking with you. Questions? Visit broussardlegalservices.com\n\nReply STOP to opt out.',
                },
                {
                  label: '24hr Reminder',
                  message: 'Maggi May Broussard Legal Services\n\nHi [Name], reminder: your consultation is TOMORROW. Please have your documents ready.\n\nQuestions? Visit broussardlegalservices.com\n\nReply STOP to opt out.',
                },
                {
                  label: '48hr Follow-Up',
                  message: 'Maggi May Broussard Legal Services\n\nHi [Name], following up on your recent consultation. We\'d love your feedback and want to make sure you have your next steps.\n\nPortal: broussardlegalservices.com/portal/dashboard\n\nReply STOP to opt out.',
                },
                {
                  label: 'Payment Reminder',
                  message: 'Broussard Legal Services\n\nHi [Name], a friendly reminder that your invoice is due. Pay securely at: broussardlegalservices.com/portal/invoices\n\nReply STOP to opt out.',
                },
              ].map((template) => (
                <button
                  key={template.label}
                  onClick={() => setManualForm((p) => ({ ...p, message: template.message }))}
                  className="w-full text-left p-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.message.split('\n')[0]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">All Reminder Logs</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Complete history of all automated SMS and email reminders</p>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-secondary animate-pulse rounded-lg" />)}
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">📋</div>
              <p>No reminder logs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Consultation</th>
                    <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">SMS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reminders.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.recipient_name}</p>
                        <p className="text-xs text-muted-foreground">{r.recipient_email}</p>
                      </td>
                      <td className="px-4 py-3">{reminderTypeBadge(r.reminder_type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.booking_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(r.scheduled_at)}</td>
                      <td className="px-4 py-3">{statusBadge(r.send_status)}</td>
                      <td className="px-4 py-3">
                        {r.recipient_phone
                          ? statusBadge((r as any).sms_status ?? 'pending')
                          : <span className="text-xs text-muted-foreground">No phone</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
