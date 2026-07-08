'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailType = 'case_update' | 'invoice_delivery' | 'file_share' | 'stage_change';

interface ClientOption {
  id: string;
  name: string;
  email: string;
  service: string;
  booking_stage: string | null;
}

interface SendLog {
  id: string;
  type: EmailType;
  toEmail: string;
  toName: string;
  subject: string;
  status: 'sent' | 'failed';
  emailId?: string;
  error?: string;
  sentAt: string;
}

interface CaseUpdateForm {
  toEmail: string;
  toName: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  badge: string;
}

interface InvoiceDeliveryForm {
  toEmail: string;
  toName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  paymentLink: string;
  caseName: string;
  notes: string;
}

interface FileShareForm {
  toEmail: string;
  toName: string;
  fileName: string;
  fileDescription: string;
  caseName: string;
  caseRef: string;
  accessUrl: string;
  expiresAt: string;
  message: string;
}

interface StageChangeForm {
  toEmail: string;
  toName: string;
  caseName: string;
  caseRef: string;
  service: string;
  previousStage: string;
  newStage: string;
  stageMessage: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const EMAIL_TYPES: { id: EmailType; label: string; icon: string; color: string; bg: string; description: string }[] = [
  {
    id: 'case_update',
    label: 'Case Update',
    icon: '📋',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    description: 'Send a general case update or custom message to a client',
  },
  {
    id: 'invoice_delivery',
    label: 'Invoice Delivery',
    icon: '📄',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    description: 'Deliver an invoice with payment link directly to client',
  },
  {
    id: 'file_share',
    label: 'File Share',
    icon: '📁',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50 border-indigo-200',
    description: 'Notify a client that a document has been shared with them',
  },
  {
    id: 'stage_change',
    label: 'Stage Change',
    icon: '🔄',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    description: 'Notify a client when their case moves to a new stage',
  },
];

const CASE_STAGES = [
  { value: 'inquiry', label: 'Inquiry Received' },
  { value: 'in_review', label: 'Under Review' },
  { value: 'consultation_booked', label: 'Consultation Booked' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'active_client', label: 'Active Client' },
  { value: 'billed', label: 'Billed' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false, rows }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; rows?: number;
}) {
  const base = 'w-full border border-[#D9D0C5] rounded-lg px-3 py-2 text-sm text-[#2C1F14] bg-white focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A] placeholder-[#7A6B5D]/50';
  return (
    <div>
      <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {rows ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={base + ' resize-none'}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2 text-sm text-[#2C1F14] bg-white focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A]"
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TransactionalEmailCenter() {
  const [activeType, setActiveType] = useState<EmailType>('case_update');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [logs, setLogs] = useState<SendLog[]>([]);

  // Form states
  const [caseUpdateForm, setCaseUpdateForm] = useState<CaseUpdateForm>({
    toEmail: '', toName: '', subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', badge: 'Case Update',
  });
  const [invoiceForm, setInvoiceForm] = useState<InvoiceDeliveryForm>({
    toEmail: '', toName: '', invoiceNumber: '', invoiceDate: '', dueDate: '', amount: '', paymentLink: '', caseName: '', notes: '',
  });
  const [fileShareForm, setFileShareForm] = useState<FileShareForm>({
    toEmail: '', toName: '', fileName: '', fileDescription: '', caseName: '', caseRef: '', accessUrl: `${SITE_URL}/portal/files`, expiresAt: '', message: '',
  });
  const [stageChangeForm, setStageChangeForm] = useState<StageChangeForm>({
    toEmail: '', toName: '', caseName: '', caseRef: '', service: '', previousStage: '', newStage: '', stageMessage: '',
  });

  // Load clients
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('contact_inquiries')
      .select('id, name, email, service, booking_stage')
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setClients(data.map(r => ({ id: r.id, name: r.name || '', email: r.email || '', service: r.service || '', booking_stage: r.booking_stage })));
      });
  }, []);

  // Auto-fill email/name from selected client
  useEffect(() => {
    if (!selectedClientId) return;
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    const patch = { toEmail: client.email, toName: client.name };
    setCaseUpdateForm(f => ({ ...f, ...patch }));
    setInvoiceForm(f => ({ ...f, ...patch }));
    setFileShareForm(f => ({ ...f, ...patch }));
    setStageChangeForm(f => ({ ...f, ...patch, service: client.service, previousStage: client.booking_stage || '' }));
  }, [selectedClientId, clients]);

  const addLog = useCallback((log: SendLog) => {
    setLogs(prev => [log, ...prev].slice(0, 50));
  }, []);

  // ── Send handlers ──────────────────────────────────────────────────────────

  async function sendCaseUpdate() {
    const { toEmail, toName, subject, body } = caseUpdateForm;
    if (!toEmail || !toName || !subject || !body) {
      setSendResult({ success: false, message: 'Please fill in all required fields.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName,
          subject: caseUpdateForm.subject,
          badge: caseUpdateForm.badge || 'Case Update',
          heading: caseUpdateForm.heading || caseUpdateForm.subject,
          body: caseUpdateForm.body,
          ctaLabel: caseUpdateForm.ctaLabel || undefined,
          ctaUrl: caseUpdateForm.ctaUrl || undefined,
          eventType: 'case_update',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setSendResult({ success: true, message: `Email sent successfully (ID: ${data.emailId})` });
      addLog({ id: data.emailId || Date.now().toString(), type: 'case_update', toEmail, toName, subject, status: 'sent', emailId: data.emailId, sentAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setSendResult({ success: false, message: msg });
      addLog({ id: Date.now().toString(), type: 'case_update', toEmail, toName, subject, status: 'failed', error: msg, sentAt: new Date().toISOString() });
    } finally {
      setSending(false);
    }
  }

  async function sendInvoiceDelivery() {
    const { toEmail, toName, invoiceNumber, amount, dueDate } = invoiceForm;
    if (!toEmail || !toName || !invoiceNumber || !amount || !dueDate) {
      setSendResult({ success: false, message: 'Please fill in all required fields.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const subject = `Invoice #${invoiceForm.invoiceNumber} — $${invoiceForm.amount} Due ${invoiceForm.dueDate}`;
      const body = `Dear ${toName.split(' ')[0]},\n\nPlease find your invoice #${invoiceForm.invoiceNumber} for $${invoiceForm.amount} attached. Payment is due by ${invoiceForm.dueDate}.${invoiceForm.caseName ? `\n\nCase: ${invoiceForm.caseName}` : ''}${invoiceForm.notes ? `\n\n${invoiceForm.notes}` : ''}\n\nPlease use the link below to pay securely online.`;
      const res = await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          badge: 'Invoice',
          heading: `Invoice #${invoiceForm.invoiceNumber} — $${invoiceForm.amount}`,
          body,
          ctaLabel: invoiceForm.paymentLink ? 'Pay Invoice Now' : 'View in Portal',
          ctaUrl: invoiceForm.paymentLink || `${SITE_URL}/portal/invoices`,
          eventType: 'invoice',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setSendResult({ success: true, message: `Invoice email sent (ID: ${data.emailId})` });
      addLog({ id: data.emailId || Date.now().toString(), type: 'invoice_delivery', toEmail, toName, subject, status: 'sent', emailId: data.emailId, sentAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setSendResult({ success: false, message: msg });
      addLog({ id: Date.now().toString(), type: 'invoice_delivery', toEmail, toName, subject: `Invoice #${invoiceForm.invoiceNumber}`, status: 'failed', error: msg, sentAt: new Date().toISOString() });
    } finally {
      setSending(false);
    }
  }

  async function sendFileShare() {
    const { toEmail, toName, fileName } = fileShareForm;
    if (!toEmail || !toName || !fileName) {
      setSendResult({ success: false, message: 'Please fill in all required fields.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/notifications/send-file-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName,
          fileName: fileShareForm.fileName,
          fileDescription: fileShareForm.fileDescription || undefined,
          caseName: fileShareForm.caseName || undefined,
          caseRef: fileShareForm.caseRef || undefined,
          accessUrl: fileShareForm.accessUrl || undefined,
          expiresAt: fileShareForm.expiresAt || undefined,
          message: fileShareForm.message || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      const subject = `Document Shared: ${fileName}`;
      setSendResult({ success: true, message: `File share email sent (ID: ${data.emailId})` });
      addLog({ id: data.emailId || Date.now().toString(), type: 'file_share', toEmail, toName, subject, status: 'sent', emailId: data.emailId, sentAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setSendResult({ success: false, message: msg });
      addLog({ id: Date.now().toString(), type: 'file_share', toEmail, toName, subject: `File: ${fileShareForm.fileName}`, status: 'failed', error: msg, sentAt: new Date().toISOString() });
    } finally {
      setSending(false);
    }
  }

  async function sendStageChange() {
    const { toEmail, toName, caseName, newStage } = stageChangeForm;
    if (!toEmail || !toName || !caseName || !newStage) {
      setSendResult({ success: false, message: 'Please fill in all required fields.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const stageLabel = CASE_STAGES.find(s => s.value === newStage)?.label || newStage;
      const res = await fetch('/api/case-lifecycle/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'case_stage_changed',
          clientEmail: toEmail,
          clientName: toName,
          details: {
            caseName,
            caseId: stageChangeForm.caseRef || 'N/A',
            service: stageChangeForm.service || 'Legal Services',
            previousStage: stageChangeForm.previousStage,
            newStage,
            stageLabel,
            message: stageChangeForm.stageMessage || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      const subject = `Case Update — ${caseName} is now ${stageLabel}`;
      setSendResult({ success: true, message: `Stage change email sent (ID: ${data.emailId})` });
      addLog({ id: data.emailId || Date.now().toString(), type: 'stage_change', toEmail, toName, subject, status: 'sent', emailId: data.emailId, sentAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setSendResult({ success: false, message: msg });
      addLog({ id: Date.now().toString(), type: 'stage_change', toEmail, toName, subject: `Stage: ${stageChangeForm.newStage}`, status: 'failed', error: msg, sentAt: new Date().toISOString() });
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    setSendResult(null);
    if (activeType === 'case_update') sendCaseUpdate();
    else if (activeType === 'invoice_delivery') sendInvoiceDelivery();
    else if (activeType === 'file_share') sendFileShare();
    else if (activeType === 'stage_change') sendStageChange();
  }

  const activeConfig = EMAIL_TYPES.find(t => t.id === activeType)!;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#2C1F14]" style={{ fontFamily: 'Georgia, serif' }}>
            Transactional Email Center
          </h2>
          <p className="text-sm text-[#7A6B5D] mt-1">
            Send branded client emails for case updates, invoices, file shares, and stage changes via Resend
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#D9D0C5] rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs text-[#4A3728] font-medium">Resend Connected</span>
        </div>
      </div>

      {/* Email Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EMAIL_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => { setActiveType(type.id); setSendResult(null); }}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              activeType === type.id
                ? `${type.bg} border-current ${type.color} shadow-sm`
                : 'bg-white border-[#D9D0C5] text-[#7A6B5D] hover:border-[#C8965A]/50'
            }`}
          >
            <div className="text-2xl mb-2">{type.icon}</div>
            <div className="text-sm font-semibold">{type.label}</div>
            <div className="text-xs mt-1 opacity-75 leading-tight">{type.description}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Compose Panel */}
        <div className="lg:col-span-2 bg-white border border-[#D9D0C5] rounded-xl overflow-hidden">
          {/* Panel header */}
          <div className="bg-[#4A3728] px-6 py-4 flex items-center gap-3">
            <span className="text-xl">{activeConfig.icon}</span>
            <div>
              <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                {activeConfig.label}
              </h3>
              <p className="text-[#C8965A] text-xs">{activeConfig.description}</p>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Client quick-fill */}
            <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-lg p-4">
              <label className="block text-xs font-semibold text-[#4A3728] uppercase tracking-wide mb-2">
                Quick-fill from Client
              </label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2 text-sm text-[#2C1F14] bg-white focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A]"
              >
                <option value="">— Select a client to auto-fill —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                ))}
              </select>
            </div>

            {/* ── Case Update Form ── */}
            {activeType === 'case_update' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Client Email" value={caseUpdateForm.toEmail} onChange={v => setCaseUpdateForm(f => ({ ...f, toEmail: v }))} type="email" placeholder="client@example.com" required />
                  <InputField label="Client Name" value={caseUpdateForm.toName} onChange={v => setCaseUpdateForm(f => ({ ...f, toName: v }))} placeholder="Jane Smith" required />
                </div>
                <InputField label="Subject Line" value={caseUpdateForm.subject} onChange={v => setCaseUpdateForm(f => ({ ...f, subject: v }))} placeholder="Update on Your Case — Broussard Legal" required />
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Badge Label" value={caseUpdateForm.badge} onChange={v => setCaseUpdateForm(f => ({ ...f, badge: v }))} placeholder="Case Update" />
                  <InputField label="Email Heading" value={caseUpdateForm.heading} onChange={v => setCaseUpdateForm(f => ({ ...f, heading: v }))} placeholder="Optional heading override" />
                </div>
                <InputField label="Message Body" value={caseUpdateForm.body} onChange={v => setCaseUpdateForm(f => ({ ...f, body: v }))} placeholder="Write your message here. Use line breaks for paragraphs." required rows={5} />
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="CTA Button Label" value={caseUpdateForm.ctaLabel} onChange={v => setCaseUpdateForm(f => ({ ...f, ctaLabel: v }))} placeholder="View in Portal" />
                  <InputField label="CTA Button URL" value={caseUpdateForm.ctaUrl} onChange={v => setCaseUpdateForm(f => ({ ...f, ctaUrl: v }))} placeholder="https://..." />
                </div>
              </div>
            )}

            {/* ── Invoice Delivery Form ── */}
            {activeType === 'invoice_delivery' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Client Email" value={invoiceForm.toEmail} onChange={v => setInvoiceForm(f => ({ ...f, toEmail: v }))} type="email" placeholder="client@example.com" required />
                  <InputField label="Client Name" value={invoiceForm.toName} onChange={v => setInvoiceForm(f => ({ ...f, toName: v }))} placeholder="Jane Smith" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Invoice Number" value={invoiceForm.invoiceNumber} onChange={v => setInvoiceForm(f => ({ ...f, invoiceNumber: v }))} placeholder="INV-2026-001" required />
                  <InputField label="Amount Due ($)" value={invoiceForm.amount} onChange={v => setInvoiceForm(f => ({ ...f, amount: v }))} placeholder="500.00" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Invoice Date" value={invoiceForm.invoiceDate} onChange={v => setInvoiceForm(f => ({ ...f, invoiceDate: v }))} type="date" />
                  <InputField label="Due Date" value={invoiceForm.dueDate} onChange={v => setInvoiceForm(f => ({ ...f, dueDate: v }))} type="date" required />
                </div>
                <InputField label="Case / Matter Name" value={invoiceForm.caseName} onChange={v => setInvoiceForm(f => ({ ...f, caseName: v }))} placeholder="Smith Family Trust Matter" />
                <InputField label="Payment Link (Stripe / Portal)" value={invoiceForm.paymentLink} onChange={v => setInvoiceForm(f => ({ ...f, paymentLink: v }))} placeholder="https://pay.stripe.com/..." />
                <InputField label="Additional Notes" value={invoiceForm.notes} onChange={v => setInvoiceForm(f => ({ ...f, notes: v }))} placeholder="Optional notes to include in the email" rows={3} />
              </div>
            )}

            {/* ── File Share Form ── */}
            {activeType === 'file_share' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Client Email" value={fileShareForm.toEmail} onChange={v => setFileShareForm(f => ({ ...f, toEmail: v }))} type="email" placeholder="client@example.com" required />
                  <InputField label="Client Name" value={fileShareForm.toName} onChange={v => setFileShareForm(f => ({ ...f, toName: v }))} placeholder="Jane Smith" required />
                </div>
                <InputField label="File Name" value={fileShareForm.fileName} onChange={v => setFileShareForm(f => ({ ...f, fileName: v }))} placeholder="Retainer_Agreement_Smith.pdf" required />
                <InputField label="File Description" value={fileShareForm.fileDescription} onChange={v => setFileShareForm(f => ({ ...f, fileDescription: v }))} placeholder="Signed retainer agreement for review" />
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Case / Matter Name" value={fileShareForm.caseName} onChange={v => setFileShareForm(f => ({ ...f, caseName: v }))} placeholder="Smith Family Trust" />
                  <InputField label="Case Reference #" value={fileShareForm.caseRef} onChange={v => setFileShareForm(f => ({ ...f, caseRef: v }))} placeholder="CASE-001" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Access URL" value={fileShareForm.accessUrl} onChange={v => setFileShareForm(f => ({ ...f, accessUrl: v }))} placeholder={`${SITE_URL}/portal/files`} />
                  <InputField label="Access Expires" value={fileShareForm.expiresAt} onChange={v => setFileShareForm(f => ({ ...f, expiresAt: v }))} placeholder="e.g. July 30, 2026" />
                </div>
                <InputField label="Personal Note to Client" value={fileShareForm.message} onChange={v => setFileShareForm(f => ({ ...f, message: v }))} placeholder="Optional personal note to include in the email" rows={3} />
              </div>
            )}

            {/* ── Stage Change Form ── */}
            {activeType === 'stage_change' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Client Email" value={stageChangeForm.toEmail} onChange={v => setStageChangeForm(f => ({ ...f, toEmail: v }))} type="email" placeholder="client@example.com" required />
                  <InputField label="Client Name" value={stageChangeForm.toName} onChange={v => setStageChangeForm(f => ({ ...f, toName: v }))} placeholder="Jane Smith" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Case / Matter Name" value={stageChangeForm.caseName} onChange={v => setStageChangeForm(f => ({ ...f, caseName: v }))} placeholder="Smith Family Trust" required />
                  <InputField label="Case Reference #" value={stageChangeForm.caseRef} onChange={v => setStageChangeForm(f => ({ ...f, caseRef: v }))} placeholder="CASE-001" />
                </div>
                <InputField label="Service / Practice Area" value={stageChangeForm.service} onChange={v => setStageChangeForm(f => ({ ...f, service: v }))} placeholder="Estate Planning" />
                <div className="grid grid-cols-2 gap-4">
                  <SelectField label="Previous Stage" value={stageChangeForm.previousStage} onChange={v => setStageChangeForm(f => ({ ...f, previousStage: v }))} options={CASE_STAGES} />
                  <SelectField label="New Stage" value={stageChangeForm.newStage} onChange={v => setStageChangeForm(f => ({ ...f, newStage: v }))} options={CASE_STAGES} required />
                </div>
                <InputField label="Custom Message to Client" value={stageChangeForm.stageMessage} onChange={v => setStageChangeForm(f => ({ ...f, stageMessage: v }))} placeholder="Optional personal note about this stage change" rows={3} />
              </div>
            )}

            {/* Send result */}
            {sendResult && (
              <div className={`flex items-start gap-3 p-4 rounded-lg border ${sendResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span className="text-lg">{sendResult.success ? '✅' : '❌'}</span>
                <p className="text-sm">{sendResult.message}</p>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-[#4A3728] hover:bg-[#3A2A1E] disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {sending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending via Resend...
                </>
              ) : (
                <>
                  <span>{activeConfig.icon}</span>
                  Send {activeConfig.label} Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Send Log Panel */}
        <div className="bg-white border border-[#D9D0C5] rounded-xl overflow-hidden">
          <div className="bg-[#FAF7F2] border-b border-[#D9D0C5] px-5 py-4">
            <h3 className="text-sm font-semibold text-[#4A3728]" style={{ fontFamily: 'Georgia, serif' }}>
              Send Log
            </h3>
            <p className="text-xs text-[#7A6B5D] mt-0.5">Emails sent this session</p>
          </div>
          <div className="divide-y divide-[#EDE8E0] max-h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">📬</div>
                <p className="text-sm text-[#7A6B5D]">No emails sent yet</p>
                <p className="text-xs text-[#7A6B5D] mt-1">Sent emails will appear here</p>
              </div>
            ) : (
              logs.map(log => {
                const typeConfig = EMAIL_TYPES.find(t => t.id === log.type);
                return (
                  <div key={log.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{typeConfig?.icon}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                      </div>
                      <span className="text-xs text-[#7A6B5D] whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#2C1F14] truncate">{log.toName}</p>
                    <p className="text-xs text-[#7A6B5D] truncate">{log.toEmail}</p>
                    <p className="text-xs text-[#4A3728] mt-1 truncate opacity-75">{log.subject}</p>
                    {log.error && <p className="text-xs text-red-600 mt-1 truncate">{log.error}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Info footer */}
      <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {EMAIL_TYPES.map(type => (
            <div key={type.id} className="flex items-start gap-3">
              <span className="text-xl">{type.icon}</span>
              <div>
                <p className="text-xs font-semibold text-[#4A3728]">{type.label}</p>
                <p className="text-xs text-[#7A6B5D] leading-relaxed mt-0.5">{type.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#D9D0C5] flex items-center gap-2">
          <svg className="w-4 h-4 text-[#C8965A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-[#7A6B5D]">
            All emails are sent via <strong className="text-[#4A3728]">Resend</strong> using your branded Broussard Legal Services template. Delivery is tracked in real time.
          </p>
        </div>
      </div>

    </div>
  );
}
