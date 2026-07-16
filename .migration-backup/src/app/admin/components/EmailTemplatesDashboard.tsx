'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  category: 'invoice' | 'reminder' | 'case_update' | 'notification' | 'intake_nurture' | 'subscriber_nurture' | 'retainer';
  step: string;
  label: string;
  description: string;
  defaultSubject: string;
  defaultPreheader: string;
  defaultBadge: string;
  defaultHeading: string;
  defaultBody: string;
  defaultCtaLabel: string;
  defaultCtaUrl: string;
  timing: string;
  triggerEvent: string;
}

interface TemplateEditorState {
  subject: string;
  preheader: string;
  badge: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

interface AutoSendSettings {
  internal_cc_email: string;
  auto_send_enabled: boolean;
  cc_on_case_updates: boolean;
  cc_on_appointments: boolean;
  cc_on_invoices: boolean;
}

interface SendLogEntry {
  id: string;
  template_id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  resend_email_id: string | null;
  cc_internal: boolean;
  sent_at: string;
}

// ─── Template Definitions ─────────────────────────────────────────────────────

const TEMPLATES: EmailTemplate[] = [
  // ── Invoices ──
  {
    id: 'invoice_issued',
    category: 'invoice',
    step: 'Issued',
    label: 'Invoice Issued',
    description: 'Sent when a new invoice is created and issued to the client.',
    defaultSubject: 'Invoice #{{invoiceNumber}} — {{amount}} due {{dueDate}}',
    defaultPreheader: 'Your invoice for {{serviceName}} is ready. Payment due {{dueDate}}.',
    defaultBadge: 'Invoice Ready',
    defaultHeading: 'Invoice #{{invoiceNumber}} — {{amount}} Due',
    defaultBody: 'Hi {{firstName}},\n\nPlease find your invoice for {{serviceName}} attached to this email.\n\nInvoice #{{invoiceNumber}}\nAmount Due: {{amount}}\nDue Date: {{dueDate}}\n\nYou can pay securely online using the button below. If you have any questions about this invoice, please reply to this email.',
    defaultCtaLabel: 'Pay Invoice Now',
    defaultCtaUrl: '{{paymentLink}}',
    timing: 'On issue',
    triggerEvent: 'Invoice created',
  },
  {
    id: 'invoice_paid',
    category: 'invoice',
    step: 'Paid',
    label: 'Payment Confirmed',
    description: 'Sent immediately after a successful invoice payment.',
    defaultSubject: 'Payment received — Invoice #{{invoiceNumber}} ✓',
    defaultPreheader: 'Your payment of {{amount}} has been received. Thank you.',
    defaultBadge: 'Payment Confirmed',
    defaultHeading: 'Payment Received — Thank You, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nWe have received your payment of {{amount}} for Invoice #{{invoiceNumber}}. Your account is now up to date.\n\nPayment Date: {{paymentDate}}\nAmount Paid: {{amount}}\nReference: {{invoiceNumber}}\n\nA receipt has been attached to this email for your records. If you have any questions, please do not hesitate to reach out.',
    defaultCtaLabel: 'View Your Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/invoices',
    timing: 'On payment',
    triggerEvent: 'Payment confirmed',
  },
  {
    id: 'invoice_overdue',
    category: 'invoice',
    step: 'Overdue',
    label: 'Invoice Overdue',
    description: 'Sent when an invoice passes its due date without payment.',
    defaultSubject: 'Overdue: Invoice #{{invoiceNumber}} — {{amount}} past due',
    defaultPreheader: 'Invoice #{{invoiceNumber}} is now {{daysOverdue}} days past due. Please arrange payment.',
    defaultBadge: 'Payment Overdue',
    defaultHeading: 'Invoice #{{invoiceNumber}} Is Past Due',
    defaultBody: 'Hi {{firstName}},\n\nThis is a notice that Invoice #{{invoiceNumber}} for {{amount}} was due on {{dueDate}} and remains unpaid.\n\nDays Overdue: {{daysOverdue}}\nAmount Due: {{amount}}\nOriginal Due Date: {{dueDate}}\n\nPlease arrange payment at your earliest convenience using the link below. If you have already sent payment or need to discuss a payment arrangement, please reply to this email.',
    defaultCtaLabel: 'Pay Now',
    defaultCtaUrl: '{{paymentLink}}',
    timing: 'Day after due',
    triggerEvent: 'Invoice overdue',
  },
  // ── Reminders ──
  {
    id: 'reminder_7_before',
    category: 'reminder',
    step: '7-Day',
    label: 'Payment Due in 7 Days',
    description: 'Sent 7 days before invoice due date as a friendly advance reminder.',
    defaultSubject: 'Reminder: Invoice #{{invoiceNumber}} due in 7 days',
    defaultPreheader: '{{amount}} due on {{dueDate}} — 7 days remaining.',
    defaultBadge: 'Payment Reminder',
    defaultHeading: 'Invoice Due in 7 Days, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nThis is a friendly reminder that Invoice #{{invoiceNumber}} for {{amount}} is due in 7 days on {{dueDate}}.\n\nInvoice #{{invoiceNumber}}\nAmount Due: {{amount}}\nDue Date: {{dueDate}}\n\nYou can pay securely online at any time using the link below. If you have any questions or need to discuss payment options, please reply to this email.',
    defaultCtaLabel: 'Pay Invoice',
    defaultCtaUrl: '{{paymentLink}}',
    timing: '7 days before due',
    triggerEvent: 'Invoice approaching due date',
  },
  {
    id: 'reminder_3_after',
    category: 'reminder',
    step: '3-Day Late',
    label: 'Payment 3 Days Late',
    description: 'Sent 3 days after due date if invoice remains unpaid.',
    defaultSubject: 'Follow-up: Invoice #{{invoiceNumber}} — {{amount}} now 3 days overdue',
    defaultPreheader: 'Invoice #{{invoiceNumber}} is 3 days past due. Please arrange payment.',
    defaultBadge: 'Overdue Notice',
    defaultHeading: 'Invoice #{{invoiceNumber}} — 3 Days Overdue',
    defaultBody: 'Hi {{firstName}},\n\nI wanted to follow up on Invoice #{{invoiceNumber}} for {{amount}}, which was due on {{dueDate}} and is now 3 days past due.\n\nIf you have already sent payment, please disregard this notice. If not, please arrange payment at your earliest convenience.\n\nIf you are experiencing any difficulty or would like to discuss a payment arrangement, please reply to this email and I will be happy to work with you.',
    defaultCtaLabel: 'Pay Now',
    defaultCtaUrl: '{{paymentLink}}',
    timing: '3 days after due',
    triggerEvent: 'Invoice 3 days overdue',
  },
  {
    id: 'reminder_appointment_24h',
    category: 'reminder',
    step: '24h',
    label: 'Appointment Reminder (24h)',
    description: 'Sent 24 hours before a scheduled appointment.',
    defaultSubject: 'Reminder: Your appointment tomorrow at {{eventTime}}',
    defaultPreheader: 'Your appointment with Maggi May Broussard is tomorrow.',
    defaultBadge: 'Appointment Reminder',
    defaultHeading: 'Your Appointment Is Tomorrow, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nThis is a friendly reminder that you have an appointment scheduled for tomorrow.\n\nDate: {{eventDate}}\nTime: {{eventTime}}\nFormat: {{meetingFormat}}\n\nIf you need to reschedule, please contact me as soon as possible.',
    defaultCtaLabel: 'View or Reschedule',
    defaultCtaUrl: '{{siteUrl}}/availability',
    timing: '24h before appointment',
    triggerEvent: 'Appointment approaching',
  },
  {
    id: 'reminder_appointment_1h',
    category: 'reminder',
    step: '1h',
    label: 'Appointment Reminder (1h)',
    description: 'Sent 1 hour before a scheduled appointment.',
    defaultSubject: 'Your appointment starts in 1 hour — {{eventTime}}',
    defaultPreheader: 'Your appointment with Maggi May Broussard starts in 1 hour.',
    defaultBadge: 'Starting Soon',
    defaultHeading: 'Your Appointment Starts in 1 Hour',
    defaultBody: 'Hi {{firstName}},\n\nYour appointment with Maggi May Broussard starts in approximately 1 hour.\n\nTime: {{eventTime}}\nFormat: {{meetingFormat}}\n\nPlease make sure you are prepared and have any relevant documents ready.',
    defaultCtaLabel: 'View Appointment Details',
    defaultCtaUrl: '{{siteUrl}}/portal/dashboard',
    timing: '1h before appointment',
    triggerEvent: 'Appointment imminent',
  },
  {
    id: 'reminder_retainer_renewal',
    category: 'reminder',
    step: 'Renewal',
    label: 'Retainer Renewal Reminder',
    description: 'Sent 7 days before retainer renewal date.',
    defaultSubject: 'Retainer renewal in {{daysUntilRenewal}} days — {{planName}}',
    defaultPreheader: 'Your {{planName}} retainer renews in {{daysUntilRenewal}} days on {{renewalDate}}.',
    defaultBadge: 'Renewal Reminder',
    defaultHeading: 'Your Retainer Renews in {{daysUntilRenewal}} Days',
    defaultBody: 'Hi {{firstName}},\n\nThis is a friendly reminder that your {{planName}} retainer will automatically renew in {{daysUntilRenewal}} days on {{renewalDate}}.\n\nYour payment method on file will be charged {{amount}} on {{renewalDate}}. If you wish to cancel or make changes before the renewal date, please contact me directly.\n\nIf you have any questions about your retainer or would like to discuss your plan, I am happy to help.',
    defaultCtaLabel: 'Manage Your Retainer',
    defaultCtaUrl: '{{siteUrl}}/portal/billing',
    timing: '7 days before renewal',
    triggerEvent: 'Retainer renewal approaching',
  },
  // ── Case Updates ──
  {
    id: 'case_status_update',
    category: 'case_update',
    step: 'Status',
    label: 'Case Status Update',
    description: 'Auto-sent when an admin updates the status of a client case.',
    defaultSubject: 'Case update — {{caseName}} status changed to {{newStatus}}',
    defaultPreheader: 'Your case {{caseName}} has been updated. Log in to see the latest.',
    defaultBadge: 'Case Update',
    defaultHeading: 'Update on Your Case, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nI wanted to let you know that there has been an update on your {{caseName}} matter.\n\nCase: {{caseName}}\nPrevious Status: {{previousStatus}}\nNew Status: {{newStatus}}\nUpdated: {{updateDate}}\n\nPlease log in to your client portal to view the full details and any new documents or notes that have been added to your case file.',
    defaultCtaLabel: 'View Case in Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    timing: 'On status change',
    triggerEvent: 'Case status updated',
  },
  {
    id: 'case_document_uploaded',
    category: 'case_update',
    step: 'Document',
    label: 'Document Added to Case',
    description: 'Auto-sent when a new document is uploaded to a client case.',
    defaultSubject: 'New document added to your case — {{caseName}}',
    defaultPreheader: 'A new document has been added to your {{caseName}} case file.',
    defaultBadge: 'Document Added',
    defaultHeading: 'New Document Added to Your Case',
    defaultBody: 'Hi {{firstName}},\n\nA new document has been added to your {{caseName}} case file.\n\nDocument: {{documentName}}\nCase: {{caseName}}\nAdded: {{uploadDate}}\n\nYou can view and download this document by logging in to your client portal. If you have any questions about this document, please reply to this email.',
    defaultCtaLabel: 'View Document',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    timing: 'On upload',
    triggerEvent: 'Document uploaded to case',
  },
  {
    id: 'case_timeline_event',
    category: 'case_update',
    step: 'Timeline',
    label: 'Case Timeline Event',
    description: 'Auto-sent when a new timeline event is added to a client case.',
    defaultSubject: 'Case timeline update — {{caseName}}',
    defaultPreheader: 'A new event has been added to your {{caseName}} case timeline.',
    defaultBadge: 'Timeline Update',
    defaultHeading: 'New Event on Your Case Timeline',
    defaultBody: 'Hi {{firstName}},\n\nA new event has been recorded on the timeline for your {{caseName}} matter.\n\nEvent: {{eventTitle}}\nDate: {{eventDate}}\nCase: {{caseName}}\n\nLog in to your client portal to view the full timeline and all case activity.',
    defaultCtaLabel: 'View Case Timeline',
    defaultCtaUrl: '{{siteUrl}}/portal/cases',
    timing: 'On event added',
    triggerEvent: 'Timeline event added',
  },
  // ── Notifications ──
  {
    id: 'notification_welcome',
    category: 'notification',
    step: 'Welcome',
    label: 'Client Portal Welcome',
    description: 'Sent when a new client portal account is created.',
    defaultSubject: 'Welcome to your client portal, {{firstName}}',
    defaultPreheader: 'Your Maggi May Broussard client portal is ready. Log in to get started.',
    defaultBadge: 'Portal Access Ready',
    defaultHeading: 'Welcome to Your Client Portal, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nYour Maggi May Broussard client portal account is ready. Your portal gives you secure access to your case files, invoices, documents, and communication history — all in one place.\n\nYou can use your portal to:\n\n• View and pay invoices\n• Track your case status and timeline\n• Upload and download documents\n• Manage your notification preferences\n• Update your contact and billing information\n\nLog in using the button below with the email address this message was sent to.',
    defaultCtaLabel: 'Log In to Your Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/login',
    timing: 'On account creation',
    triggerEvent: 'Client portal account created',
  },
  {
    id: 'notification_booking_confirmed',
    category: 'notification',
    step: 'Booking',
    label: 'Consultation Confirmed',
    description: 'Sent when a consultation booking is confirmed.',
    defaultSubject: 'Consultation confirmed — {{eventDate}} at {{eventTime}}',
    defaultPreheader: 'Your consultation with Maggi May Broussard is confirmed for {{eventDate}}.',
    defaultBadge: 'Consultation Confirmed',
    defaultHeading: 'Your Consultation Is Confirmed, {{firstName}}',
    defaultBody: 'Hi {{firstName}},\n\nYour consultation with Maggi May Broussard has been confirmed.\n\nDate: {{eventDate}}\nTime: {{eventTime}}\nFormat: {{meetingFormat}}\n\nI will review your case details before our meeting so we can make the most of our time together. If you need to reschedule or have any questions before our consultation, please reply to this email.',
    defaultCtaLabel: 'View or Reschedule',
    defaultCtaUrl: '{{siteUrl}}/availability',
    timing: 'On booking',
    triggerEvent: 'Consultation booked',
  },
  {
    id: 'notification_retainer_activated',
    category: 'notification',
    step: 'Retainer',
    label: 'Retainer Activated',
    description: 'Sent when a retainer subscription is created and confirmed.',
    defaultSubject: 'Your retainer is active — {{planName}}',
    defaultPreheader: 'Your {{planName}} retainer is now active. Next renewal: {{nextRenewalDate}}.',
    defaultBadge: 'Retainer Activated',
    defaultHeading: 'Your Retainer Is Now Active',
    defaultBody: 'Hi {{firstName}},\n\nYour {{planName}} retainer agreement is confirmed and active. You will be billed {{billingCycle}} and your services will automatically renew each billing period.\n\nPlan: {{planName}}\nBilling: {{billingCycle}}\nNext Renewal: {{nextRenewalDate}}\n\nYour retainer gives you priority access to my services. If you have any questions about your plan or need to make changes, please contact me directly.',
    defaultCtaLabel: 'View Your Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/billing',
    timing: 'On activation',
    triggerEvent: 'Retainer subscription created',
  },
  {
    id: 'notification_general',
    category: 'notification',
    step: 'General',
    label: 'General Notification',
    description: 'General-purpose notification template for custom client communications.',
    defaultSubject: '{{subject}} — Maggi May Broussard',
    defaultPreheader: '{{preheaderText}}',
    defaultBadge: 'Notice',
    defaultHeading: '{{heading}}',
    defaultBody: 'Hi {{firstName}},\n\n{{messageBody}}\n\nIf you have any questions, please reply to this email or log in to your client portal.',
    defaultCtaLabel: 'View Your Portal',
    defaultCtaUrl: '{{siteUrl}}/portal/dashboard',
    timing: 'Manual',
    triggerEvent: 'Admin triggered',
  },
];

const CATEGORY_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ReactNode }> = {
  invoice: {
    label: 'Invoices',
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>,
  },
  reminder: {
    label: 'Reminders',
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
  case_update: {
    label: 'Case Updates',
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
  notification: {
    label: 'Notifications',
    bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  },
};

const BRAND = {
  bg: '#FAF7F2', primary: '#4A3728', accent: '#C8965A', accentLight: '#F5EDE0',
  foreground: '#2C1F14', muted: '#7A6B5D', border: '#D9D0C5', secondary: '#EDE8E0', white: '#FFFFFF',
};

// ─── Email Preview ─────────────────────────────────────────────────────────────

function EmailPreview({ edits }: { edits: TemplateEditorState }) {
  const bodyLines = edits.body.split('\n').filter((l) => l.trim());
  return (
    <div className="bg-[#EDE8E0] rounded-xl p-4 overflow-auto max-h-[620px]">
      <div className="mx-auto rounded-xl overflow-hidden border" style={{ maxWidth: 520, background: BRAND.bg, borderColor: BRAND.border, boxShadow: '0 4px 24px rgba(74,55,40,0.10)' }}>
        {/* Header */}
        <div style={{ background: BRAND.primary }}>
          <div style={{ height: 4, background: `linear-gradient(to right, ${BRAND.accent}, #E8B87A, ${BRAND.accent})` }} />
          <div style={{ padding: '20px 28px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ borderRight: `2px solid ${BRAND.accent}`, paddingRight: 12 }}>
                <p style={{ margin: 0, fontSize: 9, color: BRAND.accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Paralegal</p>
                <p style={{ margin: 0, fontSize: 9, color: BRAND.accent, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>Services</p>
              </div>
              <div style={{ paddingLeft: 12 }}>
                <h1 style={{ margin: 0, fontSize: 18, color: BRAND.white, fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>Maggi May Broussard</h1>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'Georgia, serif' }}>Louisiana &amp; Nationwide</p>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(to right, ${BRAND.accent}, rgba(200,150,90,0.2), transparent)`, margin: '0 28px' }} />
          <div style={{ height: 16 }} />
        </div>
        {/* Body */}
        <div style={{ padding: '28px 28px 24px' }}>
          {edits.badge && (
            <span style={{ display: 'inline-block', background: BRAND.accent, color: BRAND.white, fontSize: 9, fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20, marginBottom: 16, fontFamily: 'Georgia, serif' }}>
              {edits.badge}
            </span>
          )}
          {edits.heading && (
            <h2 style={{ margin: '0 0 16px', fontSize: 17, color: BRAND.foreground, fontFamily: 'Georgia, serif', fontWeight: 'normal', borderBottom: `1px solid ${BRAND.border}`, paddingBottom: 12 }}>
              {edits.heading}
            </h2>
          )}
          {bodyLines.map((line, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 13, color: BRAND.foreground, lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>{line}</p>
          ))}
          {edits.ctaLabel && (
            <div style={{ margin: '20px 0' }}>
              <span style={{ display: 'inline-block', background: BRAND.accent, borderRadius: 7, padding: '10px 24px', color: BRAND.white, fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                {edits.ctaLabel} →
              </span>
            </div>
          )}
          <div style={{ marginTop: 20, borderTop: `1px solid ${BRAND.border}`, paddingTop: 16 }}>
            <p style={{ margin: '0 0 3px', fontSize: 13, color: BRAND.foreground, fontFamily: 'Georgia, serif' }}>Warm regards,</p>
            <p style={{ margin: '0 0 2px', fontSize: 14, color: BRAND.primary, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Maggi May Broussard</p>
            <p style={{ margin: '0 0 5px', fontSize: 10, color: BRAND.muted, fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>Licensed Paralegal · Louisiana &amp; Nationwide</p>
            <span style={{ color: BRAND.accent, fontSize: 11, fontFamily: 'Georgia, serif' }}>maggimaybroussard@gmail.com</span>
          </div>
        </div>
        {/* Footer */}
        <div style={{ background: BRAND.secondary, padding: '14px 28px', borderTop: `1px solid ${BRAND.border}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: BRAND.primary, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Maggi May Broussard Legal Services</p>
          <p style={{ margin: 0, fontSize: 9, color: BRAND.muted, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
            You received this email from maggimay.com · <span style={{ color: BRAND.muted }}>Unsubscribe</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Auto-Send Settings Panel ─────────────────────────────────────────────────

function AutoSendSettingsPanel() {
  const [settings, setSettings] = useState<AutoSendSettings>({
    internal_cc_email: '',
    auto_send_enabled: true,
    cc_on_case_updates: true,
    cc_on_appointments: true,
    cc_on_invoices: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendLog, setSendLog] = useState<SendLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/email-templates/auto-send')
      .then((r) => r.json())
      .then(({ settings: s }) => { if (s) setSettings(s); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load send log from Supabase via a simple fetch
    fetch('/api/admin/email-templates/send-log')
      .then((r) => r.json())
      .then(({ logs }) => { if (Array.isArray(logs)) setSendLog(logs); })
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/email-templates/auto-send', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-Send Config */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-foreground">Auto-Send Configuration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Control how the system automatically sends emails to clients and internally via Resend</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            {saving ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
            ) : saved ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
            ) : 'Save Settings'}
          </button>
        </div>
        <div className="p-6 flex flex-col gap-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20">
            <div>
              <p className="text-sm font-semibold text-foreground">Auto-Send Enabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">When disabled, no emails will be auto-sent by the system. Manual test sends still work.</p>
            </div>
            <button
              onClick={() => setSettings((s) => ({ ...s, auto_send_enabled: !s.auto_send_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.auto_send_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.auto_send_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Internal CC email */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Internal CC Email
              <span className="ml-2 normal-case tracking-normal font-normal text-muted-foreground/70">(admin receives a copy of every auto-sent email)</span>
            </label>
            <input
              type="email"
              value={settings.internal_cc_email}
              onChange={(e) => setSettings((s) => ({ ...s, internal_cc_email: e.target.value }))}
              placeholder="admin@broussardlegalservices.com"
              className="w-full max-w-md px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave blank to disable internal CC. Requires RESEND_API_KEY to be configured.</p>
          </div>

          {/* Per-category CC toggles */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">CC Internal On</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'cc_on_case_updates' as const, label: 'Case Updates', icon: '📋', desc: 'Status changes, documents, timeline events' },
                { key: 'cc_on_appointments' as const, label: 'Appointment Reminders', icon: '📅', desc: '24h and 1h appointment reminders' },
                { key: 'cc_on_invoices' as const, label: 'Invoice Notifications', icon: '💳', desc: 'Invoice issued, paid, overdue alerts' },
              ].map(({ key, label, icon, desc }) => (
                <button
                  key={key}
                  onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${settings[key] ? 'border-primary/30 bg-secondary/40' : 'border-border bg-card hover:bg-secondary/20'}`}
                >
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${settings[key] ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* How auto-send works */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              How Auto-Send Works
            </p>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span><span><strong>Case Updates:</strong> Triggered when case status changes, documents are uploaded, or timeline events are added in the Cases tab</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span><span><strong>Appointment Reminders:</strong> Triggered by the appointment reminder scheduler 24h and 1h before each appointment</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span><span><strong>Invoice Notifications:</strong> Triggered when invoices are issued, paid, or become overdue via the invoice management system</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span><span>All sends use your <strong>customized templates</strong> from the Template Editor tab, falling back to defaults if not customized</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">→</span><span>Requires <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY</code> to be configured in environment variables</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Send Log */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-foreground">Auto-Send Log</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Recent emails sent automatically by the system</p>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary/60 px-3 py-1 rounded-full">{sendLog.length} records</span>
        </div>
        {logLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        ) : sendLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No emails sent yet</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-sent emails will appear here once the system starts sending</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Template</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Recipient</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Subject</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">CC</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sendLog.slice(0, 50).map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3">
                      <code className="text-xs bg-secondary/60 px-2 py-0.5 rounded text-foreground">{entry.template_id}</code>
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        {entry.to_name && <p className="text-xs font-medium text-foreground">{entry.to_name}</p>}
                        <p className="text-xs text-muted-foreground">{entry.to_email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[240px]">
                      <p className="text-xs text-foreground truncate">{entry.subject}</p>
                    </td>
                    <td className="px-5 py-3">
                      {entry.cc_internal ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          CC'd
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmailTemplatesDashboard() {
  const [mainTab, setMainTab] = useState<'templates' | 'auto_send'>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('invoice');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>('invoice_issued');
  const [edits, setEdits] = useState<Record<string, TemplateEditorState>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const testResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved templates from DB on mount
  useEffect(() => {
    fetch('/api/admin/email-templates')
      .then((r) => r.json())
      .then(({ templates }) => {
        if (!Array.isArray(templates)) return;
        const loaded: Record<string, TemplateEditorState> = {};
        for (const t of templates) {
          loaded[t.template_id] = {
            subject: t.subject,
            preheader: t.preheader,
            badge: t.badge,
            heading: t.heading,
            body: t.body,
            ctaLabel: t.cta_label,
            ctaUrl: t.cta_url,
          };
        }
        setEdits(loaded);
        setSavedIds(new Set(Object.keys(loaded)));
      })
      .catch(() => {});
  }, []);

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;

  const getEdits = useCallback((template: EmailTemplate): TemplateEditorState => {
    return edits[template.id] ?? {
      subject: template.defaultSubject,
      preheader: template.defaultPreheader,
      badge: template.defaultBadge,
      heading: template.defaultHeading,
      body: template.defaultBody,
      ctaLabel: template.defaultCtaLabel,
      ctaUrl: template.defaultCtaUrl,
    };
  }, [edits]);

  const updateField = useCallback((templateId: string, field: keyof TemplateEditorState, value: string) => {
    setEdits((prev) => {
      const template = TEMPLATES.find((t) => t.id === templateId)!;
      const current = prev[templateId] ?? {
        subject: template.defaultSubject, preheader: template.defaultPreheader,
        badge: template.defaultBadge, heading: template.defaultHeading,
        body: template.defaultBody, ctaLabel: template.defaultCtaLabel, ctaUrl: template.defaultCtaUrl,
      };
      return { ...prev, [templateId]: { ...current, [field]: value } };
    });
    setSavedIds((prev) => { const next = new Set(prev); next.delete(templateId); return next; });
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSavingId(templateId);
    setSaveError(null);
    try {
      const e = edits[templateId] ?? {
        subject: template.defaultSubject, preheader: template.defaultPreheader,
        badge: template.defaultBadge, heading: template.defaultHeading,
        body: template.defaultBody, ctaLabel: template.defaultCtaLabel, ctaUrl: template.defaultCtaUrl,
      };
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', templateId, category: template.category, ...e, body: e.body, ctaLabel: e.ctaLabel, ctaUrl: e.ctaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSavedIds((prev) => new Set(prev).add(templateId));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  }, [edits]);

  const handleReset = useCallback((templateId: string) => {
    setEdits((prev) => { const next = { ...prev }; delete next[templateId]; return next; });
    setSavedIds((prev) => { const next = new Set(prev); next.delete(templateId); return next; });
    setSaveError(null);
  }, []);

  const handleTestSend = useCallback(async () => {
    if (!selectedTemplate || !testEmail.trim()) return;
    setSendingTest(true);
    setTestResult(null);
    if (testResultTimer.current) clearTimeout(testResultTimer.current);
    try {
      const e = getEdits(selectedTemplate);
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_send',
          toEmail: testEmail.trim(),
          subject: e.subject,
          preheader: e.preheader,
          badge: e.badge,
          heading: e.heading,
          body: e.body,
          ctaLabel: e.ctaLabel,
          ctaUrl: e.ctaUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setTestResult({ ok: true, msg: `Test email sent to ${testEmail.trim()}` });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Send failed' });
    } finally {
      setSendingTest(false);
      testResultTimer.current = setTimeout(() => setTestResult(null), 6000);
    }
  }, [selectedTemplate, testEmail, getEdits]);

  const hasChanges = useCallback((template: EmailTemplate): boolean => {
    const e = edits[template.id];
    if (!e) return false;
    return (
      e.subject !== template.defaultSubject || e.preheader !== template.defaultPreheader ||
      e.badge !== template.defaultBadge || e.heading !== template.defaultHeading ||
      e.body !== template.defaultBody || e.ctaLabel !== template.defaultCtaLabel || e.ctaUrl !== template.defaultCtaUrl
    );
  }, [edits]);

  const filteredTemplates = TEMPLATES.filter((t) => t.category === selectedCategory);
  const categories = ['invoice', 'reminder', 'case_update', 'notification'] as const;

  const categoryCounts: Record<string, number> = {};
  for (const cat of categories) categoryCounts[cat] = TEMPLATES.filter((t) => t.category === cat).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const savedCount = TEMPLATES.filter((t) => t.category === cat && savedIds.has(t.id)).length;
          return (
            <button
              key={cat}
              onClick={() => { setMainTab('templates'); setSelectedCategory(cat); setSelectedTemplateId(TEMPLATES.find((t) => t.category === cat)?.id ?? null); setActiveView('edit'); }}
              className={`bg-card border rounded-2xl p-5 text-left transition-all hover:shadow-md ${mainTab === 'templates' && selectedCategory === cat ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`p-1.5 rounded-lg ${meta.bg} ${meta.text}`}>{meta.icon}</span>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{meta.label}</p>
              </div>
              <p className="text-3xl font-semibold text-foreground">{categoryCounts[cat]}</p>
              <p className="text-xs text-muted-foreground mt-1">{savedCount} customized</p>
            </button>
          );
        })}
      </div>

      {/* Main Tab Bar */}
      <div className="flex border-b border-border">
        {[
          { id: 'templates' as const, label: 'Template Editor', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
          { id: 'auto_send' as const, label: 'Auto-Send & Log', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-widest transition-all ${mainTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template Editor Tab */}
      {mainTab === 'templates' && (
        <>
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Branded Email Template Editor</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Edit subject lines, headings, body copy, and CTAs. Use{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{firstName}}'}</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{invoiceNumber}}'}</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{amount}}'}</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{caseName}}'}</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{eventDate}}'}</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-amber-800">{'{{siteUrl}}'}</code> as dynamic variables.
                Saved templates are used by the auto-send system and Resend email functions.
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Category + Template List */}
            <div className="lg:w-72 flex-shrink-0 flex flex-col gap-4">
              {/* Category Tabs */}
              <div className="bg-card border border-border rounded-2xl p-3">
                <div className="flex flex-col gap-1">
                  {categories.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setSelectedTemplateId(TEMPLATES.find((t) => t.category === cat)?.id ?? null); setActiveView('edit'); }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-secondary/70 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`${meta.dot} w-2 h-2 rounded-full flex-shrink-0`} />
                          <span>{meta.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{categoryCounts[cat]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Template List */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{filteredTemplates.length} Templates</p>
                </div>
                <div className="divide-y divide-border">
                  {filteredTemplates.map((template) => {
                    const meta = CATEGORY_META[template.category];
                    const isSelected = selectedTemplateId === template.id;
                    const changed = hasChanges(template);
                    const saved = savedIds.has(template.id);
                    return (
                      <button
                        key={template.id}
                        onClick={() => { setSelectedTemplateId(template.id); setActiveView('edit'); }}
                        className={`w-full text-left px-4 py-3.5 transition-all ${isSelected ? 'bg-secondary/50' : 'hover:bg-secondary/20'}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
                              {template.step}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">{template.label}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            {saved && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Saved to DB" />}
                            {changed && !saved && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {template.timing}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Editor / Preview */}
            <div className="flex-1 min-w-0">
              {!selectedTemplate ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <p className="text-foreground font-medium mb-1">Select a template to edit</p>
                  <p className="text-sm text-muted-foreground">Choose a category and template from the list to customize its content.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Editor Header */}
                  <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_META[selectedTemplate.category].bg} ${CATEGORY_META[selectedTemplate.category].text} ${CATEGORY_META[selectedTemplate.category].border}`}>
                          {CATEGORY_META[selectedTemplate.category].label}
                        </span>
                        <span className="text-xs text-muted-foreground">{selectedTemplate.step} · {selectedTemplate.timing}</span>
                        {savedIds.has(selectedTemplate.id) && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Saved to database
                          </span>
                        )}
                      </div>
                      <h2 className="font-serif text-xl text-foreground">{selectedTemplate.label}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedTemplate.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleReset(selectedTemplate.id)}
                        disabled={!hasChanges(selectedTemplate) && !savedIds.has(selectedTemplate.id)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => handleSave(selectedTemplate.id)}
                        disabled={savingId === selectedTemplate.id}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        {savingId === selectedTemplate.id ? (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                        ) : savedIds.has(selectedTemplate.id) ? (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                        ) : 'Save Template'}
                      </button>
                    </div>
                  </div>

                  {saveError && (
                    <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {saveError}
                    </div>
                  )}

                  {/* Edit / Preview Toggle */}
                  <div className="flex border-b border-border bg-secondary/10">
                    {(['edit', 'preview'] as const).map((view) => (
                      <button
                        key={view}
                        onClick={() => setActiveView(view)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all ${activeView === view ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {view === 'edit' ? (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Content</>
                        ) : (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Live Preview</>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Edit View */}
                  {activeView === 'edit' && (
                    <div className="p-6 flex flex-col gap-5">
                      {/* Trigger Info */}
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-border">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <span className="text-xs text-muted-foreground">
                          <strong className="text-foreground">Trigger:</strong> {selectedTemplate.triggerEvent} · <strong className="text-foreground">Timing:</strong> {selectedTemplate.timing}
                        </span>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Subject Line</label>
                        <input
                          type="text"
                          value={getEdits(selectedTemplate).subject}
                          onChange={(e) => updateField(selectedTemplate.id, 'subject', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getEdits(selectedTemplate).subject.length} chars
                          {getEdits(selectedTemplate).subject.length > 60 && <span className="text-amber-600 ml-1">· May truncate in some clients</span>}
                        </p>
                      </div>

                      {/* Preheader */}
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                          Preheader <span className="ml-1 text-muted-foreground/60 normal-case tracking-normal font-normal">(inbox preview text)</span>
                        </label>
                        <input
                          type="text"
                          value={getEdits(selectedTemplate).preheader}
                          onChange={(e) => updateField(selectedTemplate.id, 'preheader', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                        />
                      </div>

                      {/* Badge + Heading */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Badge Label</label>
                          <input
                            type="text"
                            value={getEdits(selectedTemplate).badge}
                            onChange={(e) => updateField(selectedTemplate.id, 'badge', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Email Heading</label>
                          <input
                            type="text"
                            value={getEdits(selectedTemplate).heading}
                            onChange={(e) => updateField(selectedTemplate.id, 'heading', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                          />
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Body Copy</label>
                        <textarea
                          rows={10}
                          value={getEdits(selectedTemplate).body}
                          onChange={(e) => updateField(selectedTemplate.id, 'body', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-y font-mono leading-relaxed"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Variables: <code className="bg-secondary px-1 rounded">{'{{firstName}}'}</code> <code className="bg-secondary px-1 rounded">{'{{invoiceNumber}}'}</code> <code className="bg-secondary px-1 rounded">{'{{amount}}'}</code> <code className="bg-secondary px-1 rounded">{'{{dueDate}}'}</code> <code className="bg-secondary px-1 rounded">{'{{caseName}}'}</code> <code className="bg-secondary px-1 rounded">{'{{newStatus}}'}</code> <code className="bg-secondary px-1 rounded">{'{{eventDate}}'}</code> <code className="bg-secondary px-1 rounded">{'{{eventTime}}'}</code> <code className="bg-secondary px-1 rounded">{'{{siteUrl}}'}</code>. Each line = new paragraph.
                        </p>
                      </div>

                      {/* CTA */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">CTA Button Label</label>
                          <input
                            type="text"
                            value={getEdits(selectedTemplate).ctaLabel}
                            onChange={(e) => updateField(selectedTemplate.id, 'ctaLabel', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">CTA URL</label>
                          <input
                            type="text"
                            value={getEdits(selectedTemplate).ctaUrl}
                            onChange={(e) => updateField(selectedTemplate.id, 'ctaUrl', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                          />
                        </div>
                      </div>

                      {/* Test Send */}
                      <div className="p-4 rounded-xl border border-border bg-secondary/20">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          Send Test Email via Resend
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
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Test</>
                            )}
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

                      {/* Save Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          {hasChanges(selectedTemplate) && !savedIds.has(selectedTemplate.id) && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Unsaved changes
                            </span>
                          )}
                          {savedIds.has(selectedTemplate.id) && !hasChanges(selectedTemplate) && (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Saved to database
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReset(selectedTemplate.id)}
                            disabled={!hasChanges(selectedTemplate) && !savedIds.has(selectedTemplate.id)}
                            className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Reset to Default
                          </button>
                          <button
                            onClick={() => { handleSave(selectedTemplate.id).then(() => setActiveView('preview')); }}
                            disabled={savingId === selectedTemplate.id}
                            className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            {savingId === selectedTemplate.id ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Saving…</>
                            ) : 'Save & Preview'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview View */}
                  {activeView === 'preview' && (
                    <div className="p-6">
                      {/* Inbox simulation */}
                      <div className="mb-4 p-4 rounded-xl bg-secondary/30 border border-border">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold text-foreground">Maggi May Broussard</span>
                              <span className="text-xs text-muted-foreground">maggimaybroussard@gmail.com</span>
                            </div>
                            <p className="text-sm text-foreground font-medium truncate">{getEdits(selectedTemplate).subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{getEdits(selectedTemplate).preheader}</p>
                          </div>
                        </div>
                      </div>
                      <EmailPreview edits={getEdits(selectedTemplate)} />
                      {/* Test send from preview */}
                      <div className="mt-4 p-4 rounded-xl border border-border bg-secondary/20 flex items-center gap-3 flex-wrap">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        <span className="text-xs text-muted-foreground font-medium">Send this preview to:</span>
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
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
              )}
            </div>
          </div>
        </>
      )}

      {/* Auto-Send Tab */}
      {mainTab === 'auto_send' && <AutoSendSettingsPanel />}
    </div>
  );
}
