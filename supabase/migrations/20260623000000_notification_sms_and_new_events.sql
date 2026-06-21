-- ─── Add SMS columns to notification_event_config ────────────────────────────
ALTER TABLE public.notification_event_config
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_body_template TEXT NOT NULL DEFAULT '';

-- ─── Add SMS columns to notification_event_log ────────────────────────────────
ALTER TABLE public.notification_event_log
  ADD COLUMN IF NOT EXISTS sms_status TEXT,
  ADD COLUMN IF NOT EXISTS sms_message_sid TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- ─── Seed 6 new event types ───────────────────────────────────────────────────
INSERT INTO public.notification_event_config
  (event_key, event_label, event_category, is_enabled, sms_enabled,
   email_subject_template, email_body_template, email_badge, email_cta_label, email_cta_url_template,
   sms_body_template)
VALUES
  (
    'appointment_confirmed',
    'Appointment Confirmed',
    'general',
    true,
    false,
    'Your appointment is confirmed — {{appointmentDate}} at {{appointmentTime}}',
    'Dear {{clientName}},

Your appointment has been confirmed for {{appointmentDate}} at {{appointmentTime}}.

{{appointmentType}}

Please log in to your client portal to view appointment details or reschedule if needed.',
    'Appointment Confirmed',
    'View Portal',
    '{{siteUrl}}/portal/dashboard',
    'Broussard Legal Services: Hi {{clientName}}, your {{appointmentType}} is CONFIRMED for {{appointmentDate}} at {{appointmentTime}}. Questions? Visit {{siteUrl}}. Reply STOP to opt out.'
  ),
  (
    'appointment_reminder',
    'Appointment Reminder (24hr)',
    'general',
    true,
    false,
    'Reminder: Your appointment is tomorrow — {{appointmentDate}} at {{appointmentTime}}',
    'Dear {{clientName}},

This is a friendly reminder that your upcoming appointment is scheduled for tomorrow, {{appointmentDate}} at {{appointmentTime}}.

{{appointmentType}}

If you need to reschedule, please contact us as soon as possible.',
    'Appointment Tomorrow',
    'View Portal',
    '{{siteUrl}}/portal/dashboard',
    'Broussard Legal Services: Hi {{clientName}}, reminder — your {{appointmentType}} is TOMORROW at {{appointmentTime}} ({{appointmentDate}}). Need to reschedule? Visit {{siteUrl}}. Reply STOP to opt out.'
  ),
  (
    'retainer_renewal_due',
    'Retainer Renewal Due',
    'invoices',
    true,
    false,
    'Your retainer is due for renewal — {{retainerName}}',
    'Dear {{clientName}},

Your retainer agreement, {{retainerName}}, is coming up for renewal.

Renewal Date: {{renewalDate}}
Monthly Amount: ${{amount}}

Please log in to your client portal to review your retainer details and confirm renewal.',
    'Retainer Renewal',
    'Review Retainer',
    '{{siteUrl}}/portal/retainer',
    'Broussard Legal Services: Hi {{clientName}}, your retainer {{retainerName}} renews on {{renewalDate}} (${{amount}}/mo). Review: {{siteUrl}}/portal/retainer. Reply STOP to opt out.'
  ),
  (
    'document_approved',
    'Document Approved',
    'documents',
    true,
    false,
    'Your document has been approved — {{documentName}}',
    'Dear {{clientName}},

Great news! The following document has been reviewed and approved:

Document: {{documentName}}
Case: {{caseName}}

The approved document is now available in your client portal.',
    'Document Approved',
    'View Document',
    '{{siteUrl}}/portal/documents',
    'Broussard Legal Services: Hi {{clientName}}, your document "{{documentName}}" for {{caseName}} has been APPROVED. View it: {{siteUrl}}/portal/documents. Reply STOP to opt out.'
  ),
  (
    'intake_received',
    'Intake Form Received',
    'cases',
    true,
    false,
    'We received your intake form — {{caseName}}',
    'Dear {{clientName}},

Thank you for submitting your intake form for {{caseName}}.

Our team will review your information and reach out within 1–2 business days to discuss next steps.

In the meantime, you can log in to your client portal to track your intake status.',
    'Intake Received',
    'Check Status',
    '{{siteUrl}}/intake-status',
    'Broussard Legal Services: Hi {{clientName}}, we received your intake form for {{caseName}}. We''ll be in touch within 1-2 business days. Track status: {{siteUrl}}/intake-status. Reply STOP to opt out.'
  ),
  (
    'payment_plan_created',
    'Payment Plan Created',
    'invoices',
    true,
    false,
    'Your payment plan has been set up — {{planName}}',
    'Dear {{clientName}},

A payment plan has been created for your account.

Plan: {{planName}}
Total Amount: ${{totalAmount}}
Installments: {{installmentCount}} payments of ${{installmentAmount}}
First Payment Due: {{firstPaymentDate}}

Log in to your client portal to review your payment schedule.',
    'Payment Plan Active',
    'View Plan',
    '{{siteUrl}}/portal/billing',
    'Broussard Legal Services: Hi {{clientName}}, your payment plan {{planName}} is active — {{installmentCount}} payments of ${{installmentAmount}}. First due {{firstPaymentDate}}. View: {{siteUrl}}/portal/billing. Reply STOP to opt out.'
  )
ON CONFLICT (event_key) DO NOTHING;

-- ─── Update existing events with default SMS templates ────────────────────────
UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, a document has been shared with you for {{caseName}}: {{documentName}}. View it: {{siteUrl}}/portal/documents. Reply STOP to opt out.'
WHERE event_key = 'document_sent' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, your case {{caseName}} status has been updated to {{newStatus}}. View details: {{siteUrl}}/portal/cases. Reply STOP to opt out.'
WHERE event_key = 'case_status_updated' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, a new note has been added to your case {{caseName}}. View it: {{siteUrl}}/portal/cases. Reply STOP to opt out.'
WHERE event_key = 'case_note_added' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, invoice #{{invoiceNumber}} for ${{amount}} is due {{dueDate}}. Pay now: {{siteUrl}}/portal/invoices. Reply STOP to opt out.'
WHERE event_key = 'invoice_issued' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, invoice #{{invoiceNumber}} for ${{amount}} is OVERDUE (was due {{dueDate}}). Pay now: {{siteUrl}}/portal/invoices. Reply STOP to opt out.'
WHERE event_key = 'invoice_overdue' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, payment received for invoice #{{invoiceNumber}} (${{amount}}). Thank you! View receipt: {{siteUrl}}/portal/billing. Reply STOP to opt out.'
WHERE event_key = 'invoice_paid' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, your signature is required on "{{documentName}}". Sign now: {{siteUrl}}/portal/signatures. Reply STOP to opt out.'
WHERE event_key = 'document_signature_requested' AND sms_body_template = '';

UPDATE public.notification_event_config
SET sms_body_template = 'Broussard Legal Services: Hi {{clientName}}, your case {{caseName}} has been officially closed. View your portal: {{siteUrl}}/portal/dashboard. Reply STOP to opt out.'
WHERE event_key = 'case_closed' AND sms_body_template = '';
