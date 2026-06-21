'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeLogEntry {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  work_type: string | null;
  logged_by: string | null;
  billed_at: string | null;
  created_at: string;
  retainer_subscriptions?: { customer_name: string; customer_email: string; plan_name: string } | null;
}

interface InvoiceDraft {
  id: string;
  client_name: string;
  client_email: string;
  total_hours: number;
  hourly_rate: number;
  subtotal: number;
  draft_status: string;
  created_at: string;
  line_items: Array<{
    description: string;
    hours: number;
    rate: number;
    total: number;
    work_type: string;
    work_date: string;
  }>;
  notes: string | null;
}

interface InvoiceLineItem {
  id: string;
  date: string;
  description: string;
  workType: string;
  hours: number;
  rate: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  firmEmail: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  matterRef: string;
  lineItems: InvoiceLineItem[];
  notes: string;
  taxRate: number;
}

// ── Email Log Type ────────────────────────────────────────────────────────────
interface EmailLog {
  id: string;
  invoice_number: string;
  client_email: string;
  client_name: string;
  email_id: string | null;
  sent_at: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WORK_TYPE_LABELS: Record<string, string> = {
  research: 'Legal Research',
  drafting: 'Document Drafting',
  meetings: 'Client Meeting / Conference',
  review: 'Document Review',
  filing: 'Court Filing',
  other: 'Legal Services',
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dueDateStr(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

// ── Invoice Preview Component ─────────────────────────────────────────────────

function InvoicePreview({ invoice }: { invoice: InvoiceData }) {
  const subtotal = invoice.lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmount = subtotal * (invoice.taxRate / 100);
  const total = subtotal + taxAmount;

  return (
    <div id="lexi-invoice-print" className="bg-white text-gray-900 font-sans text-sm leading-relaxed">
      {/* Firm Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{invoice.firmName}</h1>
          <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{invoice.firmAddress}</p>
          {invoice.firmPhone && <p className="text-xs text-gray-500">{invoice.firmPhone}</p>}
          {invoice.firmEmail && <p className="text-xs text-gray-500">{invoice.firmEmail}</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-800 tracking-tight">INVOICE</p>
          <p className="text-sm font-semibold text-gray-600 mt-1">{invoice.invoiceNumber}</p>
          <div className="mt-3 space-y-0.5">
            <div className="flex items-center gap-3 justify-end">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Issue Date</span>
              <span className="text-xs font-semibold text-gray-800">{fmtDate(invoice.issueDate)}</span>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Due Date</span>
              <span className="text-xs font-semibold text-gray-800">{fmtDate(invoice.dueDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
          <p className="font-bold text-gray-900">{invoice.clientName || '—'}</p>
          {invoice.clientEmail && <p className="text-xs text-gray-600">{invoice.clientEmail}</p>}
          {invoice.clientAddress && <p className="text-xs text-gray-600 whitespace-pre-line">{invoice.clientAddress}</p>}
        </div>
        {invoice.matterRef && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Matter / Case</p>
            <p className="text-sm font-semibold text-gray-800">{invoice.matterRef}</p>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-tl">Date</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest">Description</th>
            <th className="text-center px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest">Hrs</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest">Rate</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-tr">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap border-b border-gray-100">{fmtDate(item.date)}</td>
              <td className="px-3 py-2.5 text-xs text-gray-800 border-b border-gray-100">
                <span className="font-medium">{item.description}</span>
                {item.workType && (
                  <span className="ml-1.5 text-[10px] text-gray-400">({WORK_TYPE_LABELS[item.workType] ?? item.workType})</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-center text-gray-700 border-b border-gray-100 font-mono">{Number(item.hours).toFixed(2)}</td>
              <td className="px-3 py-2.5 text-xs text-right text-gray-700 border-b border-gray-100 font-mono">{fmtCurrency(item.rate)}</td>
              <td className="px-3 py-2.5 text-xs text-right font-semibold text-gray-900 border-b border-gray-100 font-mono">{fmtCurrency(item.total)}</td>
            </tr>
          ))}
          {invoice.lineItems.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400 italic">No line items added yet</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Subtotal</span>
            <span className="font-mono">{fmtCurrency(subtotal)}</span>
          </div>
          {invoice.taxRate > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Tax ({invoice.taxRate}%)</span>
              <span className="font-mono">{fmtCurrency(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t-2 border-gray-800">
            <span>Total Due</span>
            <span className="font-mono">{fmtCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="border-t border-gray-200 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes & Payment Terms</p>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400">Thank you for your business. Please remit payment by {fmtDate(invoice.dueDate)}.</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{invoice.firmName} · {invoice.firmEmail}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LexiInvoiceTabProps {
  clientName?: string;
  caseRef?: string;
}

export default function LexiInvoiceTab({ clientName, caseRef }: LexiInvoiceTabProps) {
  const supabase = createClient();
  const printRef = useRef<HTMLDivElement>(null);

  // View state: 'list' | 'builder' | 'preview'
  const [view, setView] = useState<'list' | 'builder' | 'preview'>('list');
  const [loading, setLoading] = useState(true);

  // Data
  const [unbilledLogs, setUnbilledLogs] = useState<TimeLogEntry[]>([]);
  const [draftInvoices, setDraftInvoices] = useState<InvoiceDraft[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // Invoice form
  const [invoice, setInvoice] = useState<InvoiceData>({
    invoiceNumber: generateInvoiceNumber(),
    issueDate: todayStr(),
    dueDate: dueDateStr(30),
    firmName: 'Broussard Legal Services',
    firmAddress: 'Louisiana, United States',
    firmPhone: '',
    firmEmail: 'info@broussardlegalservices.com',
    clientName: clientName ?? '',
    clientEmail: '',
    clientAddress: '',
    matterRef: caseRef ?? '',
    lineItems: [],
    notes: 'Payment is due within 30 days of invoice date. Please make checks payable to Broussard Legal Services or pay online via the client portal.',
    taxRate: 0,
  });

  const [hourlyRate, setHourlyRate] = useState(150);
  const [isPrinting, setIsPrinting] = useState(false);

  // Email send state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showTrackingPanel, setShowTrackingPanel] = useState(false);

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, draftsRes] = await Promise.all([
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, inquiry_id, hours, description, work_date, work_type, logged_by, billed_at, created_at, retainer_subscriptions(customer_name, customer_email, plan_name)')
          .is('billed_at', null)
          .order('work_date', { ascending: false })
          .limit(100),
        supabase
          .from('lexi_invoice_drafts')
          .select('id, client_name, client_email, total_hours, hourly_rate, subtotal, draft_status, created_at, line_items, notes')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (logsRes.data) setUnbilledLogs(logsRes.data as TimeLogEntry[]);
      if (draftsRes.data) setDraftInvoices(draftsRes.data as InvoiceDraft[]);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Build invoice from selected logs ──────────────────────────────────────
  const buildInvoiceFromLogs = useCallback(() => {
    const selected = unbilledLogs.filter(l => selectedLogIds.has(l.id));
    if (selected.length === 0) return;

    const firstLog = selected[0];
    const detectedClient = (firstLog.retainer_subscriptions as { customer_name: string; customer_email: string } | null);

    const lineItems: InvoiceLineItem[] = selected.map(log => ({
      id: log.id,
      date: log.work_date,
      description: log.description ?? 'Legal Services',
      workType: log.work_type ?? 'other',
      hours: Number(log.hours),
      rate: hourlyRate,
      total: Number(log.hours) * hourlyRate,
    }));

    setInvoice(prev => ({
      ...prev,
      invoiceNumber: generateInvoiceNumber(),
      issueDate: todayStr(),
      dueDate: dueDateStr(30),
      clientName: detectedClient?.customer_name ?? clientName ?? prev.clientName,
      clientEmail: detectedClient?.customer_email ?? prev.clientEmail,
      matterRef: caseRef ?? prev.matterRef,
      lineItems,
    }));

    setView('builder');
  }, [unbilledLogs, selectedLogIds, hourlyRate, clientName, caseRef]);

  // ── Load from draft ────────────────────────────────────────────────────────
  const loadFromDraft = useCallback((draft: InvoiceDraft) => {
    const lineItems: InvoiceLineItem[] = (draft.line_items || []).map((li, idx) => ({
      id: `draft-${idx}`,
      date: li.work_date ?? todayStr(),
      description: li.description ?? 'Legal Services',
      workType: li.work_type ?? 'other',
      hours: Number(li.hours),
      rate: Number(li.rate) || draft.hourly_rate,
      total: Number(li.total),
    }));

    setInvoice(prev => ({
      ...prev,
      invoiceNumber: generateInvoiceNumber(),
      issueDate: todayStr(),
      dueDate: dueDateStr(30),
      clientName: draft.client_name,
      clientEmail: draft.client_email,
      lineItems,
      notes: draft.notes ?? prev.notes,
    }));

    setView('builder');
  }, []);

  // ── Add blank line item ────────────────────────────────────────────────────
  const addLineItem = () => {
    setInvoice(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: `manual-${Date.now()}`,
          date: todayStr(),
          description: '',
          workType: 'other',
          hours: 1,
          rate: hourlyRate,
          total: hourlyRate,
        },
      ],
    }));
  };

  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setInvoice(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'hours' || field === 'rate') {
          updated.total = Number(updated.hours) * Number(updated.rate);
        }
        return updated;
      }),
    }));
  };

  const removeLineItem = (id: string) => {
    setInvoice(prev => ({ ...prev, lineItems: prev.lineItems.filter(i => i.id !== id) }));
  };

  // ── Print / Export PDF ─────────────────────────────────────────────────────
  const handlePrint = () => {
    setIsPrinting(true);
    setView('preview');
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  // ── Send Invoice Email ─────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!invoice.clientEmail) {
      setSendError('Please add a client email address in the Builder before sending.');
      return;
    }
    setSendingEmail(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const subtotal = invoice.lineItems.reduce((s, i) => s + i.total, 0);
      const taxAmount = subtotal * (invoice.taxRate / 100);
      const totalDue = subtotal + taxAmount;

      const res = await fetch('/api/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: invoice.clientEmail,
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          firmName: invoice.firmName,
          firmEmail: invoice.firmEmail,
          firmPhone: invoice.firmPhone,
          matterRef: invoice.matterRef,
          lineItems: invoice.lineItems,
          subtotal,
          taxRate: invoice.taxRate,
          taxAmount,
          totalDue,
          notes: invoice.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setSendSuccess(`Invoice sent to ${invoice.clientEmail}`);
      // Refresh logs
      fetchEmailLogs(invoice.invoiceNumber);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send invoice email');
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Fetch Email Logs ───────────────────────────────────────────────────────
  const fetchEmailLogs = async (invoiceNumber: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/invoices/send-email?invoiceNumber=${encodeURIComponent(invoiceNumber)}`);
      const data = await res.json();
      setEmailLogs(data.logs ?? []);
    } catch {
      setEmailLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const openSendModal = () => {
    setSendSuccess(null);
    setSendError(null);
    setShowSendModal(true);
    fetchEmailLogs(invoice.invoiceNumber);
  };

  // ── Toggle log selection ───────────────────────────────────────────────────
  const toggleLog = (id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedLogIds(new Set(unbilledLogs.map(l => l.id)));
  const clearAll = () => setSelectedLogIds(new Set());

  const subtotal = invoice.lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmount = subtotal * (invoice.taxRate / 100);
  const totalDue = subtotal + taxAmount;

  // ── PRINT STYLES ──────────────────────────────────────────────────────────
  // Injected via a style tag only when printing
  const printStyles = `
    @media print {
      body > * { display: none !important; }
      #lexi-invoice-print-wrapper { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: white; padding: 32px; }
    }
    @media screen {
      #lexi-invoice-print-wrapper { display: none; }
    }
  `;

  return (
    <>
      {/* Print-only overlay */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div id="lexi-invoice-print-wrapper" ref={printRef}>
        <InvoicePreview invoice={invoice} />
      </div>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {view !== 'list' && (
                <button
                  onClick={() => setView('list')}
                  className="p-1 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground mr-1"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              <span className="text-base">🧾</span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {view === 'list' ? 'Invoice Generator' : view === 'builder' ? 'Build Invoice' : 'Invoice Preview'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {view === 'list' ? 'Pull billable hours · Create & export' : view === 'builder' ? invoice.invoiceNumber : 'Ready to send or export as PDF'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {view === 'builder' && (
                <>
                  <button
                    onClick={() => setView('preview')}
                    className="px-2.5 py-1.5 rounded-lg border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={openSendModal}
                    disabled={invoice.lineItems.length === 0 || !invoice.clientEmail}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center gap-1"
                    title={!invoice.clientEmail ? 'Add client email first' : 'Send invoice by email'}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={invoice.lineItems.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    PDF
                  </button>
                </>
              )}
              {view === 'preview' && (
                <>
                  <button
                    onClick={openSendModal}
                    disabled={invoice.lineItems.length === 0 || !invoice.clientEmail}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center gap-1"
                    title={!invoice.clientEmail ? 'Add client email first' : 'Send invoice by email'}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    {isPrinting ? 'Opening…' : 'Print / Save PDF'}
                  </button>
                </>
              )}
              {view === 'list' && (
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {/* Unbilled Hours Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unbilled Hours</p>
                <div className="flex items-center gap-2">
                  {unbilledLogs.length > 0 && (
                    <>
                      <button onClick={selectAll} className="text-[10px] text-primary hover:underline">All</button>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground">None</button>
                    </>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col gap-1.5">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
                </div>
              ) : unbilledLogs.length === 0 ? (
                <div className="text-center py-6 bg-secondary/40 rounded-xl border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No unbilled hours found.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Log hours in the Hours tab to see them here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {unbilledLogs.map(log => {
                    const isSelected = selectedLogIds.has(log.id);
                    const clientName = (log.retainer_subscriptions as { customer_name: string } | null)?.customer_name ?? '—';
                    return (
                      <button
                        key={log.id}
                        onClick={() => toggleLog(log.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' :'border-border bg-background hover:border-primary/30 hover:bg-primary/3'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{clientName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{log.description ?? 'Legal Services'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-foreground">{Number(log.hours).toFixed(2)}h</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(log.work_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedLogIds.size > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold text-primary">{selectedLogIds.size} entry{selectedLogIds.size !== 1 ? 's' : ''} selected</p>
                      <p className="text-[10px] text-muted-foreground">
                        {unbilledLogs.filter(l => selectedLogIds.has(l.id)).reduce((s, l) => s + Number(l.hours), 0).toFixed(2)}h · {fmtCurrency(unbilledLogs.filter(l => selectedLogIds.has(l.id)).reduce((s, l) => s + Number(l.hours), 0) * hourlyRate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={hourlyRate}
                        onChange={e => setHourlyRate(Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-background border border-border rounded-lg text-xs text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        min={0}
                        step={25}
                      />
                      <span className="text-[10px] text-muted-foreground">/hr</span>
                    </div>
                  </div>
                  <button
                    onClick={buildInvoiceFromLogs}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                    Build Invoice from Selected Hours
                  </button>
                </div>
              )}
            </div>

            {/* Blank Invoice */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Start Fresh</p>
              <button
                onClick={() => {
                  setInvoice(prev => ({
                    ...prev,
                    invoiceNumber: generateInvoiceNumber(),
                    issueDate: todayStr(),
                    dueDate: dueDateStr(30),
                    clientName: clientName ?? '',
                    matterRef: caseRef ?? '',
                    lineItems: [],
                  }));
                  setView('builder');
                }}
                className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/3 transition-all flex items-center justify-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Blank Invoice
              </button>
            </div>

            {/* Pending Drafts */}
            {draftInvoices.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Pending Drafts</p>
                <div className="flex flex-col gap-1.5">
                  {draftInvoices.slice(0, 5).map(draft => (
                    <button
                      key={draft.id}
                      onClick={() => loadFromDraft(draft)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-sm shrink-0">📋</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{draft.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">{Number(draft.total_hours).toFixed(2)}h · {fmtCurrency(draft.subtotal)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                          draft.draft_status === 'pending_approval' ?'bg-amber-50 text-amber-700 border-amber-200' :'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {draft.draft_status === 'pending_approval' ? 'Pending' : draft.draft_status}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BUILDER VIEW ── */}
        {view === 'builder' && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {/* Invoice Meta */}
            <div className="bg-secondary/40 border border-border rounded-xl p-3 flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Invoice Details</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Invoice #</label>
                  <input
                    value={invoice.invoiceNumber}
                    onChange={e => setInvoice(p => ({ ...p, invoiceNumber: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Issue Date</label>
                  <input
                    type="date"
                    value={invoice.issueDate}
                    onChange={e => setInvoice(p => ({ ...p, issueDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Due Date</label>
                  <input
                    type="date"
                    value={invoice.dueDate}
                    onChange={e => setInvoice(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Tax Rate (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={invoice.taxRate}
                    onChange={e => setInvoice(p => ({ ...p, taxRate: Number(e.target.value) }))}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="bg-secondary/40 border border-border rounded-xl p-3 flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client</p>
              <input
                value={invoice.clientName}
                onChange={e => setInvoice(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Client name *"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                value={invoice.clientEmail}
                onChange={e => setInvoice(p => ({ ...p, clientEmail: e.target.value }))}
                placeholder="Client email"
                type="email"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                value={invoice.matterRef}
                onChange={e => setInvoice(p => ({ ...p, matterRef: e.target.value }))}
                placeholder="Matter / case reference"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Line Items</p>
                <button
                  onClick={addLineItem}
                  className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Row
                </button>
              </div>

              {invoice.lineItems.length === 0 ? (
                <div className="text-center py-5 bg-secondary/30 rounded-xl border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No line items yet.</p>
                  <button onClick={addLineItem} className="text-[10px] text-primary mt-1 hover:underline">+ Add a line item</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {invoice.lineItems.map((item) => (
                    <div key={item.id} className="bg-background border border-border rounded-xl p-2.5 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <input
                          value={item.description}
                          onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Description of work"
                          className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button
                          onClick={() => removeLineItem(item.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <div>
                          <label className="text-[9px] text-muted-foreground block mb-0.5">Date</label>
                          <input
                            type="date"
                            value={item.date}
                            onChange={e => updateLineItem(item.id, 'date', e.target.value)}
                            className="w-full px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground block mb-0.5">Hours</label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.25}
                            value={item.hours}
                            onChange={e => updateLineItem(item.id, 'hours', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground block mb-0.5">Rate</label>
                          <input
                            type="number"
                            min={0}
                            step={25}
                            value={item.rate}
                            onChange={e => updateLineItem(item.id, 'rate', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground block mb-0.5">Total</label>
                          <p className="px-2 py-1 text-[10px] font-semibold text-foreground text-center">{fmtCurrency(item.total)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Notes / Payment Terms</label>
              <textarea
                value={invoice.notes}
                onChange={e => setInvoice(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full px-2.5 py-2 bg-secondary border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Totals Summary */}
            {invoice.lineItems.length > 0 && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmtCurrency(subtotal)}</span>
                </div>
                {invoice.taxRate > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Tax ({invoice.taxRate}%)</span>
                    <span className="font-mono">{fmtCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-primary/20">
                  <span>Total Due</span>
                  <span className="font-mono text-primary">{fmtCurrency(totalDue)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setView('preview')}
                className="flex-1 py-2.5 border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handlePrint}
                disabled={invoice.lineItems.length === 0}
                className="flex-[2] py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Export as PDF
              </button>
            </div>
          </div>
        )}

        {/* ── PREVIEW VIEW ── */}
        {view === 'preview' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="bg-white rounded-xl border border-border shadow-sm p-5 text-xs">
                <InvoicePreview invoice={invoice} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SEND EMAIL MODAL ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <span className="text-base">📧</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Send Invoice</p>
                  <p className="text-[10px] text-muted-foreground">{invoice.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Recipient */}
              <div className="bg-secondary/40 border border-border rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recipient</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{invoice.clientName || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{invoice.clientEmail || 'No email set'}</p>
                  </div>
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="bg-secondary/40 border border-border rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Invoice Summary</p>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Invoice #</span>
                  <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-semibold text-foreground">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                </div>
                <div className="flex justify-between text-xs pt-1.5 border-t border-border">
                  <span className="font-bold text-foreground">Total Due</span>
                  <span className="font-bold text-primary">{fmtCurrency(totalDue)}</span>
                </div>
              </div>

              {/* Status Messages */}
              {sendSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-xs font-semibold text-emerald-700">{sendSuccess}</p>
                </div>
              )}
              {sendError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs text-red-600">{sendError}</p>
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !invoice.clientEmail}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    {sendSuccess ? 'Resend Invoice' : 'Send Invoice Email'}
                  </>
                )}
              </button>

              {/* Send History / Tracking */}
              <div>
                <button
                  onClick={() => setShowTrackingPanel(p => !p)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Send History
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`ml-auto transition-transform ${showTrackingPanel ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {showTrackingPanel && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {loadingLogs ? (
                      <div className="h-10 bg-secondary rounded-lg animate-pulse" />
                    ) : emailLogs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-3 bg-secondary/30 rounded-xl border border-dashed border-border">
                        No emails sent yet for this invoice.
                      </p>
                    ) : (
                      emailLogs.map(log => (
                        <div key={log.id} className="flex items-center gap-2.5 px-3 py-2 bg-secondary/40 border border-border rounded-xl">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-foreground truncate">{log.client_email}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(log.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium shrink-0">
                            {log.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
