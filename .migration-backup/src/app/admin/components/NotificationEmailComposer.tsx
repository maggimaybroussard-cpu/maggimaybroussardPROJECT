'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailType = 'case_update' | 'invoice' | 'task';

interface NotificationTemplate {
  id: string;
  type: EmailType;
  label: string;
  description: string;
  triggerEvent: string;
  defaultSubject: string;
  defaultBody: string;
  defaultBadge: string;
  defaultHeading: string;
  defaultCtaLabel: string;
  defaultCtaUrl: string;
  variables: string[];
}

interface ComposerState {
  subject: string;
  body: string;
  badge: string;
  heading: string;
  ctaLabel: string;
  ctaUrl: string;
  brandAccentColor: string;
  brandHeaderColor: string;
  signatureName: string;
  signatureTitle: string;
  signatureEmail: string;
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
}

// ─── Template Definitions ─────────────────────────────────────────────────────

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // ── Case Updates ──
  {
    id: 'case_status_update',
    type: 'case_update',
    label: 'Case Status Update',
    description: 'Notify a client when their case stage changes (e.g., Intake → Active).',
    triggerEvent: 'Case stage or status changed',
    defaultSubject: 'Update on your case — {{caseName}}',
    defaultBadge: 'Case Update',
    defaultHeading: 'Update on Your Case, {{firstName}}',
    defaultBody: `Hi {{firstName}},

I wanted to let you know that there has been an update on your {{caseName}} matter.

Case: {{caseName}}
New Status: {{newStatus}}
Updated: {{updateDate}}

Please log in to your client portal to view the full details and any new documents or notes that have been added to your case file.

If you have any questions, please reply to this email.`,
    defaultCtaLabel: 'View Case in Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    variables: ['{{firstName}}', '{{caseName}}', '{{newStatus}}', '{{previousStatus}}', '{{updateDate}}', '{{siteUrl}}'],
  },
  {
    id: 'case_document_added',
    type: 'case_update',
    label: 'Document Added to Case',
    description: 'Alert a client when a new document is uploaded to their case file.',
    triggerEvent: 'Document uploaded to case',
    defaultSubject: 'New document added to your case — {{caseName}}',
    defaultBadge: 'Document Added',
    defaultHeading: 'New Document Added to Your Case',
    defaultBody: `Hi {{firstName}},

A new document has been added to your {{caseName}} case file.

Document: {{documentName}}
Case: {{caseName}}
Added: {{uploadDate}}

You can view and download this document by logging in to your client portal. If you have any questions about this document, please reply to this email.`,
    defaultCtaLabel: 'View Document',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    variables: ['{{firstName}}', '{{caseName}}', '{{documentName}}', '{{uploadDate}}', '{{siteUrl}}'],
  },
  {
    id: 'case_milestone',
    type: 'case_update',
    label: 'Case Milestone Reached',
    description: 'Celebrate a key milestone with your client (e.g., retainer signed, draft complete).',
    triggerEvent: 'Case milestone completed',
    defaultSubject: 'Milestone reached on your case — {{caseName}}',
    defaultBadge: 'Milestone Reached',
    defaultHeading: 'Great Progress on Your Case, {{firstName}}',
    defaultBody: `Hi {{firstName}},

I am pleased to let you know that we have reached an important milestone on your {{caseName}} matter.

Milestone: {{milestoneTitle}}
Case: {{caseName}}
Date: {{milestoneDate}}

This is a significant step forward. I will continue to keep you updated as we progress. Please do not hesitate to reach out if you have any questions.`,
    defaultCtaLabel: 'View Your Case',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    variables: ['{{firstName}}', '{{caseName}}', '{{milestoneTitle}}', '{{milestoneDate}}', '{{siteUrl}}'],
  },
  // ── Invoices ──
  {
    id: 'invoice_issued_custom',
    type: 'invoice',
    label: 'Invoice Issued',
    description: 'Send a customized invoice notification when a new invoice is ready for payment.',
    triggerEvent: 'Invoice created and issued',
    defaultSubject: 'Invoice #{{invoiceNumber}} — {{amount}} due {{dueDate}}',
    defaultBadge: 'Invoice Ready',
    defaultHeading: 'Invoice #{{invoiceNumber}} — {{amount}} Due',
    defaultBody: `Hi {{firstName}},

Please find your invoice for {{serviceName}} attached to this email.

Invoice #{{invoiceNumber}}
Amount Due: {{amount}}
Due Date: {{dueDate}}

You can pay securely online using the button below. If you have any questions about this invoice, please reply to this email.`,
    defaultCtaLabel: 'Pay Invoice Now',
    defaultCtaUrl: '{{paymentLink}}',
    variables: ['{{firstName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{serviceName}}', '{{paymentLink}}'],
  },
  {
    id: 'invoice_reminder_custom',
    type: 'invoice',
    label: 'Invoice Payment Reminder',
    description: 'Send a friendly reminder for an upcoming or overdue invoice.',
    triggerEvent: 'Invoice approaching or past due date',
    defaultSubject: 'Reminder: Invoice #{{invoiceNumber}} — {{amount}} due {{dueDate}}',
    defaultBadge: 'Payment Reminder',
    defaultHeading: 'Invoice Reminder, {{firstName}}',
    defaultBody: `Hi {{firstName}},

This is a friendly reminder that Invoice #{{invoiceNumber}} for {{amount}} is due on {{dueDate}}.

Invoice #{{invoiceNumber}}
Amount Due: {{amount}}
Due Date: {{dueDate}}

You can pay securely online at any time using the link below. If you have any questions or need to discuss payment options, please reply to this email.`,
    defaultCtaLabel: 'Pay Invoice',
    defaultCtaUrl: '{{paymentLink}}',
    variables: ['{{firstName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{paymentLink}}'],
  },
  {
    id: 'invoice_paid_confirmation',
    type: 'invoice',
    label: 'Payment Confirmation',
    description: 'Confirm receipt of payment and thank the client.',
    triggerEvent: 'Invoice payment received',
    defaultSubject: 'Payment received — Invoice #{{invoiceNumber}} ✓',
    defaultBadge: 'Payment Confirmed',
    defaultHeading: 'Payment Received — Thank You, {{firstName}}',
    defaultBody: `Hi {{firstName}},

We have received your payment of {{amount}} for Invoice #{{invoiceNumber}}. Your account is now up to date.

Payment Date: {{paymentDate}}
Amount Paid: {{amount}}
Reference: {{invoiceNumber}}

A receipt has been attached to this email for your records. If you have any questions, please do not hesitate to reach out.`,
    defaultCtaLabel: 'View Your Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/invoices',
    variables: ['{{firstName}}', '{{invoiceNumber}}', '{{amount}}', '{{paymentDate}}', '{{siteUrl}}'],
  },
  // ── Task Notifications ──
  {
    id: 'task_assigned',
    type: 'task',
    label: 'Task Assigned to Client',
    description: 'Notify a client when an action item has been assigned to them.',
    triggerEvent: 'Admin assigns task to client',
    defaultSubject: 'Action required on your case — {{taskTitle}}',
    defaultBadge: 'Action Required',
    defaultHeading: 'You Have a New Action Item, {{firstName}}',
    defaultBody: `Hi {{firstName}},

There is a new action item that requires your attention on your {{caseName}} matter.

Task: {{taskTitle}}
Due: {{taskDueDate}}
Priority: {{taskPriority}}

{{taskDescription}}

Please complete this as soon as possible. Log in to your client portal to view the full details and mark it complete when done.`,
    defaultCtaLabel: 'View Task in Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/dashboard',
    variables: ['{{firstName}}', '{{caseName}}', '{{taskTitle}}', '{{taskDueDate}}', '{{taskPriority}}', '{{taskDescription}}', '{{siteUrl}}'],
  },
  {
    id: 'task_due_reminder',
    type: 'task',
    label: 'Task Due Soon Reminder',
    description: 'Remind a client that a task assigned to them is due soon.',
    triggerEvent: 'Task due date approaching',
    defaultSubject: 'Reminder: {{taskTitle}} is due {{taskDueDate}}',
    defaultBadge: 'Task Reminder',
    defaultHeading: 'Task Due Soon, {{firstName}}',
    defaultBody: `Hi {{firstName}},

This is a reminder that the following task on your {{caseName}} matter is due soon.

Task: {{taskTitle}}
Due: {{taskDueDate}}
Case: {{caseName}}

If you have already completed this, please log in to your portal and mark it as done. If you need more time or have questions, please reply to this email.`,
    defaultCtaLabel: 'View Task',
    defaultCtaUrl: '{{siteUrl}}/portal/dashboard',
    variables: ['{{firstName}}', '{{caseName}}', '{{taskTitle}}', '{{taskDueDate}}', '{{siteUrl}}'],
  },
  {
    id: 'task_completed_ack',
    type: 'task',
    label: 'Task Completion Acknowledgment',
    description: 'Acknowledge when a client completes an assigned task.',
    triggerEvent: 'Client marks task as complete',
    defaultSubject: 'Task completed — {{taskTitle}}',
    defaultBadge: 'Task Complete',
    defaultHeading: 'Task Completed — Thank You, {{firstName}}',
    defaultBody: `Hi {{firstName}},

Thank you for completing the following task on your {{caseName}} matter.

Task: {{taskTitle}}
Completed: {{completionDate}}
Case: {{caseName}}

This keeps your case moving forward. I will review and follow up if anything further is needed. You can view all your case tasks and progress in your client portal.`,
    defaultCtaLabel: 'View Your Case',
    defaultCtaUrl: '{{siteUrl}}/portal/dashboard',
    variables: ['{{firstName}}', '{{caseName}}', '{{taskTitle}}', '{{completionDate}}', '{{siteUrl}}'],
  },
];

// ─── Brand defaults ───────────────────────────────────────────────────────────

const DEFAULT_BRAND: Pick<ComposerState, 'brandAccentColor' | 'brandHeaderColor' | 'signatureName' | 'signatureTitle' | 'signatureEmail'> = {
  brandAccentColor: '#C8965A',
  brandHeaderColor: '#4A3728',
  signatureName: 'Maggi May Broussard',
  signatureTitle: 'Licensed Paralegal · Louisiana & Nationwide',
  signatureEmail: 'maggimaybroussard@gmail.com',
};

const TYPE_META: Record<EmailType, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ReactNode }> = {
  case_update: {
    label: 'Case Updates',
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  invoice: {
    label: 'Invoices',
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2"/>
        <line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/>
      </svg>
    ),
  },
  task: {
    label: 'Task Notifications',
    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
};

// ─── Email Preview ─────────────────────────────────────────────────────────────

function EmailPreview({ state }: { state: ComposerState }) {
  const bodyLines = state.body.split('\n').filter((l) => l.trim());
  const accent = state.brandAccentColor || '#C8965A';
  const header = state.brandHeaderColor || '#4A3728';
  return (
    <div className="bg-[#EDE8E0] rounded-xl p-4 overflow-auto max-h-[600px]">
      <div
        className="mx-auto rounded-xl overflow-hidden border"
        style={{ maxWidth: 520, background: '#FAF7F2', borderColor: '#D9D0C5', boxShadow: '0 4px 24px rgba(74,55,40,0.10)' }}
      >
        {/* Header */}
        <div style={{ background: header }}>
          <div style={{ height: 4, background: `linear-gradient(to right, ${accent}, #E8B87A, ${accent})` }} />
          <div style={{ padding: '20px 28px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ borderRight: `2px solid ${accent}`, paddingRight: 12 }}>
                <p style={{ margin: 0, fontSize: 9, color: accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Paralegal</p>
                <p style={{ margin: 0, fontSize: 9, color: accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Services</p>
              </div>
              <div style={{ paddingLeft: 12 }}>
                <h1 style={{ margin: 0, fontSize: 18, color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>{state.signatureName}</h1>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'Georgia, serif' }}>Louisiana &amp; Nationwide</p>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(to right, ${accent}, rgba(200,150,90,0.2), transparent)`, margin: '0 28px' }} />
          <div style={{ height: 16 }} />
        </div>
        {/* Body */}
        <div style={{ padding: '28px 28px 24px' }}>
          {state.badge && (
            <span style={{ display: 'inline-block', background: accent, color: '#FFFFFF', fontSize: 9, fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20, marginBottom: 16, fontFamily: 'Georgia, serif' }}>
              {state.badge}
            </span>
          )}
          {state.heading && (
            <h2 style={{ margin: '0 0 16px', fontSize: 17, color: '#2C1F14', fontFamily: 'Georgia, serif', fontWeight: 'normal', borderBottom: '1px solid #D9D0C5', paddingBottom: 12 }}>
              {state.heading}
            </h2>
          )}
          {bodyLines.map((line, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 13, color: '#2C1F14', lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>{line}</p>
          ))}
          {state.ctaLabel && (
            <div style={{ margin: '20px 0' }}>
              <span style={{ display: 'inline-block', background: accent, borderRadius: 7, padding: '10px 24px', color: '#FFFFFF', fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                {state.ctaLabel} →
              </span>
            </div>
          )}
          <div style={{ marginTop: 20, borderTop: '1px solid #D9D0C5', paddingTop: 16 }}>
            <p style={{ margin: '0 0 3px', fontSize: 13, color: '#2C1F14', fontFamily: 'Georgia, serif' }}>Warm regards,</p>
            <p style={{ margin: '0 0 2px', fontSize: 14, color: header, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{state.signatureName}</p>
            <p style={{ margin: '0 0 5px', fontSize: 10, color: '#7A6B5D', fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>{state.signatureTitle}</p>
            <span style={{ color: accent, fontSize: 11, fontFamily: 'Georgia, serif' }}>{state.signatureEmail}</span>
          </div>
        </div>
        {/* Footer */}
        <div style={{ background: '#EDE8E0', padding: '14px 28px', borderTop: '1px solid #D9D0C5' }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: header, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Maggi May Broussard Legal Services</p>
          <p style={{ margin: 0, fontSize: 9, color: '#7A6B5D', lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
            You received this email from maggimay.com · <span style={{ color: '#7A6B5D' }}>Unsubscribe</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationEmailComposer() {
  const [activeType, setActiveType] = useState<EmailType>('case_update');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('case_status_update');
  const [activeView, setActiveView] = useState<'compose' | 'branding' | 'preview'>('compose');
  const [composerState, setComposerState] = useState<ComposerState>({
    subject: '',
    body: '',
    badge: '',
    heading: '',
    ctaLabel: '',
    ctaUrl: '',
    ...DEFAULT_BRAND,
  });
  const [savedTemplates, setSavedTemplates] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [sendingToClient, setSendingToClient] = useState(false);
  const [clientSendResult, setClientSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const testResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTemplate = NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? NOTIFICATION_TEMPLATES[0];
  const filteredTemplates = NOTIFICATION_TEMPLATES.filter((t) => t.type === activeType);

  // Load saved templates + clients on mount
  useEffect(() => {
    fetch('/api/admin/email-templates')
      .then((r) => r.json())
      .then(({ templates }) => {
        if (!Array.isArray(templates)) return;
        const savedSet = new Set<string>(templates.map((t: { template_id: string }) => t.template_id));
        setSavedTemplates(savedSet);
        // Pre-populate composer if saved override exists
        const match = templates.find((t: { template_id: string }) => t.template_id === selectedTemplateId);
        if (match) {
          setComposerState((prev) => ({
            ...prev,
            subject: match.subject,
            body: match.body,
            badge: match.badge,
            heading: match.heading,
            ctaLabel: match.cta_label,
            ctaUrl: match.cta_url,
          }));
        }
      })
      .catch(() => {});

    // Load active clients
    const supabase = createClient();
    supabase
      .from('contact_inquiries')
      .select('id, name, email, firm, service')
      .in('booking_stage', ['active_client', 'proposal_sent', 'consultation_booked'])
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }, []);

  // When template changes, load its content
  useEffect(() => {
    fetch('/api/admin/email-templates')
      .then((r) => r.json())
      .then(({ templates }) => {
        if (!Array.isArray(templates)) return;
        const match = templates.find((t: { template_id: string }) => t.template_id === selectedTemplateId);
        const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
        if (!tpl) return;
        setComposerState((prev) => ({
          ...prev,
          subject: match?.subject ?? tpl.defaultSubject,
          body: match?.body ?? tpl.defaultBody,
          badge: match?.badge ?? tpl.defaultBadge,
          heading: match?.heading ?? tpl.defaultHeading,
          ctaLabel: match?.cta_label ?? tpl.defaultCtaLabel,
          ctaUrl: match?.cta_url ?? tpl.defaultCtaUrl,
        }));
      })
      .catch(() => {
        const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
        if (!tpl) return;
        setComposerState((prev) => ({
          ...prev,
          subject: tpl.defaultSubject,
          body: tpl.defaultBody,
          badge: tpl.defaultBadge,
          heading: tpl.defaultHeading,
          ctaLabel: tpl.defaultCtaLabel,
          ctaUrl: tpl.defaultCtaUrl,
        }));
      });
  }, [selectedTemplateId]);

  const updateField = useCallback(<K extends keyof ComposerState>(field: K, value: ComposerState[K]) => {
    setComposerState((prev) => ({ ...prev, [field]: value }));
    setSaveError(null);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setSavingId(selectedTemplateId);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          templateId: selectedTemplateId,
          category: tpl.type,
          subject: composerState.subject,
          preheader: '',
          badge: composerState.badge,
          heading: composerState.heading,
          body: composerState.body,
          ctaLabel: composerState.ctaLabel,
          ctaUrl: composerState.ctaUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSavedTemplates((prev) => new Set(prev).add(selectedTemplateId));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  }, [selectedTemplateId, composerState]);

  const handleResetToDefault = useCallback(() => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setComposerState((prev) => ({
      ...prev,
      subject: tpl.defaultSubject,
      body: tpl.defaultBody,
      badge: tpl.defaultBadge,
      heading: tpl.defaultHeading,
      ctaLabel: tpl.defaultCtaLabel,
      ctaUrl: tpl.defaultCtaUrl,
    }));
    setSavedTemplates((prev) => { const next = new Set(prev); next.delete(selectedTemplateId); return next; });
    setSaveError(null);
  }, [selectedTemplateId]);

  const handleTestSend = useCallback(async () => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setTestResult(null);
    if (testResultTimer.current) clearTimeout(testResultTimer.current);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_send',
          toEmail: testEmail.trim(),
          subject: composerState.subject,
          preheader: '',
          badge: composerState.badge,
          heading: composerState.heading,
          body: composerState.body,
          ctaLabel: composerState.ctaLabel,
          ctaUrl: composerState.ctaUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setTestResult({ ok: true, msg: `Test sent to ${testEmail.trim()}` });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Send failed' });
    } finally {
      setSendingTest(false);
      testResultTimer.current = setTimeout(() => setTestResult(null), 6000);
    }
  }, [testEmail, composerState]);

  const handleSendToClient = useCallback(async () => {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;
    setSendingToClient(true);
    setClientSendResult(null);
    if (clientResultTimer.current) clearTimeout(clientResultTimer.current);
    try {
      const firstName = client.name.split(' ')[0];
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

      // Build variable substitution map from client data
      const variables: Record<string, string> = {
        '{{firstName}}': firstName,
        '{{caseName}}': client.service,
        '{{siteUrl}}': siteUrl,
        '{{serviceName}}': client.service,
      };

      const res = await fetch('/api/notifications/send-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: client.email,
          toName: client.name,
          subject: composerState.subject,
          badge: composerState.badge,
          heading: composerState.heading,
          body: composerState.body,
          ctaLabel: composerState.ctaLabel,
          ctaUrl: composerState.ctaUrl,
          brandAccentColor: composerState.brandAccentColor,
          brandHeaderColor: composerState.brandHeaderColor,
          signatureName: composerState.signatureName,
          signatureTitle: composerState.signatureTitle,
          signatureEmail: composerState.signatureEmail,
          eventType: selectedTemplate.type,
          templateId: selectedTemplate.id,
          variables,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setClientSendResult({ ok: true, msg: `Email sent to ${client.name} (${client.email})` });
    } catch (err) {
      setClientSendResult({ ok: false, msg: err instanceof Error ? err.message : 'Send failed' });
    } finally {
      setSendingToClient(false);
      clientResultTimer.current = setTimeout(() => setClientSendResult(null), 8000);
    }
  }, [selectedClientId, clients, composerState, selectedTemplate]);

  const typeCounts: Record<EmailType, number> = {
    case_update: NOTIFICATION_TEMPLATES.filter((t) => t.type === 'case_update').length,
    invoice: NOTIFICATION_TEMPLATES.filter((t) => t.type === 'invoice').length,
    task: NOTIFICATION_TEMPLATES.filter((t) => t.type === 'task').length,
  };

  const isSaved = savedTemplates.has(selectedTemplateId);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Type Selector Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.keys(TYPE_META) as EmailType[]).map((type) => {
          const meta = TYPE_META[type];
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => {
                setActiveType(type);
                const first = NOTIFICATION_TEMPLATES.find((t) => t.type === type);
                if (first) setSelectedTemplateId(first.id);
                setActiveView('compose');
              }}
              className={`relative bg-card border rounded-2xl p-5 text-left transition-all hover:shadow-md ${isActive ? 'border-primary/40 ring-1 ring-primary/20 shadow-sm' : 'border-border'}`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`p-2 rounded-xl ${meta.bg} ${meta.text}`}>{meta.icon}</span>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{meta.label}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">{typeCounts[type]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">templates</p>
              {isActive && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: '#355E3B' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p className="text-sm font-semibold text-blue-800">Transactional Email Composer — Powered by Resend</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Compose and send case updates, invoice notifications, and task alerts directly to clients via Resend.
            Use <code className="bg-blue-100 px-1 rounded text-blue-800">{'{{firstName}}'}</code>,{' '}
            <code className="bg-blue-100 px-1 rounded text-blue-800">{'{{caseName}}'}</code>,{' '}
            <code className="bg-blue-100 px-1 rounded text-blue-800">{'{{invoiceNumber}}'}</code>,{' '}
            <code className="bg-blue-100 px-1 rounded text-blue-800">{'{{amount}}'}</code> as dynamic variables — they are resolved automatically from the selected client&apos;s case data on send.
            Save a template to persist it as the default for that notification type.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Left: Template List ── */}
        <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                {TYPE_META[activeType].label}
              </p>
              <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                {filteredTemplates.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {filteredTemplates.map((tpl) => {
                const meta = TYPE_META[tpl.type];
                const isSelected = selectedTemplateId === tpl.id;
                const isSavedTpl = savedTemplates.has(tpl.id);
                return (
                  <button
                    key={tpl.id}
                    onClick={() => { setSelectedTemplateId(tpl.id); setActiveView('compose'); }}
                    className={`w-full text-left px-4 py-3.5 transition-all ${isSelected ? 'bg-secondary/50' : 'hover:bg-secondary/20'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground leading-snug">{tpl.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {isSavedTpl && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Saved override" />
                        )}
                        {isSelected && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tpl.description}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      {tpl.triggerEvent}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Composer ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">

            {/* Composer Header */}
            <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_META[selectedTemplate.type].bg} ${TYPE_META[selectedTemplate.type].text} ${TYPE_META[selectedTemplate.type].border}`}>
                    {TYPE_META[selectedTemplate.type].label}
                  </span>
                  {isSaved && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Saved as default
                    </span>
                  )}
                </div>
                <h2 className="font-serif text-xl text-foreground">{selectedTemplate.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedTemplate.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleResetToDefault}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingId === selectedTemplateId}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {savingId === selectedTemplateId ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                  ) : isSaved ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                  ) : 'Save as Default'}
                </button>
              </div>
            </div>

            {saveError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {saveError}
              </div>
            )}

            {/* View Toggle */}
            <div className="flex border-b border-border bg-secondary/10">
              {(['compose', 'branding', 'preview'] as const).map((view) => {
                const icons: Record<string, React.ReactNode> = {
                  compose: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                  branding: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
                  preview: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                };
                const labels: Record<string, string> = { compose: 'Compose', branding: 'Branding', preview: 'Preview' };
                return (
                  <button
                    key={view}
                    onClick={() => setActiveView(view)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all ${activeView === view ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {icons[view]}{labels[view]}
                  </button>
                );
              })}
            </div>

            {/* ── Compose View ── */}
            {activeView === 'compose' && (
              <div className="p-6 flex flex-col gap-5">

                {/* Trigger info */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-border">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Trigger:</strong> {selectedTemplate.triggerEvent}
                  </span>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Subject Line</label>
                  <input
                    type="text"
                    value={composerState.subject}
                    onChange={(e) => updateField('subject', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    placeholder="Email subject line…"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {composerState.subject.length} chars
                    {composerState.subject.length > 60 && <span className="text-amber-600 ml-1">· May truncate in some clients</span>}
                  </p>
                </div>

                {/* Badge + Heading */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Badge Label</label>
                    <input
                      type="text"
                      value={composerState.badge}
                      onChange={(e) => updateField('badge', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      placeholder="e.g. Case Update"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Email Heading</label>
                    <input
                      type="text"
                      value={composerState.heading}
                      onChange={(e) => updateField('heading', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      placeholder="e.g. Update on Your Case, {{firstName}}"
                    />
                  </div>
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Body Copy</label>
                  <textarea
                    rows={11}
                    value={composerState.body}
                    onChange={(e) => updateField('body', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-y font-mono leading-relaxed"
                    placeholder="Email body…"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedTemplate.variables.map((v) => (
                      <code
                        key={v}
                        className="bg-secondary px-1.5 py-0.5 rounded text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
                        onClick={() => updateField('body', composerState.body + v)}
                        title={`Click to insert ${v}`}
                      >
                        {v}
                      </code>
                    ))}
                    <span className="text-[10px] text-muted-foreground/60 self-center ml-1">Click to insert variable</span>
                  </div>
                </div>

                {/* CTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">CTA Button Label</label>
                    <input
                      type="text"
                      value={composerState.ctaLabel}
                      onChange={(e) => updateField('ctaLabel', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      placeholder="e.g. View Case in Portal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">CTA URL</label>
                    <input
                      type="text"
                      value={composerState.ctaUrl}
                      onChange={(e) => updateField('ctaUrl', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      placeholder="{{siteUrl}}/portal/cases"
                    />
                  </div>
                </div>

                {/* Send to Client */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Send to Client
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    >
                      <option value="">Select a client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSendToClient}
                      disabled={sendingToClient || !selectedClientId}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: '#355E3B', color: '#fff' }}
                    >
                      {sendingToClient ? (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending…</>
                      ) : (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Now</>
                      )}
                    </button>
                  </div>
                  {clientSendResult && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${clientSendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {clientSendResult.ok ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      )}
                      {clientSendResult.msg}
                    </div>
                  )}
                </div>

                {/* Test Send */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send Test Email
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    />
                    <button
                      onClick={handleTestSend}
                      disabled={sendingTest || !testEmail.trim()}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: '#4A3728', color: '#fff' }}
                    >
                      {sendingTest ? (
                        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending…</>
                      ) : 'Send Test'}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {testResult.ok ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      )}
                      {testResult.msg}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    onClick={handleResetToDefault}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={() => { handleSaveTemplate().then(() => setActiveView('preview')); }}
                    disabled={savingId === selectedTemplateId}
                    className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    {savingId === selectedTemplateId ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                    ) : 'Save & Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Branding View ── */}
            {activeView === 'branding' && (
              <div className="p-6 flex flex-col gap-6">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-amber-700">
                    Branding changes apply to the live preview for this session. To persist brand colors and signature across all emails, update the defaults in your Email Templates settings.
                  </p>
                </div>

                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Brand Colors</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-2">Header Background Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={composerState.brandHeaderColor}
                          onChange={(e) => updateField('brandHeaderColor', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={composerState.brandHeaderColor}
                          onChange={(e) => updateField('brandHeaderColor', e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                          placeholder="#4A3728"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-2">Accent / CTA Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={composerState.brandAccentColor}
                          onChange={(e) => updateField('brandAccentColor', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={composerState.brandAccentColor}
                          onChange={(e) => updateField('brandAccentColor', e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                          placeholder="#C8965A"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Email Signature</h3>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-2">Sender Name</label>
                      <input
                        type="text"
                        value={composerState.signatureName}
                        onChange={(e) => updateField('signatureName', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                        placeholder="Maggi May Broussard"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-2">Title / Credentials</label>
                      <input
                        type="text"
                        value={composerState.signatureTitle}
                        onChange={(e) => updateField('signatureTitle', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                        placeholder="Licensed Paralegal · Louisiana & Nationwide"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground font-medium mb-2">Reply-To Email</label>
                      <input
                        type="email"
                        value={composerState.signatureEmail}
                        onChange={(e) => updateField('signatureEmail', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                        placeholder="maggimaybroussard@gmail.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <button
                    onClick={() => setActiveView('preview')}
                    className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex items-center gap-1.5"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Preview Email
                  </button>
                </div>
              </div>
            )}

            {/* ── Preview View ── */}
            {activeView === 'preview' && (
              <div className="p-6 flex flex-col gap-4">
                {/* Inbox simulation */}
                <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{composerState.signatureName}</span>
                        <span className="text-xs text-muted-foreground">{composerState.signatureEmail}</span>
                      </div>
                      <p className="text-sm text-foreground font-medium truncate">{composerState.subject || '(no subject)'}</p>
                    </div>
                  </div>
                </div>

                <EmailPreview state={composerState} />

                {/* Test send from preview */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20 flex items-center gap-3 flex-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  <span className="text-xs text-muted-foreground font-medium">Send this preview to:</span>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                  />
                  <button
                    onClick={handleTestSend}
                    disabled={sendingTest || !testEmail.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                    style={{ background: '#4A3728', color: '#fff' }}
                  >
                    {sendingTest ? 'Sending…' : 'Send Test'}
                  </button>
                  {testResult && (
                    <span className={`text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {testResult.msg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
