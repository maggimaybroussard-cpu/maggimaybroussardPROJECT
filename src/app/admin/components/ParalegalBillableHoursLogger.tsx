'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
}

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  status: string;
}

interface BillableHourEntry {
  id: string;
  inquiry_id: string | null;
  retainer_subscription_id: string | null;
  paralegal_name: string;
  paralegal_email: string | null;
  task_description: string;
  task_type: string;
  duration_hours: number;
  hourly_rate: number;
  total_amount: number;
  work_date: string;
  billing_status: string;
  notes: string | null;
  created_at: string;
  contact_inquiries?: { name: string; service: string } | null;
  retainer_subscriptions?: { customer_name: string; plan_name: string } | null;
}

interface LogForm {
  paralegal_name: string;
  paralegal_email: string;
  inquiry_id: string;
  retainer_subscription_id: string;
  task_description: string;
  task_type: string;
  duration_hours: string;
  hourly_rate: string;
  work_date: string;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPES = [
  { value: 'research', label: 'Legal Research', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'drafting', label: 'Drafting', icon: '✍️', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'review', label: 'Document Review', icon: '📋', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'calls', label: 'Client Calls', icon: '📞', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'discovery', label: 'Discovery', icon: '🗂️', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'deposition', label: 'Deposition Prep', icon: '🎙️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const BILLING_STATUS_COLORS: Record<string, string> = {
  unbilled: 'bg-amber-50 text-amber-700 border-amber-200',
  draft_queued: 'bg-blue-50 text-blue-700 border-blue-200',
  invoiced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const BILLING_STATUS_LABELS: Record<string, string> = {
  unbilled: 'Unbilled',
  draft_queued: 'Draft Queued',
  invoiced: 'Invoiced',
  approved: 'Approved',
  rejected: 'Rejected',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function taskTypeMeta(t: string) {
  return TASK_TYPES.find(tt => tt.value === t) ?? TASK_TYPES[TASK_TYPES.length - 1];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParalegalBillableHoursLogger() {
  const supabase = createClient();

  // Data
  const [cases, setCases] = useState<CaseInquiry[]>([]);
  const [retainers, setRetainers] = useState<RetainerSubscription[]>([]);
  const [entries, setEntries] = useState<BillableHourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterParalegal, setFilterParalegal] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LogForm>({
    paralegal_name: '',
    paralegal_email: '',
    inquiry_id: '',
    retainer_subscription_id: '',
    task_description: '',
    task_type: 'research',
    duration_hours: '',
    hourly_rate: '125.00',
    work_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [casesRes, retainersRes, entriesRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, status')
          .eq('status', 'active')
          .order('customer_name'),
        supabase
          .from('paralegal_billable_hours')
          .select('*, contact_inquiries(name, service), retainer_subscriptions(customer_name, plan_name)')
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (casesRes.data) setCases(casesRes.data);
      if (retainersRes.data) setRetainers(retainersRes.data);
      if (entriesRes.data) setEntries(entriesRes.data as BillableHourEntry[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Submit new entry ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.paralegal_name.trim()) { setError('Paralegal name is required'); return; }
    if (!form.task_description.trim()) { setError('Task description is required'); return; }
    const hours = parseFloat(form.duration_hours);
    if (!hours || hours <= 0) { setError('Duration must be greater than 0'); return; }
    const rate = parseFloat(form.hourly_rate);
    if (!rate || rate < 0) { setError('Hourly rate must be 0 or greater'); return; }
    if (!form.inquiry_id && !form.retainer_subscription_id) {
      setError('Please select a case or client to bill against');
      return;
    }

    setSaving(true);
    try {
      const { data: newEntry, error: insertErr } = await supabase
        .from('paralegal_billable_hours')
        .insert({
          paralegal_name: form.paralegal_name.trim(),
          paralegal_email: form.paralegal_email.trim() || null,
          inquiry_id: form.inquiry_id || null,
          retainer_subscription_id: form.retainer_subscription_id || null,
          task_description: form.task_description.trim(),
          task_type: form.task_type,
          duration_hours: hours,
          hourly_rate: rate,
          work_date: form.work_date,
          notes: form.notes.trim() || null,
          billing_status: 'unbilled',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Auto-queue Lexi invoice draft
      if (newEntry) {
        await queueLexiDraft(newEntry as BillableHourEntry, false);
      }

      setSuccessMsg('Hours logged and invoice draft queued for admin approval');
      setShowForm(false);
      setForm(prev => ({
        ...prev,
        task_description: '',
        duration_hours: '',
        notes: '',
        inquiry_id: '',
        retainer_subscription_id: '',
      }));
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  // ── Queue Lexi invoice draft ───────────────────────────────────────────────
  const queueLexiDraft = async (entry: BillableHourEntry, standalone: boolean) => {
    if (standalone) setQueueingId(entry.id);
    try {
      const clientName = entry.contact_inquiries?.name
        ?? entry.retainer_subscriptions?.customer_name
        ?? 'Unknown Client';

      const retainer = retainers.find(r => r.id === entry.retainer_subscription_id);
      const clientEmail = retainer?.customer_email ?? '';

      const lineItem = {
        description: entry.task_description,
        hours: entry.duration_hours,
        rate: entry.hourly_rate,
        total: entry.total_amount,
        work_type: entry.task_type,
        work_date: entry.work_date,
        paralegal: entry.paralegal_name,
      };

      const { data: draft, error: draftErr } = await supabase
        .from('lexi_invoice_drafts')
        .insert({
          retainer_subscription_id: entry.retainer_subscription_id || null,
          inquiry_id: entry.inquiry_id || null,
          client_name: clientName,
          client_email: clientEmail,
          total_hours: entry.duration_hours,
          hourly_rate: entry.hourly_rate,
          subtotal: entry.total_amount,
          line_items: [lineItem],
          notes: `Auto-drafted by Lexi from paralegal hours logged by ${entry.paralegal_name} on ${fmtDate(entry.work_date)}`,
          draft_status: 'pending_approval',
        })
        .select('id')
        .single();

      if (draftErr) throw draftErr;

      // Update entry status
      await supabase
        .from('paralegal_billable_hours')
        .update({ billing_status: 'draft_queued', invoice_draft_id: draft?.id })
        .eq('id', entry.id);

      if (standalone) {
        setSuccessMsg('Invoice draft queued for admin approval');
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: unknown) {
      if (standalone) setError(err instanceof Error ? err.message : 'Failed to queue draft');
    } finally {
      if (standalone) setQueueingId(null);
    }
  };

  // ── Delete entry ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this time entry?')) return;
    setDeletingId(id);
    try {
      const { error: delErr } = await supabase.from('paralegal_billable_hours').delete().eq('id', id);
      if (delErr) throw delErr;
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtered entries ───────────────────────────────────────────────────────
  const filteredEntries = entries.filter(e => {
    if (filterStatus !== 'all' && e.billing_status !== filterStatus) return false;
    if (filterParalegal && !e.paralegal_name.toLowerCase().includes(filterParalegal.toLowerCase())) return false;
    if (dateFrom && e.work_date < dateFrom) return false;
    if (dateTo && e.work_date > dateTo) return false;
    return true;
  });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalHours = filteredEntries.reduce((s, e) => s + Number(e.duration_hours), 0);
  const totalAmount = filteredEntries.reduce((s, e) => s + Number(e.total_amount), 0);
  const unbilledAmount = filteredEntries
    .filter(e => e.billing_status === 'unbilled')
    .reduce((s, e) => s + Number(e.total_amount), 0);
  const queuedCount = filteredEntries.filter(e => e.billing_status === 'draft_queued').length;

  // ── Unique paralegals for filter ───────────────────────────────────────────
  const uniqueParalegals = Array.from(new Set(entries.map(e => e.paralegal_name))).sort();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-foreground">Paralegal Billable Hours</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log hours against cases — Lexi auto-drafts invoices for admin approval
          </p>
        </div>
        <button
          onClick={() => setShowForm(prev => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
          style={{ background: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log Hours
        </button>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}

      {/* ── Log Hours Form ── */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
            <span className="text-lg">⏱️</span> New Billable Hours Entry
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Paralegal info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Paralegal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.paralegal_name}
                  onChange={e => setForm(prev => ({ ...prev, paralegal_name: e.target.value }))}
                  placeholder="e.g. Sarah Mitchell"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Paralegal Email
                </label>
                <input
                  type="email"
                  value={form.paralegal_email}
                  onChange={e => setForm(prev => ({ ...prev, paralegal_email: e.target.value }))}
                  placeholder="paralegal@firm.com"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
            </div>

            {/* Case / Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Case / Matter
                </label>
                <select
                  value={form.inquiry_id}
                  onChange={e => setForm(prev => ({ ...prev, inquiry_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                >
                  <option value="">Select case…</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Retainer Client
                </label>
                <select
                  value={form.retainer_subscription_id}
                  onChange={e => setForm(prev => ({ ...prev, retainer_subscription_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                >
                  <option value="">Select retainer client…</option>
                  {retainers.map(r => (
                    <option key={r.id} value={r.id}>{r.customer_name} — {r.plan_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">Select at least one: case or retainer client</p>

            {/* Task description */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Task Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.task_description}
                onChange={e => setForm(prev => ({ ...prev, task_description: e.target.value }))}
                placeholder="e.g. Reviewed and summarized 45 pages of discovery documents; prepared memo for attorney review…"
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
            </div>

            {/* Task type */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Task Type
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {TASK_TYPES.map(tt => (
                  <button
                    key={tt.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, task_type: tt.value }))}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
                      form.task_type === tt.value
                        ? `${tt.color} ring-1 ring-current/30`
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="text-base leading-none">{tt.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{tt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration, rate, date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Duration (hours) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.25"
                  value={form.duration_hours}
                  onChange={e => setForm(prev => ({ ...prev, duration_hours: e.target.value }))}
                  placeholder="e.g. 2.5"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Hourly Rate ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={form.hourly_rate}
                  onChange={e => setForm(prev => ({ ...prev, hourly_rate: e.target.value }))}
                  placeholder="125.00"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Work Date
                </label>
                <input
                  type="date"
                  value={form.work_date}
                  onChange={e => setForm(prev => ({ ...prev, work_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
            </div>

            {/* Total preview */}
            {form.duration_hours && form.hourly_rate && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/15 rounded-xl">
                <span className="text-sm text-muted-foreground">Total billable:</span>
                <span className="text-lg font-bold text-primary">
                  {fmt(parseFloat(form.duration_hours || '0') * parseFloat(form.hourly_rate || '0'))}
                </span>
                <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                  <span className="text-base">🤖</span>
                  Lexi will auto-draft invoice for admin approval
                </span>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Internal Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional context for the billing admin…"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#355E3B' }}
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Log Hours &amp; Queue Draft</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Hours', value: `${totalHours.toFixed(2)}h`, sub: `${filteredEntries.length} entries`, icon: '⏱️' },
          { label: 'Total Billed', value: fmt(totalAmount), sub: 'in selected range', icon: '💰' },
          { label: 'Unbilled Amount', value: fmt(unbilledAmount), sub: 'pending queue', icon: '⚠️' },
          { label: 'Drafts Queued', value: queuedCount.toString(), sub: 'awaiting admin approval', icon: '🤖' },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{card.icon}</span>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All</option>
              {Object.entries(BILLING_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Paralegal</label>
            <select
              value={filterParalegal}
              onChange={e => setFilterParalegal(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All</option>
              {uniqueParalegals.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {(filterStatus !== 'all' || filterParalegal || dateFrom || dateTo) && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterParalegal(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Entries Table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">
            Time Entries
            <span className="ml-2 text-xs font-normal text-muted-foreground">({filteredEntries.length})</span>
          </h3>
          {filteredEntries.some(e => e.billing_status === 'unbilled') && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {filteredEntries.filter(e => e.billing_status === 'unbilled').length} unbilled
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading entries…</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">⏱️</p>
            <p className="text-sm font-medium text-foreground mb-1">No entries found</p>
            <p className="text-xs text-muted-foreground">
              {entries.length === 0 ? 'Log your first billable hours using the button above.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Paralegal</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Case / Client</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Task</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Hours</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Rate</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Total</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEntries.map(entry => {
                    const tt = taskTypeMeta(entry.task_type);
                    const clientName = entry.contact_inquiries?.name
                      ?? entry.retainer_subscriptions?.customer_name
                      ?? '—';
                    const clientSub = entry.contact_inquiries?.service
                      ?? entry.retainer_subscriptions?.plan_name
                      ?? '';
                    return (
                      <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(entry.work_date)}</td>
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-semibold text-foreground">{entry.paralegal_name}</p>
                          {entry.paralegal_email && <p className="text-[10px] text-muted-foreground">{entry.paralegal_email}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">{clientName}</p>
                          {clientSub && <p className="text-[10px] text-muted-foreground">{clientSub}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-start gap-2">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${tt.color}`}>
                              {tt.icon} {tt.label}
                            </span>
                            <p className="text-xs text-foreground line-clamp-2 max-w-[200px]">{entry.task_description}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-sm font-bold text-foreground">{Number(entry.duration_hours).toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground ml-0.5">h</span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmt(entry.hourly_rate)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-sm font-bold text-foreground">{fmt(entry.total_amount)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center text-[10px] px-2 py-1 rounded-full border font-medium ${BILLING_STATUS_COLORS[entry.billing_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {BILLING_STATUS_LABELS[entry.billing_status] ?? entry.billing_status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {entry.billing_status === 'unbilled' && (
                              <button
                                onClick={() => queueLexiDraft(entry, true)}
                                disabled={queueingId === entry.id}
                                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-secondary disabled:opacity-50"
                                style={{ borderColor: '#355E3B', color: '#355E3B' }}
                              >
                                {queueingId === entry.id ? '…' : '🤖 Queue Draft'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 disabled:opacity-50"
                            >
                              {deletingId === entry.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/30">
                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Total ({filteredEntries.length} entries)
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-foreground">{totalHours.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground ml-0.5">h</span>
                    </td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-foreground">{fmt(totalAmount)}</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {filteredEntries.map(entry => {
                const tt = taskTypeMeta(entry.task_type);
                const clientName = entry.contact_inquiries?.name
                  ?? entry.retainer_subscriptions?.customer_name
                  ?? '—';
                return (
                  <div key={entry.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{entry.paralegal_name}</p>
                        <p className="text-[10px] text-muted-foreground">{clientName} · {fmtDate(entry.work_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-foreground">{fmt(entry.total_amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{Number(entry.duration_hours).toFixed(2)}h @ {fmt(entry.hourly_rate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tt.color}`}>
                        {tt.icon} {tt.label}
                      </span>
                      <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${BILLING_STATUS_COLORS[entry.billing_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {BILLING_STATUS_LABELS[entry.billing_status] ?? entry.billing_status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{entry.task_description}</p>
                    <div className="flex items-center gap-2">
                      {entry.billing_status === 'unbilled' && (
                        <button
                          onClick={() => queueLexiDraft(entry, true)}
                          disabled={queueingId === entry.id}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-secondary disabled:opacity-50"
                          style={{ borderColor: '#355E3B', color: '#355E3B' }}
                        >
                          {queueingId === entry.id ? '…' : '🤖 Queue Draft'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 ml-auto disabled:opacity-50"
                      >
                        {deletingId === entry.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Lexi auto-draft info banner ── */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
        <span className="text-xl shrink-0">🤖</span>
        <div>
          <p className="text-sm font-semibold text-foreground">Lexi Auto-Draft Invoices</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When hours are logged, Lexi automatically creates an invoice draft in the{' '}
            <strong>Admin → Lexi Tools → Invoice Drafts</strong> queue. Admins can review, edit, approve, or reject each draft before it becomes a final invoice.
          </p>
        </div>
      </div>
    </div>
  );
}
