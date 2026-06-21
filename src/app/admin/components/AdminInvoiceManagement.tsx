'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent, getAdminEmail } from '@/lib/auditLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseOption {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
  booking_stage: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  line_items: LineItem[];
  created_at: string;
  updated_at: string;
  inquiry_id: string | null;
  stripe_checkout_session_id: string | null;
  payment_token: string | null;
  contact_inquiries?: {
    name: string;
    email: string;
    firm: string;
    service: string;
    booking_stage: string;
  } | null;
}

interface InvoiceReminder {
  id: string;
  invoice_id: string;
  reminder_type: 'before_due' | 'after_due';
  trigger_days: number;
  scheduled_date: string;
  sent_at: string | null;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  error_message: string | null;
}

interface InvoiceStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
}

type ActiveView = 'list' | 'create' | 'detail';
type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'cancelled';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900) + 100;
  return `INV-${y}${m}-${rand}`;
}

function isOverdue(dueDate: string, status: string) {
  if (status === 'paid' || status === 'cancelled') return false;
  return new Date(dueDate + 'T00:00:00') < new Date();
}

function daysUntilDue(dueDate: string) {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' },
};

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
  { value: 'net_7', label: 'Net 7', days: 7 },
  { value: 'net_15', label: 'Net 15', days: 15 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'net_45', label: 'Net 45', days: 45 },
  { value: 'net_60', label: 'Net 60', days: 60 },
];

function newLineItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), description: '', quantity: 1, unit_price: 0, total: 0 };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsRow({ stats, loading }: { stats: InvoiceStats; loading: boolean }) {
  const cards = [
    { label: 'Total Invoices', value: stats.total, sub: fmt(stats.totalAmount), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ), iconBg: 'bg-slate-100 text-slate-600' },
    { label: 'Pending', value: stats.pending, sub: fmt(stats.pendingAmount), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ), iconBg: 'bg-amber-100 text-amber-600' },
    { label: 'Paid', value: stats.paid, sub: fmt(stats.paidAmount), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ), iconBg: 'bg-emerald-100 text-emerald-600' },
    { label: 'Overdue', value: stats.overdue, sub: fmt(stats.overdueAmount), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ), iconBg: 'bg-red-100 text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>{c.icon}</div>
          </div>
          {loading ? (
            <div className="h-7 w-14 bg-secondary animate-pulse rounded-lg" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{c.label}</p>
          {!loading && <p className="text-xs text-muted-foreground/70 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Invoice Create Form ──────────────────────────────────────────────────────

interface CreateFormProps {
  cases: CaseOption[];
  onCreated: (invoice: Invoice) => void;
  onCancel: () => void;
}

function InvoiceCreateForm({ cases, onCreated, onCancel }: CreateFormProps) {
  const [caseId, setCaseId] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [dueDate, setDueDate] = useState(() => addDays(todayStr(), 30));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [saving, setSaving] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);

  const handleCaseChange = (id: string) => {
    setCaseId(id);
    const c = cases.find((x) => x.id === id) ?? null;
    setSelectedCase(c);
  };

  const handleTermsChange = (val: string) => {
    setPaymentTerms(val);
    const term = PAYMENT_TERMS.find((t) => t.value === val);
    if (term) setDueDate(addDays(invoiceDate, term.days));
  };

  const handleInvoiceDateChange = (val: string) => {
    setInvoiceDate(val);
    const term = PAYMENT_TERMS.find((t) => t.value === paymentTerms);
    if (term) setDueDate(addDays(val, term.days));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((li) => {
      if (li.id !== id) return li;
      const updated = { ...li, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = Number(updated.quantity) * Number(updated.unit_price);
      }
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleSave = async () => {
    setError(null);
    if (!caseId) { setError('Please select a case.'); return; }
    if (lineItems.length === 0 || lineItems.every((li) => !li.description)) { setError('Add at least one line item.'); return; }
    if (subtotal <= 0) { setError('Invoice total must be greater than $0.'); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const cleanItems = lineItems.filter((li) => li.description.trim()).map(({ id: _id, ...rest }) => rest);

      const { data: inv, error: insertErr } = await supabase
        .from('client_invoices')
        .insert({
          inquiry_id: caseId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          amount: subtotal,
          amount_paid: 0,
          status: 'pending',
          line_items: cleanItems,
          notes: notes.trim() || null,
        })
        .select(`*, contact_inquiries(name, email, firm, service, booking_stage)`)
        .single();

      if (insertErr) throw insertErr;

      // Schedule reminders (7 days before + 3 days after)
      const beforeDate = addDays(dueDate, -7);
      const afterDate = addDays(dueDate, 3);
      const today = todayStr();

      const reminders = [];
      if (beforeDate >= today) {
        reminders.push({ invoice_id: inv.id, inquiry_id: caseId, reminder_type: 'before_due', trigger_days: 7, scheduled_date: beforeDate });
      }
      reminders.push({ invoice_id: inv.id, inquiry_id: caseId, reminder_type: 'after_due', trigger_days: 3, scheduled_date: afterDate });

      if (reminders.length > 0) {
        await supabase.from('invoice_reminders').upsert(reminders, { onConflict: 'invoice_id,reminder_type' });
      }

      // Send email notification
      if (sendEmail && selectedCase) {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
          const directPayLink = inv.payment_token ? `${siteUrl}/pay/${inv.payment_token}` : null;
          await fetch('/api/invoices/notify-issued', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientEmail: selectedCase.email,
              clientName: selectedCase.name,
              invoiceNumber,
              invoiceDate,
              dueDate,
              amount: subtotal,
              currency: 'usd',
              inquiryId: caseId,
              lineItems: cleanItems,
              notes: notes.trim() || '',
              paymentLink: directPayLink,
            }),
          });
        } catch {
          // Non-blocking
        }
      }

      // Audit log: invoice created (and sent if applicable)
      const actor = await getAdminEmail();
      logAuditEvent({
        action_type: sendEmail ? 'invoice_sent' : 'invoice_created',
        actor_email: actor.email,
        actor_id: actor.id,
        target_type: 'invoice',
        target_id: inv.id,
        target_label: `Invoice ${invoiceNumber} — ${selectedCase?.name ?? caseId}`,
        description: sendEmail
          ? `Invoice ${invoiceNumber} created and sent to ${selectedCase?.email ?? ''} for $${subtotal.toFixed(2)}`
          : `Invoice ${invoiceNumber} created for ${selectedCase?.name ?? caseId} — $${subtotal.toFixed(2)}`,
        metadata: {
          invoice_number: invoiceNumber,
          amount: subtotal,
          due_date: dueDate,
          client_email: selectedCase?.email ?? null,
          email_sent: sendEmail,
        },
      });

      onCreated(inv as Invoice);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground font-semibold">New Invoice</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create and send a new invoice linked to a case</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-5">
          {/* Case selector */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Case / Client</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Linked Case *</label>
              <select
                value={caseId}
                onChange={(e) => handleCaseChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select a case…</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.firm ? ` — ${c.firm}` : ''} · {c.service}</option>
                ))}
              </select>
            </div>
            {selectedCase && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FAF7F2] border border-[#4A3728]/10">
                <div className="w-8 h-8 rounded-lg bg-[#4A3728]/10 flex items-center justify-center flex-shrink-0 text-[#4A3728] font-semibold text-sm">
                  {selectedCase.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{selectedCase.name}</p>
                  {selectedCase.firm && <p className="text-xs text-muted-foreground">{selectedCase.firm}</p>}
                  <p className="text-xs text-muted-foreground">{selectedCase.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedCase.service}</p>
                </div>
              </div>
            )}
          </div>

          {/* Invoice meta */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoice Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Invoice #</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => handleInvoiceDateChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => handleTermsChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {PAYMENT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment instructions, terms, or additional notes…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>

          {/* Email trigger */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${sendEmail ? 'bg-[#355E3B] border-[#355E3B]' : 'border-border bg-background'}`}>
                  {sendEmail && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Send invoice email to client</p>
                <p className="text-xs text-muted-foreground mt-0.5">Automatically email the invoice with payment link when created. Reminders will be scheduled 7 days before and 3 days after the due date.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Right: Line items */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Line Items</p>
            <button
              onClick={() => setLineItems((prev) => [...prev, newLineItem()])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((li, idx) => (
              <div key={li.id} className="p-3 rounded-xl border border-border/60 bg-secondary/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-semibold">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(li.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
                <input
                  value={li.description}
                  onChange={(e) => updateLineItem(li.id, 'description', e.target.value)}
                  placeholder="Description of service…"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Rate ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unit_price}
                      onChange={(e) => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Total</label>
                    <div className="px-2 py-2 rounded-lg border border-border bg-secondary/30 text-sm font-semibold text-foreground">
                      {fmt(li.total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium text-foreground">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-foreground">Total Due</span>
              <span className="text-lg font-bold text-[#355E3B]">{fmt(subtotal)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {saving ? 'Creating…' : sendEmail ? 'Create & Send' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Detail Panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  invoice: Invoice;
  onBack: () => void;
  onUpdated: (inv: Invoice) => void;
}

function InvoiceDetailPanel({ invoice, onBack, onUpdated }: DetailPanelProps) {
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchReminders = async () => {
      setLoadingReminders(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('invoice_reminders')
          .select('*')
          .eq('invoice_id', invoice.id)
          .order('scheduled_date', { ascending: true });
        setReminders((data as InvoiceReminder[]) || []);
      } catch {
        // silent
      } finally {
        setLoadingReminders(false);
      }
    };
    fetchReminders();
  }, [invoice.id]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const supabase = createClient();
      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'paid') updates.amount_paid = invoice.amount;
      const { data, error } = await supabase
        .from('client_invoices')
        .update(updates)
        .eq('id', invoice.id)
        .select(`*, contact_inquiries(name, email, firm, service, booking_stage)`)
        .single();
      if (error) throw error;
      onUpdated(data as Invoice);
      showToast(`Invoice marked as ${newStatus}.`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

      // Use the direct /pay/[token] URL if available (no login required for client)
      if (invoice.payment_token) {
        setPaymentLink(`${siteUrl}/pay/${invoice.payment_token}`);
        showToast('Direct payment link ready — no login required.', 'success');
        return;
      }

      // Fallback: generate a Stripe Checkout session URL
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          description: `Invoice ${invoice.invoice_number}`,
          amount: Number(invoice.amount) - Number(invoice.amount_paid),
          currency: 'usd',
          customerEmail: invoice.contact_inquiries?.email ?? '',
          customerName: invoice.contact_inquiries?.name ?? '',
          dueDate: invoice.due_date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');
      setPaymentLink(data.url);
      showToast('Payment link generated.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to generate payment link.', 'error');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleResendEmail = async () => {
    if (!invoice.contact_inquiries) return;
    setSendingEmail(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
      const directPayLink = invoice.payment_token ? `${siteUrl}/pay/${invoice.payment_token}` : null;
      const res = await fetch('/api/invoices/notify-issued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: invoice.contact_inquiries.email,
          clientName: invoice.contact_inquiries.name,
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          amount: invoice.amount,
          currency: 'usd',
          inquiryId: invoice.inquiry_id,
          lineItems: invoice.line_items,
          notes: invoice.notes ?? '',
          paymentLink: directPayLink,
        }),
      });
      if (!res.ok) throw new Error('Failed to send email');
      showToast('Invoice email resent to client.', 'success');

      const actor = await getAdminEmail();
      logAuditEvent({
        action_type: 'invoice_sent',
        actor_email: actor.email,
        actor_id: actor.id,
        target_type: 'invoice',
        target_id: invoice.id,
        target_label: `Invoice ${invoice.invoice_number} — ${invoice.contact_inquiries.name}`,
        description: `Invoice ${invoice.invoice_number} resent to ${invoice.contact_inquiries.email}`,
        metadata: {
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          client_email: invoice.contact_inquiries.email,
        },
      });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to resend email.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const client = invoice.contact_inquiries;
  const days = daysUntilDue(invoice.due_date);
  const overdue = isOverdue(invoice.due_date, invoice.status);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Back + header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-serif text-2xl text-foreground font-semibold">{invoice.invoice_number}</h2>
              <StatusBadge status={invoice.status} />
              {overdue && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Overdue
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Issued {fmtDate(invoice.invoice_date)} · Due {fmtDate(invoice.due_date)}
              {invoice.status === 'pending' && !overdue && days >= 0 && (
                <span className={`ml-2 font-medium ${days <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  ({days === 0 ? 'due today' : `${days}d remaining`})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <button
                onClick={handleResendEmail}
                disabled={sendingEmail || !client}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
              >
                {sendingEmail ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
                {sendingEmail ? 'Sending…' : 'Resend Email'}
              </button>
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
              >
                {generatingLink ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                )}
                {generatingLink ? 'Generating…' : 'Payment Link'}
              </button>
            </>
          )}
          {invoice.status === 'pending' && (
            <button
              onClick={() => handleStatusUpdate('paid')}
              disabled={updatingStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#355E3B] text-white text-xs font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-50"
            >
              {updatingStatus ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              Mark Paid
            </button>
          )}
          {invoice.status === 'overdue' && (
            <button
              onClick={() => handleStatusUpdate('paid')}
              disabled={updatingStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#355E3B] text-white text-xs font-semibold hover:bg-[#2a4a2e] transition-colors disabled:opacity-50"
            >
              Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* Payment link banner */}
      {paymentLink && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg width="16" height="16" className="text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <p className="text-sm text-emerald-700 font-medium flex-1 truncate">{paymentLink}</p>
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 transition-colors flex-shrink-0">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 transition-colors flex-shrink-0">
            Open
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client info */}
          {client && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Bill To</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4A3728]/10 flex items-center justify-center flex-shrink-0 text-[#4A3728] font-semibold">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{client.name}</p>
                  {client.firm && <p className="text-sm text-muted-foreground">{client.firm}</p>}
                  <p className="text-sm text-muted-foreground">{client.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{client.service}</p>
                </div>
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Line Items</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/20">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-2.5">Description</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-2.5 w-16">Qty</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-2.5 w-24">Rate</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-2.5 w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((li, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-5 py-3 text-foreground">{li.description}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{li.quantity}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{fmt(li.unit_price)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(li.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-4 border-t border-border bg-secondary/10">
              <div className="flex justify-end">
                <div className="w-48 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">{fmt(invoice.amount)}</span>
                  </div>
                  {invoice.amount_paid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-medium text-emerald-600">−{fmt(invoice.amount_paid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-1.5 border-t border-border">
                    <span className="text-foreground">Balance Due</span>
                    <span className="text-[#355E3B]">{fmt(Math.max(0, invoice.amount - invoice.amount_paid))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Status + Reminders */}
        <div className="space-y-5">
          {/* Status management */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payment Status</p>
            <div className="space-y-2">
              {(['pending', 'paid', 'overdue', 'cancelled'] as const).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isActive = invoice.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => !isActive && handleStatusUpdate(s)}
                    disabled={updatingStatus || isActive}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isActive ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'} disabled:cursor-default`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? cfg.dot : 'bg-border'}`} />
                    {cfg.label}
                    {isActive && (
                      <svg className="ml-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automated reminders */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email Reminders</p>
            {loadingReminders ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-12 bg-secondary animate-pulse rounded-xl" />)}
              </div>
            ) : reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No reminders scheduled.</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((r) => {
                  const rCfg = r.send_status === 'sent' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
                    : r.send_status === 'failed' ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
                    : r.send_status === 'skipped' ? { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' }
                    : { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
                  return (
                    <div key={r.id} className={`p-3 rounded-xl border ${rCfg.bg} ${rCfg.border}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold ${rCfg.text}`}>
                          {r.reminder_type === 'before_due' ? `${r.trigger_days}d Before Due` : `${r.trigger_days}d After Due`}
                        </p>
                        <span className={`text-[10px] font-semibold uppercase tracking-widest ${rCfg.text}`}>{r.send_status}</span>
                      </div>
                      <p className={`text-xs mt-0.5 ${rCfg.text} opacity-80`}>
                        {r.send_status === 'sent' && r.sent_at ? `Sent ${fmtDate(r.sent_at.split('T')[0])}` : `Scheduled ${fmtDate(r.scheduled_date)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice List ─────────────────────────────────────────────────────────────

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  onSelect: (inv: Invoice) => void;
  onCreateNew: () => void;
  statusFilter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

function InvoiceList({ invoices, loading, onSelect, onCreateNew, statusFilter, onFilterChange, search, onSearchChange }: InvoiceListProps) {
  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q)
      || inv.contact_inquiries?.name.toLowerCase().includes(q)
      || inv.contact_inquiries?.email.toLowerCase().includes(q)
      || inv.contact_inquiries?.firm?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search invoices, clients…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-xl">
          {(['all', 'pending', 'paid', 'overdue', 'cancelled'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => onFilterChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Invoice
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border/40 last:border-0">
              <div className="h-4 w-28 bg-secondary animate-pulse rounded" />
              <div className="h-4 w-36 bg-secondary animate-pulse rounded flex-1" />
              <div className="h-4 w-20 bg-secondary animate-pulse rounded" />
              <div className="h-6 w-16 bg-secondary animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-16 text-center">
          <svg className="mx-auto mb-3 text-muted-foreground/30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-muted-foreground text-sm font-medium">No invoices found</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
          </p>
          {!search && statusFilter === 'all' && (
            <button onClick={onCreateNew} className="mt-4 px-4 py-2 rounded-xl bg-[#355E3B] text-white text-sm font-semibold hover:bg-[#2a4a2e] transition-colors">
              Create Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-3">Invoice #</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Client / Case</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Amount</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3 hidden md:table-cell">Due Date</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 py-3">Status</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const overdue = isOverdue(inv.due_date, inv.status);
                  const days = daysUntilDue(inv.due_date);
                  const displayStatus = overdue && inv.status === 'pending' ? 'overdue' : inv.status;
                  return (
                    <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => onSelect(inv)}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground text-xs">{inv.invoice_number}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(inv.invoice_date)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-medium text-foreground">{inv.contact_inquiries?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{inv.contact_inquiries?.firm || inv.contact_inquiries?.service || ''}</p>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <p className="font-semibold text-foreground">{fmt(inv.amount)}</p>
                        {inv.amount_paid > 0 && inv.amount_paid < inv.amount && (
                          <p className="text-xs text-emerald-600">{fmt(inv.amount_paid)} paid</p>
                        )}
                      </td>
                      <td className="px-3 py-4 hidden md:table-cell">
                        <p className={`text-sm ${overdue && inv.status === 'pending' ? 'text-red-600 font-semibold' : 'text-foreground'}`}>{fmtDate(inv.due_date)}</p>
                        {inv.status === 'pending' && !overdue && days <= 7 && days >= 0 && (
                          <p className="text-xs text-amber-600 font-medium">{days === 0 ? 'Due today' : `${days}d left`}</p>
                        )}
                        {overdue && inv.status === 'pending' && (
                          <p className="text-xs text-red-600 font-medium">{Math.abs(days)}d overdue</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelect(inv); }}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-secondary/10 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{fmt(filtered.reduce((s, i) => s + i.amount, 0))}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminInvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [invoicesRes, casesRes] = await Promise.all([
        supabase
          .from('client_invoices')
          .select(`id, invoice_number, invoice_date, due_date, amount, amount_paid, status, notes, line_items, created_at, updated_at, inquiry_id, stripe_checkout_session_id, contact_inquiries(name, email, firm, service, booking_stage)`)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('contact_inquiries')
          .select('id, name, email, firm, service, booking_stage')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (casesRes.error) throw casesRes.error;

      setInvoices((invoicesRes.data as Invoice[]) || []);
      setCases((casesRes.data as CaseOption[]) || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-mark overdue invoices
  useEffect(() => {
    const markOverdue = async () => {
      const today = todayStr();
      const overdueIds = invoices
        .filter((inv) => inv.status === 'pending' && inv.due_date < today)
        .map((inv) => inv.id);
      if (overdueIds.length === 0) return;
      try {
        const supabase = createClient();
        await supabase
          .from('client_invoices')
          .update({ status: 'overdue', updated_at: new Date().toISOString() })
          .in('id', overdueIds);
        setInvoices((prev) => prev.map((inv) => overdueIds.includes(inv.id) ? { ...inv, status: 'overdue' } : inv));
      } catch {
        // silent
      }
    };
    if (invoices.length > 0) markOverdue();
  }, [invoices.length]);

  const stats: InvoiceStats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    overdue: invoices.filter((i) => i.status === 'overdue').length,
    cancelled: invoices.filter((i) => i.status === 'cancelled').length,
    totalAmount: invoices.reduce((s, i) => s + i.amount, 0),
    pendingAmount: invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    paidAmount: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    overdueAmount: invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  };

  const handleCreated = (inv: Invoice) => {
    setInvoices((prev) => [inv, ...prev]);
    setSelectedInvoice(inv);
    setActiveView('detail');
    showToast(`Invoice ${inv.invoice_number} created successfully.`, 'success');
  };

  const handleUpdated = (inv: Invoice) => {
    setInvoices((prev) => prev.map((i) => i.id === inv.id ? inv : i));
    setSelectedInvoice(inv);
  };

  const handleSelect = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setActiveView('detail');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Stats — always visible */}
      {activeView === 'list' && <StatsRow stats={stats} loading={loading} />}

      {/* Views */}
      {activeView === 'list' && (
        <InvoiceList
          invoices={invoices}
          loading={loading}
          onSelect={handleSelect}
          onCreateNew={() => setActiveView('create')}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      {activeView === 'create' && (
        <InvoiceCreateForm
          cases={cases}
          onCreated={handleCreated}
          onCancel={() => setActiveView('list')}
        />
      )}

      {activeView === 'detail' && selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          onBack={() => { setActiveView('list'); setSelectedInvoice(null); }}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
