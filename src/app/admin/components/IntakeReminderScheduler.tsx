'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReminderSchedule {
  id: string;
  booking_id: string | null;
  client_name: string;
  client_email: string;
  case_type: string | null;
  reminder_type: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  interval_hours: number;
  max_reminders: number;
  reminder_count: number;
  notes: string | null;
  created_at: string;
}

interface AutoMatter {
  id: string;
  booking_id: string | null;
  matter_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  case_type: string;
  practice_area: string | null;
  retainer_amount: number | null;
  retainer_paid: boolean;
  matter_status: string;
  first_time_log_date: string;
  first_time_log_hours: number;
  first_time_log_desc: string;
  first_time_log_rate: number | null;
  auto_generated: boolean;
  generated_at: string;
  notes: string | null;
}

interface NewReminderForm {
  booking_id: string;
  client_name: string;
  client_email: string;
  case_type: string;
  scheduled_at: string;
  interval_hours: number;
  max_reminders: number;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  sent: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-gray-50 text-gray-500 border border-gray-200',
  failed: 'bg-red-50 text-red-600 border border-red-200',
};

const MATTER_STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  closed: 'bg-gray-50 text-gray-500 border border-gray-200',
  on_hold: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const CASE_TYPES = [
  'Civil Litigation Support',
  'Family Law',
  'Estate Planning',
  'Real Estate',
  'Business Formation',
  'Contract Review',
  'Immigration',
  'Criminal Defense Support',
  'Personal Injury',
  'Employment Law',
  'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });
}

function isPast(iso: string): boolean {
  return new Date(iso) < new Date();
}

// ─── New Reminder Form ────────────────────────────────────────────────────────

function NewReminderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewReminderForm>({
    booking_id: '',
    client_name: '',
    client_email: '',
    case_type: '',
    scheduled_at: '',
    interval_hours: 24,
    max_reminders: 3,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name || !form.client_email || !form.scheduled_at) {
      setError('Client name, email, and scheduled time are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('intake_reminder_schedules').insert({
        booking_id: form.booking_id || null,
        client_name: form.client_name,
        client_email: form.client_email,
        case_type: form.case_type || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        interval_hours: form.interval_hours,
        max_reminders: form.max_reminders,
        notes: form.notes || null,
        status: 'pending',
        reminder_count: 0,
      });
      if (err) throw err;
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Intake Reminder</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Email *</label>
              <input
                type="email"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Case Type</label>
            <select
              value={form.case_type}
              onChange={(e) => setForm({ ...form, case_type: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select case type…</option>
              {CASE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">First Reminder Date & Time *</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Repeat Every (hours)</label>
              <select
                value={form.interval_hours}
                onChange={(e) => setForm({ ...form, interval_hours: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Reminders</label>
              <select
                value={form.max_reminders}
                onChange={(e) => setForm({ ...form, max_reminders: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Optional notes…"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? 'Scheduling…' : 'Schedule Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Matter Detail Panel ──────────────────────────────────────────────────────

function MatterDetailPanel({
  matter,
  onClose,
  onUpdate,
}: {
  matter: AutoMatter;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [status, setStatus] = useState(matter.matter_status);
  const [retainerPaid, setRetainerPaid] = useState(matter.retainer_paid);
  const [notes, setNotes] = useState(matter.notes || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('auto_generated_matters')
        .update({
          matter_status: status,
          retainer_paid: retainerPaid,
          retainer_paid_at: retainerPaid && !matter.retainer_paid ? new Date().toISOString() : matter.retainer_paid ? new Date().toISOString() : null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matter.id);
      if (error) throw error;
      setMsg({ type: 'success', text: 'Matter updated.' });
      onUpdate();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{matter.matter_name}</h2>
            <p className="text-sm text-gray-500">{matter.client_email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-5 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Matter Details</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium text-gray-800">{matter.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Case Type</span>
                <span className="font-medium text-gray-800">{matter.case_type}</span>
              </div>
              {matter.practice_area && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Practice Area</span>
                  <span className="font-medium text-gray-800">{matter.practice_area}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Generated</span>
                <span className="font-medium text-gray-800">{formatDate(matter.generated_at)}</span>
              </div>
              {matter.auto_generated && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Auto-generated</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Retainer</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-600">Amount</span>
                <span className="text-lg font-bold text-gray-900">
                  {matter.retainer_amount ? `$${matter.retainer_amount.toLocaleString()}` : '—'}
                </span>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retainerPaid}
                  onChange={(e) => setRetainerPaid(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600"
                />
                <span className="text-sm text-gray-700">Retainer received / paid</span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">First Time Log Entry</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-800">{formatDate(matter.first_time_log_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hours</span>
                <span className="font-medium text-gray-800">{matter.first_time_log_hours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rate</span>
                <span className="font-medium text-gray-800">
                  {matter.first_time_log_rate ? `$${matter.first_time_log_rate}/hr` : '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Description</span>
                <span className="text-gray-800">{matter.first_time_log_desc}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Matter Status</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="open">Open</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Matter notes…"
            />
          </section>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          {msg && (
            <p className={`text-xs mb-2 ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {msg.text}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntakeReminderScheduler() {
  const [activeTab, setActiveTab] = useState<'reminders' | 'matters'>('reminders');
  const [reminders, setReminders] = useState<ReminderSchedule[]>([]);
  const [matters, setMatters] = useState<AutoMatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<AutoMatter | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [remindersRes, mattersRes] = await Promise.all([
        supabase
          .from('intake_reminder_schedules')
          .select('*')
          .order('scheduled_at', { ascending: false })
          .limit(100),
        supabase
          .from('auto_generated_matters')
          .select('*')
          .order('generated_at', { ascending: false })
          .limit(100),
      ]);
      setReminders((remindersRes.data as ReminderSchedule[]) ?? []);
      setMatters((mattersRes.data as AutoMatter[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendNow = async (reminder: ReminderSchedule) => {
    setSendingId(reminder.id);
    setMsg(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-intake-reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({
            schedule_id: reminder.id,
            booking_id: reminder.booking_id,
            client_name: reminder.client_name,
            client_email: reminder.client_email,
            case_type: reminder.case_type,
            reminder_count: reminder.reminder_count,
          }),
        }
      );
      const result = await res.json();
      if (result.success) {
        setMsg(`✓ Reminder sent to ${reminder.client_email}`);
        fetchData();
      } else {
        setMsg(`✗ Failed: ${result.error || result.message}`);
      }
    } catch (err) {
      setMsg(`✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSendingId(null);
    }
  };

  const handleCancelReminder = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from('intake_reminder_schedules')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchData();
  };

  const pendingReminders = reminders.filter((r) => r.status === 'pending');
  const sentReminders = reminders.filter((r) => r.status === 'sent');
  const openMatters = matters.filter((m) => m.matter_status === 'open' || m.matter_status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Intake Reminders & Auto-Matters</h2>
          <p className="text-sm text-gray-500 mt-0.5">Schedule intake reminder emails and manage auto-generated matters</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Reminder
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Reminders', value: pendingReminders.length, color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏰' },
          { label: 'Reminders Sent', value: sentReminders.length, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✉️' },
          { label: 'Auto-Matters', value: matters.length, color: 'text-blue-700', bg: 'bg-blue-50', icon: '📁' },
          { label: 'Open Matters', value: openMatters.length, color: 'text-purple-700', bg: 'bg-purple-50', icon: '⚖️' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex flex-col gap-1`}>
            <span className="text-xl">{s.icon}</span>
            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-gray-500 leading-tight">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['reminders', 'matters'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'reminders' ? `Reminder Schedules (${reminders.length})` : `Auto-Matters (${matters.length})`}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'reminders' ? (
        /* ── Reminders Table ── */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">⏰</span>
              <p className="text-gray-500 text-sm">No reminder schedules yet.</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="mt-4 px-4 py-2 bg-emerald-700 text-white text-sm rounded-xl hover:bg-emerald-800"
              >
                Schedule First Reminder
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Case Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scheduled</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reminders.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.client_name}</p>
                        <p className="text-xs text-gray-500">{r.client_email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.case_type || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${r.status === 'pending' && isPast(r.scheduled_at) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {formatDateTime(r.scheduled_at)}
                          {r.status === 'pending' && isPast(r.scheduled_at) && ' ⚠️'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-50 text-gray-500'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.reminder_count}/{r.max_reminders}
                        {r.sent_at && <span className="block text-gray-400">{formatDate(r.sent_at)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleSendNow(r)}
                                disabled={sendingId === r.id}
                                className="px-3 py-1 bg-emerald-700 text-white text-xs rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {sendingId === r.id ? '…' : 'Send Now'}
                              </button>
                              <button
                                onClick={() => handleCancelReminder(r.id)}
                                className="px-3 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {r.status === 'sent' && (
                            <span className="text-xs text-emerald-600">✓ Sent</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Auto-Matters Table ── */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {matters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">📁</span>
              <p className="text-gray-500 text-sm">No auto-generated matters yet.</p>
              <p className="text-xs text-gray-400 mt-1">Matters are created automatically when an intake is marked complete in the Leads Board.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matter</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Case Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Retainer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">First Log</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {matters.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{m.matter_name}</p>
                        <p className="text-xs text-gray-500">{m.client_email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{m.case_type}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {m.retainer_amount ? `$${m.retainer_amount.toLocaleString()}` : '—'}
                        </span>
                        {m.retainer_paid && (
                          <span className="block text-xs text-emerald-600">✓ Paid</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${MATTER_STATUS_COLORS[m.matter_status] ?? 'bg-gray-50 text-gray-500'}`}>
                          {m.matter_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {m.first_time_log_hours}h — {m.first_time_log_desc.slice(0, 30)}…
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(m.generated_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedMatter(m)}
                          className="px-3 py-1 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showNewModal && (
        <NewReminderModal
          onClose={() => setShowNewModal(false)}
          onCreated={fetchData}
        />
      )}

      {selectedMatter && (
        <MatterDetailPanel
          matter={selectedMatter}
          onClose={() => setSelectedMatter(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
