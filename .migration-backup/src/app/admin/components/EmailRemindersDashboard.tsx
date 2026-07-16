'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: string;
  recipient_name: string;
  recipient_email: string;
  recipient_type: 'client' | 'staff';
  email_type: 'case_update' | 'invoice_reminder' | 'document_confirmation';
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  error?: string | null;
}

interface CaseItem {
  id: string;
  name: string;
  service: string;
  status: string;
  client_name: string;
  client_email: string;
  assigned_paralegal?: string;
  paralegal_email?: string;
  updated_at: string;
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  payment_link?: string;
}

interface DocumentRequest {
  id: string;
  document_type: string;
  description: string | null;
  status: 'pending' | 'in_review' | 'fulfilled' | 'declined';
  created_at: string;
  client_name?: string;
  client_email?: string;
  inquiry_id: string;
}

interface SendResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

type Tab = 'case_updates' | 'invoice_reminders' | 'doc_confirmations' | 'email_logs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysOverdue(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    active: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmailRemindersDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('case_updates');

  // Data
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Loading/sending state
  const [loadingData, setLoadingData] = useState(true);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom message overrides per item
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});

  // KPI counts
  const [kpis, setKpis] = useState({ totalSent: 0, totalFailed: 0, caseEmails: 0, invoiceEmails: 0, docEmails: 0 });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── Fetch Data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      // Cases
      const { data: casesData } = await supabase
        .from('contact_inquiries')
        .select('id, name, firm, email, service, status, updated_at')
        .in('status', ['active', 'in_progress', 'pending', 'open'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (casesData) {
        setCases(
          casesData.map((c) => ({
            id: c.id,
            name: c.firm || c.name,
            service: c.service,
            status: c.status,
            client_name: c.name,
            client_email: c.email,
            updated_at: c.updated_at,
          }))
        );
      }

      // Overdue invoices
      const { data: invData } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, client_name, client_email, total_amount, due_date, payment_link')
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(50);

      if (invData) {
        setInvoices(
          invData.map((inv) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            client_name: inv.client_name,
            client_email: inv.client_email,
            amount: inv.total_amount,
            due_date: inv.due_date,
            days_overdue: getDaysOverdue(inv.due_date),
            payment_link: inv.payment_link,
          }))
        );
      }

      // Document requests
      const { data: docData } = await supabase
        .from('client_document_requests')
        .select('id, document_type, description, status, created_at, inquiry_id')
        .in('status', ['pending', 'in_review', 'fulfilled'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (docData) {
        // Enrich with client info from contact_inquiries
        const inquiryIds = [...new Set(docData.map((d) => d.inquiry_id).filter(Boolean))];
        let inquiryMap: Record<string, { name: string; email: string }> = {};
        if (inquiryIds.length > 0) {
          const { data: inqData } = await supabase
            .from('contact_inquiries')
            .select('id, name, email')
            .in('id', inquiryIds);
          if (inqData) {
            inqData.forEach((inq) => {
              inquiryMap[inq.id] = { name: inq.name, email: inq.email };
            });
          }
        }
        setDocRequests(
          docData.map((d) => ({
            id: d.id,
            document_type: d.document_type,
            description: d.description,
            status: d.status,
            created_at: d.created_at,
            inquiry_id: d.inquiry_id,
            client_name: inquiryMap[d.inquiry_id]?.name,
            client_email: inquiryMap[d.inquiry_id]?.email,
          }))
        );
      }

      // Email logs from email_send_log or fallback to local state
      const { data: logData } = await supabase
        .from('email_send_log')
        .select('*')
        .in('email_type', ['case_update', 'invoice_reminder', 'document_confirmation'])
        .order('sent_at', { ascending: false })
        .limit(100);

      if (logData) {
        setEmailLogs(logData as EmailLog[]);
        setKpis({
          totalSent: logData.filter((l) => l.status === 'sent').length,
          totalFailed: logData.filter((l) => l.status === 'failed').length,
          caseEmails: logData.filter((l) => l.email_type === 'case_update').length,
          invoiceEmails: logData.filter((l) => l.email_type === 'invoice_reminder').length,
          docEmails: logData.filter((l) => l.email_type === 'document_confirmation').length,
        });
      }
    } catch (err) {
      console.error('EmailRemindersDashboard fetch error:', err);
    } finally {
      setLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Send Email ──────────────────────────────────────────────────────────────

  async function sendEmail(
    type: 'case_update' | 'invoice_reminder' | 'document_confirmation',
    itemId: string,
    payload: {
      recipientName: string;
      recipientEmail: string;
      recipientType: 'client' | 'staff';
      subject: string;
      bodyHtml: string;
    }
  ): Promise<SendResult> {
    const res = await fetch('/api/admin/send-automated-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, itemId, ...payload }),
    });
    const data = await res.json();
    return data;
  }

  // ── Case Update Send ────────────────────────────────────────────────────────

  async function handleSendCaseUpdate(c: CaseItem) {
    setSendingIds((prev) => new Set(prev).add(c.id));
    const customMsg = customMessages[c.id] || '';
    const subject = `Case Update: ${c.name} — Maggi May Broussard`;
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Dear ${c.client_name.split(' ')[0]},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        We wanted to provide you with an update on your <strong>${c.service}</strong> matter (<em>${c.name}</em>).
        ${customMsg ? `</p><p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">${customMsg}` : ''}
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        Current status: <strong>${c.status.replace(/_/g, ' ')}</strong>. You can view full details and communicate with our team through your client portal.
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
        <tr>
          <td style="background-color:#C8965A;border-radius:7px;">
            <a href="https://broussardlegalservices.com/portal/hub" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Case Updates &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services</p>
    `;
    const result = await sendEmail('case_update', c.id, {
      recipientName: c.client_name,
      recipientEmail: c.client_email,
      recipientType: 'client',
      subject,
      bodyHtml,
    });
    setSendingIds((prev) => { const s = new Set(prev); s.delete(c.id); return s; });
    if (result.success) {
      showToast('success', `Case update sent to ${c.client_name}`);
      fetchData();
    } else {
      showToast('error', result.error || 'Failed to send email');
    }
  }

  async function handleSendAllCaseUpdates() {
    setSendingAll(true);
    let sent = 0, failed = 0;
    for (const c of cases) {
      const result = await sendEmail('case_update', c.id, {
        recipientName: c.client_name,
        recipientEmail: c.client_email,
        recipientType: 'client',
        subject: `Case Update: ${c.name} — Maggi May Broussard`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Dear ${c.client_name.split(' ')[0]},</p><p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">This is an automated update for your <strong>${c.service}</strong> matter. Current status: <strong>${c.status.replace(/_/g, ' ')}</strong>. Please log in to your portal for full details.</p><p style="margin:0;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Warm regards,<br/><strong>Maggi May Broussard</strong></p>`,
      });
      if (result.success) sent++; else failed++;
    }
    setSendingAll(false);
    showToast(failed === 0 ? 'success' : 'error', `Sent ${sent} case updates${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchData();
  }

  // ── Invoice Reminder Send ───────────────────────────────────────────────────

  async function handleSendInvoiceReminder(inv: OverdueInvoice) {
    setSendingIds((prev) => new Set(prev).add(inv.id));
    const subject = `Payment Reminder: Invoice ${inv.invoice_number} — ${inv.days_overdue} Days Overdue`;
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Dear ${inv.client_name.split(' ')[0]},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        This is a friendly reminder that Invoice <strong>${inv.invoice_number}</strong> for <strong>${formatCurrency(inv.amount)}</strong> was due on <strong>${formatDate(inv.due_date)}</strong> and is now <strong>${inv.days_overdue} day${inv.days_overdue !== 1 ? 's' : ''} overdue</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        Please arrange payment at your earliest convenience to avoid any interruption to your legal services.
      </p>
      ${inv.payment_link ? `
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
        <tr>
          <td style="background-color:#C8965A;border-radius:7px;">
            <a href="${inv.payment_link}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Pay Now &rarr;</a>
          </td>
        </tr>
      </table>` : `
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
        <tr>
          <td style="background-color:#C8965A;border-radius:7px;">
            <a href="https://broussardlegalservices.com/portal/invoices" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Invoice &rarr;</a>
          </td>
        </tr>
      </table>`}
      <p style="margin:0;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services</p>
    `;
    const result = await sendEmail('invoice_reminder', inv.id, {
      recipientName: inv.client_name,
      recipientEmail: inv.client_email,
      recipientType: 'client',
      subject,
      bodyHtml,
    });
    setSendingIds((prev) => { const s = new Set(prev); s.delete(inv.id); return s; });
    if (result.success) {
      showToast('success', `Invoice reminder sent to ${inv.client_name}`);
      fetchData();
    } else {
      showToast('error', result.error || 'Failed to send reminder');
    }
  }

  async function handleSendAllInvoiceReminders() {
    setSendingAll(true);
    let sent = 0, failed = 0;
    for (const inv of invoices) {
      const result = await sendEmail('invoice_reminder', inv.id, {
        recipientName: inv.client_name,
        recipientEmail: inv.client_email,
        recipientType: 'client',
        subject: `Payment Reminder: Invoice ${inv.invoice_number} — ${inv.days_overdue} Days Overdue`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Dear ${inv.client_name.split(' ')[0]},</p><p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Invoice <strong>${inv.invoice_number}</strong> for <strong>${formatCurrency(inv.amount)}</strong> is <strong>${inv.days_overdue} days overdue</strong>. Please arrange payment at your earliest convenience.</p>${inv.payment_link ? `<a href="${inv.payment_link}" style="display:inline-block;padding:13px 28px;background:#C8965A;color:#fff;text-decoration:none;border-radius:7px;font-family:Georgia,serif;font-weight:bold;">Pay Now &rarr;</a>` : ''}<p style="margin:16px 0 0;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Warm regards,<br/><strong>Maggi May Broussard</strong></p>`,
      });
      if (result.success) sent++; else failed++;
    }
    setSendingAll(false);
    showToast(failed === 0 ? 'success' : 'error', `Sent ${sent} invoice reminders${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchData();
  }

  // ── Document Confirmation Send ──────────────────────────────────────────────

  async function handleSendDocConfirmation(doc: DocumentRequest) {
    if (!doc.client_email) {
      showToast('error', 'No client email found for this request');
      return;
    }
    setSendingIds((prev) => new Set(prev).add(doc.id));
    const statusLabel = doc.status === 'pending' ? 'received and is under review'
      : doc.status === 'in_review' ? 'currently being reviewed by our team'
      : doc.status === 'fulfilled' ? 'fulfilled — the requested documents are ready'
      : 'declined';
    const subject = `Document Request Update: ${doc.document_type} — Maggi May Broussard`;
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Dear ${(doc.client_name || 'Client').split(' ')[0]},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        We are writing to confirm the status of your document request for <strong>${doc.document_type}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">
        Your request has been <strong>${statusLabel}</strong>.
        ${doc.description ? `<br/>Request details: <em>${doc.description}</em>` : ''}
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
        <tr>
          <td style="background-color:#C8965A;border-radius:7px;">
            <a href="https://broussardlegalservices.com/portal/hub" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View in Client Hub &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:15px;color:#2C1F14;line-height:1.8;font-family:Georgia,serif;">Warm regards,<br/><strong>Maggi May Broussard</strong><br/>Paralegal Services</p>
    `;
    const result = await sendEmail('document_confirmation', doc.id, {
      recipientName: doc.client_name || 'Client',
      recipientEmail: doc.client_email,
      recipientType: 'client',
      subject,
      bodyHtml,
    });
    setSendingIds((prev) => { const s = new Set(prev); s.delete(doc.id); return s; });
    if (result.success) {
      showToast('success', `Document confirmation sent to ${doc.client_name}`);
      fetchData();
    } else {
      showToast('error', result.error || 'Failed to send confirmation');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'case_updates', label: 'Case Updates', count: cases.length },
    { id: 'invoice_reminders', label: 'Invoice Reminders', count: invoices.length },
    { id: 'doc_confirmations', label: 'Doc Confirmations', count: docRequests.length },
    { id: 'email_logs', label: 'Email Logs', count: emailLogs.length },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toastMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toastMsg.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          )}
          {toastMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Reminders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Send automated case updates, invoice reminders, and document confirmations via Resend</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Resend
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Sent', value: kpis.totalSent, color: 'text-emerald-600' },
          { label: 'Failed', value: kpis.totalFailed, color: 'text-red-600' },
          { label: 'Case Emails', value: kpis.caseEmails, color: 'text-blue-600' },
          { label: 'Invoice Emails', value: kpis.invoiceEmails, color: 'text-amber-600' },
          { label: 'Doc Emails', value: kpis.docEmails, color: 'text-violet-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border/60 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Case Updates Tab ── */}
      {activeTab === 'case_updates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{cases.length} active matter{cases.length !== 1 ? 's' : ''} — send status updates to clients</p>
            <button
              onClick={handleSendAllCaseUpdates}
              disabled={sendingAll || cases.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {sendingAll ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              )}
              Send All Updates
            </button>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No active matters found</div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div key={c.id} className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.client_name} · {c.client_email}</p>
                      <p className="text-xs text-muted-foreground">{c.service} · Updated {formatDate(c.updated_at)}</p>
                      <textarea
                        value={customMessages[c.id] || ''}
                        onChange={(e) => setCustomMessages((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Optional: add a custom message to include in the update email..."
                        rows={2}
                        className="mt-2 w-full text-xs border border-border/60 rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <button
                      onClick={() => handleSendCaseUpdate(c)}
                      disabled={sendingIds.has(c.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {sendingIds.has(c.id) ? (
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                      Send Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invoice Reminders Tab ── */}
      {activeTab === 'invoice_reminders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{invoices.length} overdue invoice{invoices.length !== 1 ? 's' : ''} — send payment reminders to clients</p>
            <button
              onClick={handleSendAllInvoiceReminders}
              disabled={sendingAll || invoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {sendingAll ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              )}
              Send All Reminders
            </button>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No overdue invoices found</div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground">{inv.invoice_number}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          {inv.days_overdue}d overdue
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{inv.client_name} · {inv.client_email}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(inv.amount)} · Due {formatDate(inv.due_date)}</p>
                    </div>
                    <button
                      onClick={() => handleSendInvoiceReminder(inv)}
                      disabled={sendingIds.has(inv.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {sendingIds.has(inv.id) ? (
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                      Send Reminder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Document Confirmations Tab ── */}
      {activeTab === 'doc_confirmations' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{docRequests.length} document request{docRequests.length !== 1 ? 's' : ''} — send status confirmations to clients</p>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : docRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No document requests found</div>
          ) : (
            <div className="space-y-3">
              {docRequests.map((doc) => (
                <div key={doc.id} className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground">{doc.document_type}</p>
                        <StatusBadge status={doc.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.client_name ? `${doc.client_name} · ${doc.client_email}` : 'Client info not available'}
                      </p>
                      {doc.description && <p className="text-xs text-muted-foreground italic">{doc.description}</p>}
                      <p className="text-xs text-muted-foreground">Requested {formatDate(doc.created_at)}</p>
                    </div>
                    <button
                      onClick={() => handleSendDocConfirmation(doc)}
                      disabled={sendingIds.has(doc.id) || !doc.client_email}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {sendingIds.has(doc.id) ? (
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                      Send Confirmation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Email Logs Tab ── */}
      {activeTab === 'email_logs' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{emailLogs.length} automated email{emailLogs.length !== 1 ? 's' : ''} sent</p>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No email logs yet — send your first automated email above</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log, idx) => (
                    <tr key={log.id} className={`border-b border-border/40 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-xs">{log.recipient_name}</p>
                        <p className="text-muted-foreground text-xs">{log.recipient_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          log.email_type === 'case_update' ? 'bg-blue-100 text-blue-700'
                          : log.email_type === 'invoice_reminder'? 'bg-amber-100 text-amber-700' :'bg-violet-100 text-violet-700'
                        }`}>
                          {log.email_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-xs truncate">{log.subject}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.sent_at)}</td>
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
