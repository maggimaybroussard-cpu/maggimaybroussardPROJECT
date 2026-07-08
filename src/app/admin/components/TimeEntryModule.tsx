'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseOption {
  id: string;
  name: string;
  email: string;
  service: string;
  retainer_subscription_id: string | null;
  retainer_plan: string | null;
  retainer_amount: number | null;
}

interface TimeEntry {
  id: string;
  inquiry_id: string | null;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
  work_type: string | null;
  task_category: string;
  hourly_rate: number | null;
  billable: boolean;
  invoice_id: string | null;
  billed_at: string | null;
  created_at: string;
  contact_inquiries?: { name: string; email: string; service: string } | null;
  retainer_subscriptions?: { customer_name: string; plan_name: string; amount: number } | null;
}

interface InvoiceDraft {
  id: string;
  client_name: string;
  client_email: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  hours_billed: number | null;
  hourly_rate: number | null;
  line_items: LineItem[];
  approval_status: string;
  notes: string | null;
  inquiry_id: string | null;
  retainer_subscription_id: string | null;
  created_at: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface EntryForm {
  inquiry_id: string;
  hours: string;
  work_type: string;
  task_category: string;
  description: string;
  work_date: string;
  logged_by: string;
  hourly_rate: string;
  billable: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_TYPES = [
  { value: 'research', label: 'Legal Research', icon: '🔍' },
  { value: 'drafting', label: 'Drafting', icon: '✍️' },
  { value: 'calls', label: 'Client Calls', icon: '📞' },
  { value: 'review', label: 'Document Review', icon: '📋' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️' },
  { value: 'discovery', label: 'Discovery', icon: '🗂️' },
  { value: 'negotiation', label: 'Negotiation', icon: '🤝' },
  { value: 'other', label: 'Other', icon: '📌' },
];

const TASK_CATEGORIES = [
  'Initial Case Review',
  'Legal Research',
  'Document Drafting',
  'Client Communication',
  'Court Filing Preparation',
  'Discovery Review',
  'Deposition Preparation',
  'Contract Review',
  'Settlement Negotiation',
  'Case Strategy Meeting',
  'Brief Writing',
  'Other',
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimeEntryModule() {
  const supabase = createClient();

  const [activeView, setActiveView] = useState<'log' | 'entries' | 'invoices'>('log');
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoiceDrafts, setInvoiceDrafts] = useState<InvoiceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rollingUp, setRollingUp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterCase, setFilterCase] = useState('all');
  const [filterBillable, setFilterBillable] = useState<'all' | 'billable' | 'non-billable'>('all');

  const [form, setForm] = useState<EntryForm>({
    inquiry_id: '',
    hours: '',
    work_type: 'research',
    task_category: 'Legal Research',
    description: '',
    work_date: today(),
    logged_by: 'Admin',
    hourly_rate: '250',
    billable: true,
  });

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load active retainer cases
      const { data: subs, error: subErr } = await supabase
        .from('retainer_subscriptions')
        .select('id, customer_name, customer_email, plan_name, amount, inquiry_id, status')
        .in('status', ['active', 'trialing'])
        .order('customer_name');

      if (subErr) throw subErr;

      // Build case options from retainer subscriptions
      const caseOptions: CaseOption[] = (subs ?? []).map(s => ({
        id: s.inquiry_id ?? s.id,
        name: s.customer_name,
        email: s.customer_email,
        service: s.plan_name,
        retainer_subscription_id: s.id,
        retainer_plan: s.plan_name,
        retainer_amount: s.amount,
      }));

      // Also load contact_inquiries for cases without retainer subs
      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .in('status', ['active', 'in_progress', 'retainer', 'engaged'])
        .order('name');

      const inquiryIds = new Set(caseOptions.map(c => c.id));
      (inquiries ?? []).forEach(inq => {
        if (!inquiryIds.has(inq.id)) {
          caseOptions.push({
            id: inq.id,
            name: inq.name,
            email: inq.email,
            service: inq.service,
            retainer_subscription_id: null,
            retainer_plan: null,
            retainer_amount: null,
          });
        }
      });

      setCases(caseOptions);

      // Load time entries
      const { data: logs, error: logErr } = await supabase
        .from('retainer_time_logs')
        .select(`
          id, inquiry_id, retainer_subscription_id, hours, description,
          work_date, logged_by, work_type, task_category, hourly_rate,
          billable, invoice_id, billed_at, created_at,
          contact_inquiries(name, email, service),
          retainer_subscriptions(customer_name, plan_name, amount)
        `)
        .order('work_date', { ascending: false })
        .limit(200);

      if (logErr) throw logErr;
      setEntries((logs ?? []) as TimeEntry[]);

      // Load retainer invoice drafts
      const { data: drafts, error: draftErr } = await supabase
        .from('retainer_invoice_drafts')
        .select('id, client_name, client_email, invoice_number, invoice_date, due_date, amount, hours_billed, hourly_rate, line_items, approval_status, notes, inquiry_id, retainer_subscription_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (draftErr) throw draftErr;
      setInvoiceDrafts((drafts ?? []) as InvoiceDraft[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Log time entry ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inquiry_id) { setError('Please select a case'); return; }
    if (!form.hours || isNaN(parseFloat(form.hours)) || parseFloat(form.hours) <= 0) {
      setError('Please enter valid hours'); return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const selectedCase = cases.find(c => c.id === form.inquiry_id);
      if (!selectedCase?.retainer_subscription_id) {
        throw new Error('Selected case has no active retainer subscription. Please link a retainer first.');
      }

      const { error: insertErr } = await supabase
        .from('retainer_time_logs')
        .insert({
          retainer_subscription_id: selectedCase.retainer_subscription_id,
          inquiry_id: form.inquiry_id,
          hours: parseFloat(form.hours),
          work_type: form.work_type,
          task_category: form.task_category,
          description: form.description || null,
          work_date: form.work_date,
          logged_by: form.logged_by,
          hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
          billable: form.billable,
        });

      if (insertErr) throw insertErr;

      setSuccess(`✅ Logged ${form.hours}h for ${selectedCase.name}`);
      setForm(prev => ({ ...prev, hours: '', description: '', work_date: today() }));
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log time entry');
    } finally {
      setSaving(false);
    }
  };

  // ── Roll up to retainer invoice ────────────────────────────────────────────

  const rollUpToInvoice = async (inquiryId: string) => {
    setRollingUp(inquiryId);
    setError(null);
    setSuccess(null);

    try {
      const selectedCase = cases.find(c => c.id === inquiryId);
      if (!selectedCase) throw new Error('Case not found');

      // Get unbilled billable entries for this case
      const unbilled = entries.filter(
        e => e.inquiry_id === inquiryId && e.billable && !e.billed_at && !e.invoice_id
      );

      if (unbilled.length === 0) {
        setError('No unbilled billable hours found for this case');
        return;
      }

      const totalHours = unbilled.reduce((sum, e) => sum + e.hours, 0);
      const hourlyRate = unbilled[0]?.hourly_rate ?? 250;
      const totalAmount = totalHours * hourlyRate;

      const lineItems: LineItem[] = unbilled.map(e => ({
        description: `${e.work_type ? WORK_TYPES.find(w => w.value === e.work_type)?.label ?? e.work_type : 'Legal Work'} — ${e.description ?? e.task_category}`,
        quantity: e.hours,
        unit_price: e.hourly_rate ?? hourlyRate,
        total: e.hours * (e.hourly_rate ?? hourlyRate),
      }));

      const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { error: draftErr } = await supabase
        .from('retainer_invoice_drafts')
        .insert({
          retainer_subscription_id: selectedCase.retainer_subscription_id,
          inquiry_id: inquiryId,
          client_name: selectedCase.name,
          client_email: selectedCase.email,
          invoice_number: invoiceNum,
          invoice_date: today(),
          due_date: dueDate.toISOString().split('T')[0],
          amount: totalAmount,
          billing_type: 'hourly',
          hours_billed: totalHours,
          hourly_rate: hourlyRate,
          line_items: lineItems,
          notes: `Auto-generated from ${unbilled.length} time entries`,
          approval_status: 'pending_approval',
        });

      if (draftErr) throw draftErr;

      // Mark entries as billed
      const entryIds = unbilled.map(e => e.id);
      await supabase
        .from('retainer_time_logs')
        .update({ billed_at: new Date().toISOString() })
        .in('id', entryIds);

      setSuccess(`✅ Invoice ${invoiceNum} created for ${selectedCase.name} — ${totalHours.toFixed(1)}h / ${fmt(totalAmount)}`);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setRollingUp(null);
    }
  };

  // ── Filtered entries ───────────────────────────────────────────────────────

  const filteredEntries = entries.filter(e => {
    if (filterCase !== 'all' && e.inquiry_id !== filterCase) return false;
    if (filterBillable === 'billable' && !e.billable) return false;
    if (filterBillable === 'non-billable' && e.billable) return false;
    return true;
  });

  // ── Case summary for rollup ────────────────────────────────────────────────

  const caseSummaries = cases.map(c => {
    const caseEntries = entries.filter(e => e.inquiry_id === c.id);
    const billableEntries = caseEntries.filter(e => e.billable);
    const unbilledEntries = billableEntries.filter(e => !e.billed_at && !e.invoice_id);
    const totalHours = caseEntries.reduce((s, e) => s + e.hours, 0);
    const billableHours = billableEntries.reduce((s, e) => s + e.hours, 0);
    const unbilledHours = unbilledEntries.reduce((s, e) => s + e.hours, 0);
    const avgRate = billableEntries.length > 0
      ? billableEntries.reduce((s, e) => s + (e.hourly_rate ?? 250), 0) / billableEntries.length
      : 250;
    const unbilledAmount = unbilledHours * avgRate;
    return { ...c, totalHours, billableHours, unbilledHours, unbilledAmount, entryCount: caseEntries.length };
  }).filter(c => c.entryCount > 0 || c.retainer_subscription_id);

  const totalBillableHours = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
  const totalUnbilledHours = entries.filter(e => e.billable && !e.billed_at && !e.invoice_id).reduce((s, e) => s + e.hours, 0);
  const totalUnbilledAmount = entries
    .filter(e => e.billable && !e.billed_at && !e.invoice_id)
    .reduce((s, e) => s + e.hours * (e.hourly_rate ?? 250), 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
        <span className="ml-3 text-slate-500 text-sm">Loading time entries…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Time Entry Module</h2>
          <p className="text-sm text-slate-500 mt-0.5">Log billable hours per case — auto-roll up into retainer invoices</p>
        </div>
        <div className="flex gap-2">
          {(['log', 'entries', 'invoices'] as const).map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === v
                  ? 'bg-slate-800 text-white' :'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v === 'log' ? '⏱ Log Time' : v === 'entries' ? '📋 Entries' : '🧾 Invoices'}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: entries.length.toString(), icon: '📝', color: 'bg-slate-50 border-slate-200' },
          { label: 'Billable Hours', value: `${totalBillableHours.toFixed(1)}h`, icon: '⏱', color: 'bg-blue-50 border-blue-200' },
          { label: 'Unbilled Hours', value: `${totalUnbilledHours.toFixed(1)}h`, icon: '🔔', color: 'bg-amber-50 border-amber-200' },
          { label: 'Unbilled Amount', value: fmt(totalUnbilledAmount), icon: '💰', color: 'bg-emerald-50 border-emerald-200' },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
            <div className="text-lg mb-1">{kpi.icon}</div>
            <div className="text-xl font-bold text-slate-800">{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ── LOG TIME VIEW ─────────────────────────────────────────────────── */}
      {activeView === 'log' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Log Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Log Billable Hours</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Case selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Case / Client *</label>
                <select
                  value={form.inquiry_id}
                  onChange={e => {
                    const c = cases.find(x => x.id === e.target.value);
                    setForm(prev => ({
                      ...prev,
                      inquiry_id: e.target.value,
                      hourly_rate: c?.retainer_amount
                        ? String(Math.round(c.retainer_amount / 10))
                        : '250',
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  required
                >
                  <option value="">— Select a case —</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.retainer_plan ? `(${c.retainer_plan})` : `— ${c.service}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hours + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hours *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={form.hours}
                    onChange={e => setForm(prev => ({ ...prev, hours: e.target.value }))}
                    placeholder="e.g. 1.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Work Date *</label>
                  <input
                    type="date"
                    value={form.work_date}
                    onChange={e => setForm(prev => ({ ...prev, work_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    required
                  />
                </div>
              </div>

              {/* Work type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Work Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {WORK_TYPES.map(wt => (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, work_type: wt.value }))}
                      className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-xs transition-colors ${
                        form.work_type === wt.value
                          ? 'bg-slate-800 text-white border-slate-800' :'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">{wt.icon}</span>
                      <span className="leading-tight text-center">{wt.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task category */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Task Category</label>
                <select
                  value={form.task_category}
                  onChange={e => setForm(prev => ({ ...prev, task_category: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {TASK_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of work performed…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>

              {/* Rate + Logged by + Billable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={form.hourly_rate}
                    onChange={e => setForm(prev => ({ ...prev, hourly_rate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Logged By</label>
                  <input
                    type="text"
                    value={form.logged_by}
                    onChange={e => setForm(prev => ({ ...prev, logged_by: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>

              {/* Billable toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, billable: !prev.billable }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.billable ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    form.billable ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm text-slate-600">
                  {form.billable ? '✅ Billable' : '⬜ Non-billable (write-off)'}
                </span>
              </div>

              {/* Preview */}
              {form.hours && form.hourly_rate && form.billable && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700">
                  <strong>{parseFloat(form.hours).toFixed(2)}h × {fmt(parseFloat(form.hourly_rate))} = {fmt(parseFloat(form.hours) * parseFloat(form.hourly_rate))}</strong>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : '⏱ Log Time Entry'}
              </button>
            </form>
          </div>

          {/* Case Rollup Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Retainer Invoice Rollup</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select a case to roll up all unbilled billable hours into a retainer invoice draft.
            </p>
            {caseSummaries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No active retainer cases found. Log time entries to see rollup options.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {caseSummaries.map(c => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.retainer_plan ?? c.service}</div>
                      </div>
                      {c.unbilledHours > 0 && (
                        <button
                          onClick={() => rollUpToInvoice(c.id)}
                          disabled={rollingUp === c.id}
                          className="flex-shrink-0 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {rollingUp === c.id ? 'Creating…' : '🧾 Create Invoice'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 rounded p-2 text-center">
                        <div className="font-semibold text-slate-700">{c.totalHours.toFixed(1)}h</div>
                        <div className="text-slate-400">Total</div>
                      </div>
                      <div className="bg-blue-50 rounded p-2 text-center">
                        <div className="font-semibold text-blue-700">{c.billableHours.toFixed(1)}h</div>
                        <div className="text-blue-400">Billable</div>
                      </div>
                      <div className={`rounded p-2 text-center ${c.unbilledHours > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        <div className={`font-semibold ${c.unbilledHours > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {c.unbilledHours > 0 ? fmt(c.unbilledAmount) : '✓ Billed'}
                        </div>
                        <div className={c.unbilledHours > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {c.unbilledHours > 0 ? `${c.unbilledHours.toFixed(1)}h unbilled` : 'All billed'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENTRIES VIEW ──────────────────────────────────────────────────── */}
      {activeView === 'entries' && (
        <div className="bg-white rounded-xl border border-slate-200">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
            <select
              value={filterCase}
              onChange={e => setFilterCase(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="all">All Cases</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterBillable}
              onChange={e => setFilterBillable(e.target.value as 'all' | 'billable' | 'non-billable')}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="all">All Types</option>
              <option value="billable">Billable Only</option>
              <option value="non-billable">Non-Billable Only</option>
            </select>
            <span className="text-xs text-slate-400 ml-auto">{filteredEntries.length} entries</span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              No time entries found. Use the Log Time tab to add entries.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Client / Case</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Work Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Hours</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEntries.map(entry => {
                    const wt = WORK_TYPES.find(w => w.value === entry.work_type);
                    const clientName = entry.contact_inquiries?.name
                      ?? entry.retainer_subscriptions?.customer_name
                      ?? 'Unknown';
                    const amount = entry.hours * (entry.hourly_rate ?? 250);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(entry.work_date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{clientName}</div>
                          <div className="text-xs text-slate-400">{entry.contact_inquiries?.service ?? entry.retainer_subscriptions?.plan_name ?? ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {wt?.icon} {wt?.label ?? entry.work_type ?? 'Other'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                          {entry.description ?? entry.task_category ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{entry.hours.toFixed(2)}h</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {entry.billable ? fmt(amount) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!entry.billable ? (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Write-off</span>
                          ) : entry.billed_at || entry.invoice_id ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Billed</span>
                          ) : (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Unbilled</span>
                          )}
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

      {/* ── INVOICES VIEW ─────────────────────────────────────────────────── */}
      {activeView === 'invoices' && (
        <div className="space-y-4">
          {invoiceDrafts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 text-center py-16 text-slate-400 text-sm">
              No retainer invoice drafts yet. Use the rollup feature to auto-generate invoices from time entries.
            </div>
          ) : (
            invoiceDrafts.map(draft => (
              <div key={draft.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">{draft.invoice_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        draft.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        draft.approval_status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        draft.approval_status === 'rejected'? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {draft.approval_status === 'pending_approval' ? 'Pending Approval' :
                         draft.approval_status.charAt(0).toUpperCase() + draft.approval_status.slice(1)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">{draft.client_name} — {draft.client_email}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Issued {fmtDate(draft.invoice_date)} · Due {fmtDate(draft.due_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">{fmt(draft.amount)}</div>
                    {draft.hours_billed && (
                      <div className="text-xs text-slate-500">{draft.hours_billed.toFixed(1)}h @ {fmt(draft.hourly_rate ?? 0)}/hr</div>
                    )}
                  </div>
                </div>

                {/* Line items */}
                {Array.isArray(draft.line_items) && draft.line_items.length > 0 && (
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">Description</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-medium">Qty (hrs)</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-medium">Rate</th>
                          <th className="text-right px-3 py-2 text-slate-500 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {draft.line_items.map((li, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-700">{li.description}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{li.quantity.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{fmt(li.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">{fmt(li.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-700">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">{fmt(draft.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {draft.notes && (
                  <p className="text-xs text-slate-400 mt-2 italic">{draft.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
