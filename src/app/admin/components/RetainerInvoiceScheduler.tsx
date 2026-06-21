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
  status: string;
  inquiry_id: string | null;
}

interface InvoiceSchedule {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  client_name: string;
  client_email: string;
  frequency: 'weekly' | 'monthly' | 'custom';
  custom_interval_days: number | null;
  billing_type: 'fixed' | 'hourly';
  fixed_amount: number | null;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
}

interface InvoiceDraft {
  id: string;
  schedule_id: string | null;
  retainer_subscription_id: string | null;
  inquiry_id: string | null;
  client_name: string;
  client_email: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  billing_type: string;
  hours_billed: number | null;
  hourly_rate: number | null;
  line_items: LineItem[];
  notes: string | null;
  approval_status: 'pending_approval' | 'approved' | 'rejected' | 'sent';
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  sent_at: string | null;
  client_invoice_id: string | null;
  created_at: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function nextRunDate(frequency: string, customDays: number | null): string {
  const now = new Date();
  if (frequency === 'weekly') now.setDate(now.getDate() + 7);
  else if (frequency === 'monthly') now.setMonth(now.getMonth() + 1);
  else if (frequency === 'custom' && customDays) now.setDate(now.getDate() + customDays);
  return now.toISOString();
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900) + 100;
  return `RET-${y}${m}${d}-${rand}`;
}

function dueDateFromNow(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const APPROVAL_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  pending_approval: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  approved: { label: 'Approved', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  sent: { label: 'Sent', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

function ApprovalBadge({ status }: { status: string }) {
  const cfg = APPROVAL_CFG[status] ?? APPROVAL_CFG.pending_approval;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Schedule Form ────────────────────────────────────────────────────────────

interface ScheduleFormProps {
  subscriptions: RetainerSubscription[];
  onSaved: () => void;
  onCancel: () => void;
  editing?: InvoiceSchedule | null;
}

function ScheduleForm({ subscriptions, onSaved, onCancel, editing }: ScheduleFormProps) {
  const [subId, setSubId] = useState(editing?.retainer_subscription_id ?? '');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'custom'>(editing?.frequency ?? 'monthly');
  const [customDays, setCustomDays] = useState(editing?.custom_interval_days?.toString() ?? '14');
  const [billingType, setBillingType] = useState<'fixed' | 'hourly'>(editing?.billing_type ?? 'fixed');
  const [fixedAmount, setFixedAmount] = useState(editing?.fixed_amount?.toString() ?? '');
  const [hourlyRate, setHourlyRate] = useState(editing?.hourly_rate?.toString() ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedSub = subscriptions.find((s) => s.id === subId);

  const handleSave = async () => {
    if (!subId) { setErr('Please select a retainer subscription.'); return; }
    if (billingType === 'fixed' && !fixedAmount) { setErr('Enter a fixed amount.'); return; }
    if (billingType === 'hourly' && !hourlyRate) { setErr('Enter an hourly rate.'); return; }
    if (frequency === 'custom' && (!customDays || Number(customDays) < 1)) { setErr('Enter a valid interval (days).'); return; }

    setSaving(true);
    setErr(null);
    try {
      const supabase = createClient();
      const sub = subscriptions.find((s) => s.id === subId)!;
      const payload = {
        retainer_subscription_id: subId,
        inquiry_id: sub.inquiry_id,
        client_name: sub.customer_name,
        client_email: sub.customer_email,
        frequency,
        custom_interval_days: frequency === 'custom' ? Number(customDays) : null,
        billing_type: billingType,
        fixed_amount: billingType === 'fixed' ? Number(fixedAmount) : null,
        hourly_rate: billingType === 'hourly' ? Number(hourlyRate) : null,
        description: description || null,
        is_active: true,
        next_run_at: nextRunDate(frequency, frequency === 'custom' ? Number(customDays) : null),
      };

      if (editing) {
        const { error } = await supabase.from('retainer_invoice_schedules').update(payload).eq('id', editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('retainer_invoice_schedules').insert(payload);
        if (error) throw new Error(error.message);
      }
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">{editing ? 'Edit Schedule' : 'New Invoice Schedule'}</h3>
        <button onClick={onCancel} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{err}</p>}

      {/* Retainer subscription */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Retainer Case</label>
        <select
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select retainer —</option>
          {subscriptions.filter((s) => s.status === 'active').map((s) => (
            <option key={s.id} value={s.id}>{s.customer_name} — {s.plan_name} ({fmt(s.amount)}/mo)</option>
          ))}
        </select>
        {selectedSub && (
          <p className="text-xs text-muted-foreground mt-1.5">{selectedSub.customer_email}</p>
        )}
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Invoice Frequency</label>
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                frequency === f
                  ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {frequency === 'custom' && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="number"
              min="1"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="14"
              className="w-28 px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm text-muted-foreground">days between invoices</span>
          </div>
        )}
      </div>

      {/* Billing type */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Billing Basis</label>
        <div className="flex gap-2">
          {(['fixed', 'hourly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setBillingType(t)}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                billingType === t
                  ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {t === 'fixed' ? 'Fixed Amount' : 'Hourly Rate'}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {billingType === 'fixed' ? (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                placeholder="1500.00"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ) : (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="250.00"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">/hr</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Invoice Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Monthly retainer services — June 2026"
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : editing ? 'Update Schedule' : 'Create Schedule'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({ draft, onConfirm, onCancel }: { draft: InvoiceDraft; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h3 className="font-serif text-lg text-foreground">Reject Draft Invoice</h3>
        <p className="text-sm text-muted-foreground">Invoice <span className="font-semibold text-foreground">{draft.invoice_number}</span> for {draft.client_name} — {fmt(draft.amount)}</p>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Amount needs adjustment, hours not yet confirmed…"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => onConfirm(reason)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Reject</button>
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RetainerInvoiceScheduler() {
  const [tab, setTab] = useState<'schedules' | 'approvals'>('approvals');
  const [schedules, setSchedules] = useState<InvoiceSchedule[]>([]);
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);
  const [subscriptions, setSubscriptions] = useState<RetainerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InvoiceSchedule | null>(null);
  const [rejectingDraft, setRejectingDraft] = useState<InvoiceDraft | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending_approval' | 'approved' | 'rejected' | 'sent'>('pending_approval');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [subsResult, schedsResult, draftDataResult] = await Promise.all([
        supabase.from('retainer_subscriptions').select('id,customer_name,customer_email,plan_name,amount,status,inquiry_id').eq('status', 'active').order('customer_name'),
        supabase.from('retainer_invoice_schedules').select('*').order('created_at', { ascending: false }),
        supabase.from('retainer_invoice_drafts').select('*').order('created_at', { ascending: false }),
      ]);
      setSubscriptions(subsResult.data || []);
      setSchedules(schedsResult.data || []);
      setDrafts(draftDataResult.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  // ── Generate a draft invoice from a schedule ──────────────────────────────

  const handleGenerateDraft = async (schedule: InvoiceSchedule) => {
    setProcessingId(schedule.id);
    try {
      const supabase = createClient();
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = dueDateFromNow(30);
      const amount = schedule.billing_type === 'fixed' ? (schedule.fixed_amount ?? 0) : 0;
      const lineItems: LineItem[] = [
        {
          description: schedule.description || `Retainer services — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          quantity: 1,
          unit_price: amount,
          total: amount,
        },
      ];

      const { error } = await supabase.from('retainer_invoice_drafts').insert({
        schedule_id: schedule.id,
        retainer_subscription_id: schedule.retainer_subscription_id,
        inquiry_id: schedule.inquiry_id,
        client_name: schedule.client_name,
        client_email: schedule.client_email,
        invoice_number: generateInvoiceNumber(),
        invoice_date: invoiceDate,
        due_date: dueDate,
        amount,
        billing_type: schedule.billing_type,
        hourly_rate: schedule.hourly_rate,
        line_items: lineItems,
        notes: schedule.description,
        approval_status: 'pending_approval',
      });

      if (error) throw new Error(error.message);

      // Update last_run_at and next_run_at on schedule
      await supabase.from('retainer_invoice_schedules').update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunDate(schedule.frequency, schedule.custom_interval_days),
      }).eq('id', schedule.id);

      showMsg('success', `Draft invoice generated for ${schedule.client_name} — awaiting approval.`);
      setTab('approvals');
      await fetchAll();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : 'Failed to generate draft.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Approve draft → create real invoice + send email ─────────────────────

  const handleApprove = async (draft: InvoiceDraft) => {
    setProcessingId(draft.id);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const adminEmail = sessionData?.session?.user?.email ?? 'admin';

      // 1. Create the real client_invoice
      const { data: invoice, error: invErr } = await supabase.from('client_invoices').insert({
        inquiry_id: draft.inquiry_id,
        invoice_number: draft.invoice_number,
        invoice_date: draft.invoice_date,
        due_date: draft.due_date,
        amount: draft.amount,
        amount_paid: 0,
        currency: 'usd',
        status: 'pending',
        line_items: draft.line_items,
        notes: draft.notes,
      }).select('id').single();

      if (invErr) throw new Error(invErr.message);

      // 2. Create Stripe payment link
      let paymentLink: string | null = null;
      try {
        const plRes = await fetch('/api/invoices/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoice?.id ?? null,
            invoiceNumber: draft.invoice_number,
            description: draft.notes || `Retainer Invoice ${draft.invoice_number}`,
            amount: draft.amount,
            currency: 'usd',
            customerEmail: draft.client_email,
            customerName: draft.client_name,
            dueDate: draft.due_date,
          }),
        });
        if (plRes.ok) {
          const plData = await plRes.json();
          paymentLink = plData.url ?? null;
        }
      } catch {
        // Non-fatal — email still sends without payment link
      }

      // 3. Send invoice email with embedded payment link
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') ?? '';
        await fetch('/api/invoices/notify-issued', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: draft.client_email,
            clientName: draft.client_name,
            invoiceNumber: draft.invoice_number,
            invoiceDate: draft.invoice_date,
            dueDate: draft.due_date,
            amount: draft.amount,
            currency: 'usd',
            inquiryId: draft.inquiry_id,
            lineItems: draft.line_items,
            notes: draft.notes,
            paymentLink,
          }),
        });
      } catch {
        // Non-fatal — invoice still approved even if email fails
      }

      // 4. Mark draft as approved + sent
      const now = new Date().toISOString();
      await supabase.from('retainer_invoice_drafts').update({
        approval_status: 'sent',
        approved_by: adminEmail,
        approved_at: now,
        sent_at: now,
        client_invoice_id: invoice?.id ?? null,
      }).eq('id', draft.id);

      showMsg('success', `Invoice ${draft.invoice_number} approved and sent to ${draft.client_email}${paymentLink ? ' with payment link' : ''}.`);
      await fetchAll();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Mark approved draft as sent ───────────────────────────────────────────

  const handleMarkSent = async (draft: InvoiceDraft) => {
    setProcessingId(draft.id);
    try {
      const supabase = createClient();
      await supabase.from('retainer_invoice_drafts').update({
        approval_status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', draft.id);

      if (draft.client_invoice_id) {
        await supabase.from('client_invoices').update({ status: 'pending' }).eq('id', draft.client_invoice_id);
      }

      showMsg('success', `Invoice ${draft.invoice_number} marked as sent to ${draft.client_email}.`);
      await fetchAll();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : 'Failed to mark as sent.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Reject draft ──────────────────────────────────────────────────────────

  const handleReject = async (draft: InvoiceDraft, reason: string) => {
    setRejectingDraft(null);
    setProcessingId(draft.id);
    try {
      const supabase = createClient();
      await supabase.from('retainer_invoice_drafts').update({
        approval_status: 'rejected',
        rejected_reason: reason || null,
      }).eq('id', draft.id);
      showMsg('success', `Draft invoice ${draft.invoice_number} rejected.`);
      await fetchAll();
    } catch (e: unknown) {
      showMsg('error', e instanceof Error ? e.message : 'Rejection failed.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Toggle schedule active ────────────────────────────────────────────────

  const handleToggleActive = async (schedule: InvoiceSchedule) => {
    try {
      const supabase = createClient();
      await supabase.from('retainer_invoice_schedules').update({ is_active: !schedule.is_active }).eq('id', schedule.id);
      await fetchAll();
    } catch {
      showMsg('error', 'Failed to update schedule.');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const pendingCount = drafts.filter((d) => d.approval_status === 'pending_approval').length;
  const filteredDrafts = approvalFilter === 'all' ? drafts : drafts.filter((d) => d.approval_status === approvalFilter);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action message */}
      {actionMsg && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-medium ${
          actionMsg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
        }`}>
          {actionMsg.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {actionMsg.text}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Schedules', value: schedules.filter((s) => s.is_active).length, color: 'text-emerald-700' },
          { label: 'Pending Approval', value: pendingCount, color: pendingCount > 0 ? 'text-amber-700' : 'text-foreground' },
          { label: 'Approved (Unsent)', value: drafts.filter((d) => d.approval_status === 'approved').length, color: 'text-blue-700' },
          { label: 'Sent This Month', value: drafts.filter((d) => d.approval_status === 'sent' && new Date(d.sent_at ?? '').getMonth() === new Date().getMonth()).length, color: 'text-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{stat.label}</p>
            <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { id: 'approvals', label: 'Approval Queue', badge: pendingCount },
          { id: 'schedules', label: 'Invoice Schedules', badge: null },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-widest border-b-2 transition-all ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.badge !== null && t.badge > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Approval Queue Tab ── */}
      {tab === 'approvals' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending_approval', 'approved', 'rejected', 'sent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setApprovalFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  approvalFilter === f
                    ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : f === 'pending_approval' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending_approval' && pendingCount > 0 && ` (${pendingCount})`}
              </button>
            ))}
          </div>

          {filteredDrafts.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No draft invoices</p>
              <p className="text-xs text-muted-foreground">Generate a draft from a schedule to start the approval workflow.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDrafts.map((draft) => (
                <div key={draft.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <span className="text-sm font-bold text-foreground">{draft.invoice_number}</span>
                        <ApprovalBadge status={draft.approval_status} />
                        <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{draft.billing_type === 'fixed' ? 'Fixed' : 'Hourly'}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{draft.client_name}</p>
                      <p className="text-xs text-muted-foreground">{draft.client_email}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Invoice date: <span className="text-foreground font-medium">{fmtDate(draft.invoice_date)}</span></span>
                        <span className="text-xs text-muted-foreground">Due: <span className="text-foreground font-medium">{fmtDate(draft.due_date)}</span></span>
                        {draft.billing_type === 'hourly' && draft.hours_billed && (
                          <span className="text-xs text-muted-foreground">{draft.hours_billed}h @ {fmt(draft.hourly_rate ?? 0)}/hr</span>
                        )}
                      </div>
                      {draft.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic">{draft.notes}</p>
                      )}
                      {draft.rejected_reason && (
                        <p className="text-xs text-red-600 mt-1.5">Rejection reason: {draft.rejected_reason}</p>
                      )}
                      {draft.approved_by && draft.approval_status !== 'rejected' && (
                        <p className="text-xs text-muted-foreground mt-1.5">Approved by {draft.approved_by} on {fmtDate(draft.approved_at)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-xl font-semibold text-foreground">{fmt(draft.amount)}</p>
                      <p className="text-xs text-muted-foreground">Generated {fmtDate(draft.created_at)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {draft.approval_status === 'pending_approval' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => handleApprove(draft)}
                        disabled={processingId === draft.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {processingId === draft.id ? 'Approving & Sending…' : 'Approve & Send to Client'}
                      </button>
                      <button
                        onClick={() => setRejectingDraft(draft)}
                        disabled={processingId === draft.id}
                        className="px-4 py-2.5 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {draft.approval_status === 'sent' && draft.sent_at && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Sent to {draft.client_email} on {fmtDate(draft.sent_at)} with Stripe payment link
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Schedules Tab ── */}
      {tab === 'schedules' && (
        <div className="space-y-4">
          {/* Add schedule button */}
          {!showForm && (
            <div className="flex justify-end">
              <button
                onClick={() => { setShowForm(true); setEditingSchedule(null); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Schedule
              </button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <ScheduleForm
              subscriptions={subscriptions}
              editing={editingSchedule}
              onSaved={async () => { setShowForm(false); setEditingSchedule(null); await fetchAll(); showMsg('success', 'Schedule saved.'); }}
              onCancel={() => { setShowForm(false); setEditingSchedule(null); }}
            />
          )}

          {/* Schedules list */}
          {schedules.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No schedules yet</p>
              <p className="text-xs text-muted-foreground">Create a schedule to auto-generate invoices for retainer cases.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const sub = subscriptions.find((s) => s.id === schedule.retainer_subscription_id);
                const draftCount = drafts.filter((d) => d.schedule_id === schedule.id && d.approval_status === 'pending_approval').length;
                return (
                  <div key={schedule.id} className={`bg-card border rounded-2xl p-5 transition-all ${schedule.is_active ? 'border-border' : 'border-border/50 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <span className="text-sm font-bold text-foreground">{schedule.client_name}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            schedule.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${schedule.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {schedule.is_active ? 'Active' : 'Paused'}
                          </span>
                          {draftCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {draftCount} pending approval
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{schedule.client_email}</p>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 text-xs font-semibold text-foreground">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {schedule.frequency === 'custom' ? `Every ${schedule.custom_interval_days}d` : schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 text-xs font-semibold text-foreground">
                            {schedule.billing_type === 'fixed'
                              ? `Fixed ${fmt(schedule.fixed_amount ?? 0)}`
                              : `${fmt(schedule.hourly_rate ?? 0)}/hr`}
                          </span>
                          {sub && (
                            <span className="text-xs text-muted-foreground">{sub.plan_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Next run: <span className="text-foreground font-medium">{fmtDate(schedule.next_run_at)}</span></span>
                          {schedule.last_run_at && (
                            <span className="text-xs text-muted-foreground">Last run: <span className="text-foreground font-medium">{fmtDate(schedule.last_run_at)}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleGenerateDraft(schedule)}
                          disabled={processingId === schedule.id || !schedule.is_active}
                          title="Generate draft invoice now"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 disabled:opacity-40 transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                          {processingId === schedule.id ? '…' : 'Generate'}
                        </button>
                        <button
                          onClick={() => { setEditingSchedule(schedule); setShowForm(true); }}
                          title="Edit schedule"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => handleToggleActive(schedule)}
                          title={schedule.is_active ? 'Pause schedule' : 'Resume schedule'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        >
                          {schedule.is_active ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectingDraft && (
        <RejectModal
          draft={rejectingDraft}
          onConfirm={(reason) => handleReject(rejectingDraft, reason)}
          onCancel={() => setRejectingDraft(null)}
        />
      )}
    </div>
  );
}
