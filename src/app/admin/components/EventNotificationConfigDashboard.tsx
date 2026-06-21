'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PushNotificationManager from '@/components/PushNotificationManager';

interface EventConfig {
  id: string;
  event_key: string;
  event_label: string;
  event_category: string;
  is_enabled: boolean;
  sms_enabled: boolean;
  email_subject_template: string;
  email_body_template: string;
  email_badge: string;
  email_cta_label: string;
  email_cta_url_template: string;
  sms_body_template: string;
  send_delay_minutes: number;
  updated_at: string;
}

interface NotificationLog {
  id: string;
  event_key: string;
  client_email: string;
  client_name: string;
  client_phone: string | null;
  subject: string;
  status: string;
  sms_status: string | null;
  error_message: string | null;
  sent_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  documents: '📄 Documents',
  cases: '⚖️ Cases',
  invoices: '💰 Invoices',
  general: '🔔 General',
};

const CATEGORY_COLORS: Record<string, string> = {
  documents: 'bg-blue-100 text-blue-700 border-blue-200',
  cases: 'bg-amber-100 text-amber-700 border-amber-200',
  invoices: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  general: 'bg-gray-100 text-gray-600 border-gray-200',
};

const VARIABLE_HINTS: Record<string, string[]> = {
  documents: ['{{clientName}}', '{{caseName}}', '{{documentName}}', '{{siteUrl}}'],
  cases: ['{{clientName}}', '{{caseName}}', '{{newStatus}}', '{{updateNotes}}', '{{noteContent}}', '{{siteUrl}}'],
  invoices: ['{{clientName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{retainerName}}', '{{renewalDate}}', '{{planName}}', '{{totalAmount}}', '{{installmentCount}}', '{{installmentAmount}}', '{{firstPaymentDate}}', '{{siteUrl}}'],
  general: ['{{clientName}}', '{{appointmentType}}', '{{appointmentDate}}', '{{appointmentTime}}', '{{siteUrl}}'],
};

export default function EventNotificationConfigDashboard() {
  const [configs, setConfigs] = useState<EventConfig[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'config' | 'logs' | 'test'>('config');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EventConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [testForm, setTestForm] = useState({ eventKey: '', clientEmail: '', clientName: '', clientPhone: '', variables: '' });
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string; skipped?: boolean; emailStatus?: string; smsStatus?: string } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/trigger-event');
      const data = await res.json();
      if (data.configs) setConfigs(data.configs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase
        .from('notification_event_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      if (data) setLogs(data);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (activeView === 'logs') fetchLogs();
  }, [activeView, fetchLogs]);

  const startEdit = (config: EventConfig) => {
    setEditingId(config.id);
    setEditForm({ ...config });
    setSaveMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setSaveMsg(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/notifications/trigger-event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setConfigs((prev) => prev.map((c) => (c.id === editingId ? data.config : c)));
      setSaveMsg('Saved successfully');
      setTimeout(() => {
        setEditingId(null);
        setEditForm({});
        setSaveMsg(null);
      }, 1200);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (config: EventConfig, field: 'is_enabled' | 'sms_enabled') => {
    try {
      const res = await fetch('/api/notifications/trigger-event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: config.id, [field]: !config[field] }),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setConfigs((prev) => prev.map((c) => (c.id === config.id ? data.config : c)));
      }
    } catch {
      // ignore
    }
  };

  const sendTestNotification = async () => {
    if (!testForm.eventKey || !testForm.clientEmail || !testForm.clientName) return;
    setTestSending(true);
    setTestResult(null);
    try {
      let variables: Record<string, string> = {};
      if (testForm.variables.trim()) {
        try {
          variables = JSON.parse(testForm.variables);
        } catch {
          setTestResult({ error: 'Variables must be valid JSON, e.g. {"caseName": "Smith v. Jones"}' });
          setTestSending(false);
          return;
        }
      }
      const res = await fetch('/api/notifications/trigger-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventKey: testForm.eventKey,
          clientEmail: testForm.clientEmail,
          clientName: testForm.clientName,
          clientPhone: testForm.clientPhone || undefined,
          variables,
        }),
      });
      const data = await res.json();
      if (!res.ok) setTestResult({ error: data.error ?? 'Send failed' });
      else if (data.skipped) setTestResult({ skipped: true });
      else setTestResult({ success: true, emailStatus: data.emailStatus, smsStatus: data.smsStatus });
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : 'Send failed' });
    } finally {
      setTestSending(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(configs.map((c) => c.event_category)))];
  const filteredConfigs = filterCategory === 'all' ? configs : configs.filter((c) => c.event_category === filterCategory);

  const enabledCount = configs.filter((c) => c.is_enabled).length;
  const smsEnabledCount = configs.filter((c) => c.sms_enabled).length;
  const totalCount = configs.length;

  return (
    <div className="space-y-6">
      {/* Push Notification Opt-in for Admin */}
      <PushNotificationManager userType="admin" />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Events</p>
          <p className="text-3xl font-semibold text-foreground">{totalCount}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Email Active</p>
          <p className="text-3xl font-semibold text-emerald-600">{enabledCount}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">SMS Active</p>
          <p className="text-3xl font-semibold text-blue-600">{smsEnabledCount}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Notifications Sent</p>
          <p className="text-3xl font-semibold text-foreground">{logs.length > 0 ? logs.filter((l) => l.status === 'sent').length : '—'}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 bg-secondary/30 rounded-xl p-1 w-fit">
        {(['config', 'logs', 'test'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
              activeView === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'config' ? '⚙️ Configure' : v === 'logs' ? '📋 Send Log' : '🧪 Test Send'}
          </button>
        ))}
      </div>

      {/* ── Config View ── */}
      {activeView === 'config' && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterCategory === cat
                    ? 'bg-primary text-white border-primary' :'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? '🔔 All Events' : CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConfigs.map((config) => (
                <div key={config.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {editingId === config.id ? (
                    /* Edit Mode */
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[config.event_category] ?? CATEGORY_COLORS.general}`}>
                            {CATEGORY_LABELS[config.event_category] ?? config.event_category}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{config.event_key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {saveMsg && (
                            <span className={`text-xs font-medium ${saveMsg.includes('success') ? 'text-emerald-600' : 'text-red-500'}`}>
                              {saveMsg}
                            </span>
                          )}
                          <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border">
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            {saving ? 'Saving…' : 'Save Changes'}
                          </button>
                        </div>
                      </div>

                      {/* Variable hints */}
                      <div className="bg-secondary/40 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground font-semibold mb-2">Available Variables:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(VARIABLE_HINTS[config.event_category] ?? VARIABLE_HINTS.general).map((v) => (
                            <code key={v} className="text-xs bg-card border border-border rounded px-2 py-0.5 text-primary font-mono">{v}</code>
                          ))}
                        </div>
                      </div>

                      {/* ── Email Section ── */}
                      <div className="border border-border rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-widest">📧 Email</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Enabled</span>
                            <button
                              onClick={() => setEditForm((f) => ({ ...f, is_enabled: !f.is_enabled }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                editForm.is_enabled ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.is_enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Event Label</label>
                            <input
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={editForm.event_label ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, event_label: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Badge Text</label>
                            <input
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={editForm.email_badge ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, email_badge: e.target.value }))}
                              placeholder="e.g. Document Ready"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Email Subject Template</label>
                          <input
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={editForm.email_subject_template ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, email_subject_template: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Email Body Template</label>
                          <textarea
                            rows={7}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-y"
                            value={editForm.email_body_template ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, email_body_template: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">CTA Button Label</label>
                            <input
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={editForm.email_cta_label ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, email_cta_label: e.target.value }))}
                              placeholder="e.g. View Document"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">CTA URL Template</label>
                            <input
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={editForm.email_cta_url_template ?? ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, email_cta_url_template: e.target.value }))}
                              placeholder="{{siteUrl}}/portal/documents"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── SMS Section ── */}
                      <div className="border border-blue-200 rounded-xl p-4 space-y-4 bg-blue-50/30">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">📱 SMS (Twilio)</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Enabled</span>
                            <button
                              onClick={() => setEditForm((f) => ({ ...f, sms_enabled: !f.sms_enabled }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                editForm.sms_enabled ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.sms_enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">SMS Body Template</label>
                          <textarea
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono resize-y"
                            value={editForm.sms_body_template ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, sms_body_template: e.target.value }))}
                            placeholder="Broussard Legal Services: Hi {{clientName}}, ..."
                          />
                          <p className="text-xs text-muted-foreground mt-1">Keep under 160 chars for a single SMS segment. Include &quot;Reply STOP to opt out.&quot;</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[config.event_category] ?? CATEGORY_COLORS.general}`}>
                                {CATEGORY_LABELS[config.event_category] ?? config.event_category}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono bg-secondary/40 px-2 py-0.5 rounded">{config.event_key}</span>
                            </div>
                            <h3 className="font-semibold text-foreground text-sm">{config.event_label}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                              Subject: <span className="text-foreground">{config.email_subject_template}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Email Toggle */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground hidden sm:inline">Email</span>
                            <button
                              onClick={() => toggleEnabled(config, 'is_enabled')}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                config.is_enabled ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                              title={config.is_enabled ? 'Disable email' : 'Enable email'}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>
                          {/* SMS Toggle */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground hidden sm:inline">SMS</span>
                            <button
                              onClick={() => toggleEnabled(config, 'sms_enabled')}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                config.sms_enabled ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                              title={config.sms_enabled ? 'Disable SMS' : 'Enable SMS'}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.sms_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-xs font-semibold ${config.is_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {config.is_enabled ? '✉️ On' : '✉️ Off'}
                            </span>
                            <span className={`text-xs font-semibold ${config.sms_enabled ? 'text-blue-600' : 'text-muted-foreground'}`}>
                              {config.sms_enabled ? '📱 On' : '📱 Off'}
                            </span>
                          </div>
                          <button
                            onClick={() => startEdit(config)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Preview of body */}
                      <div className="mt-3 bg-secondary/20 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
                          {config.email_body_template.split('\n').filter(Boolean)[0]}
                        </p>
                      </div>

                      {/* SMS preview */}
                      {config.sms_body_template && (
                        <div className="mt-2 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                          <p className="text-xs text-blue-600 font-semibold mb-0.5">📱 SMS</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 font-mono">{config.sms_body_template}</p>
                        </div>
                      )}

                      {/* CTA info */}
                      {config.email_cta_label && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">CTA:</span>
                          <span className="text-xs font-semibold text-primary">{config.email_cta_label}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">{config.email_cta_url_template}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Logs View ── */}
      {activeView === 'logs' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-foreground">Notification Send Log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 100 event-triggered notifications (email + SMS)</p>
            </div>
            <button onClick={fetchLogs} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No notifications sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Event</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Subject</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Email</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">SMS</th>
                    <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-mono bg-secondary/40 px-2 py-0.5 rounded text-muted-foreground">{log.event_key}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-foreground text-xs">{log.client_name}</p>
                        <p className="text-xs text-muted-foreground">{log.client_email}</p>
                        {log.client_phone && (
                          <p className="text-xs text-blue-500">{log.client_phone}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5 hidden md:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{log.subject}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {log.status}
                        </span>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{log.error_message}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {log.sms_status ? (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            log.sms_status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            log.sms_status === 'skipped'? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.sms_status}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 hidden sm:table-cell text-xs text-muted-foreground">
                        {new Date(log.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Test View ── */}
      {activeView === 'test' && (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-xl">
          <h3 className="font-serif text-lg text-foreground mb-1">Test Event Notification</h3>
          <p className="text-xs text-muted-foreground mb-5">Send a test email and/or SMS using any configured event template.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Event Key</label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={testForm.eventKey}
                onChange={(e) => setTestForm((f) => ({ ...f, eventKey: e.target.value }))}
              >
                <option value="">Select an event…</option>
                {configs.map((c) => (
                  <option key={c.event_key} value={c.event_key}>
                    {c.event_label} ({c.event_key})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Client Name</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Jane Smith"
                  value={testForm.clientName}
                  onChange={(e) => setTestForm((f) => ({ ...f, clientName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Client Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="jane@example.com"
                  value={testForm.clientEmail}
                  onChange={(e) => setTestForm((f) => ({ ...f, clientEmail: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                Client Phone <span className="text-muted-foreground font-normal normal-case">(optional — for SMS test)</span>
              </label>
              <input
                type="tel"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="+15551234567"
                value={testForm.clientPhone}
                onChange={(e) => setTestForm((f) => ({ ...f, clientPhone: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Include country code. SMS only sent if event has SMS enabled and phone is provided.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                Variables (JSON, optional)
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-none"
                placeholder={'{\n  "caseName": "Smith v. Jones",\n  "invoiceNumber": "INV-001",\n  "amount": "1,500.00"\n}'}
                value={testForm.variables}
                onChange={(e) => setTestForm((f) => ({ ...f, variables: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Provide values for template variables like caseName, invoiceNumber, etc.</p>
            </div>

            {testResult && (
              <div className={`rounded-xl p-4 text-sm font-medium space-y-1 ${
                testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : testResult.skipped ?'bg-amber-50 text-amber-700 border border-amber-200': 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testResult.success && (
                  <>
                    <p>✅ Notification sent!</p>
                    {testResult.emailStatus && (
                      <p className="text-xs font-normal">✉️ Email: <span className="font-semibold">{testResult.emailStatus}</span></p>
                    )}
                    {testResult.smsStatus && (
                      <p className="text-xs font-normal">📱 SMS: <span className="font-semibold">{testResult.smsStatus}</span></p>
                    )}
                  </>
                )}
                {testResult.skipped && '⚠️ Event is disabled — notification was skipped.'}
                {testResult.error && `❌ Error: ${testResult.error}`}
              </div>
            )}

            <button
              onClick={sendTestNotification}
              disabled={testSending || !testForm.eventKey || !testForm.clientEmail || !testForm.clientName}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {testSending ? 'Sending…' : '🚀 Send Test Notification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
