-- ─── Notification Event Configuration ────────────────────────────────────────
-- Stores admin-configured rules for which events trigger client email notifications

CREATE TABLE IF NOT EXISTS public.notification_event_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_label TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  email_subject_template TEXT NOT NULL DEFAULT '',
  email_body_template TEXT NOT NULL DEFAULT '',
  email_badge TEXT NOT NULL DEFAULT '',
  email_cta_label TEXT NOT NULL DEFAULT '',
  email_cta_url_template TEXT NOT NULL DEFAULT '',
  send_delay_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_event_config_key ON public.notification_event_config(event_key);
CREATE INDEX IF NOT EXISTS idx_notification_event_config_category ON public.notification_event_config(event_category);

ALTER TABLE public.notification_event_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_notification_event_config" ON public.notification_event_config;
CREATE POLICY "admin_manage_notification_event_config"
ON public.notification_event_config
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_notification_event_config" ON public.notification_event_config;
CREATE POLICY "public_read_notification_event_config"
ON public.notification_event_config
FOR SELECT
TO anon
USING (true);

-- ─── Notification Event Send Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_event_log_event_key ON public.notification_event_log(event_key);
CREATE INDEX IF NOT EXISTS idx_notification_event_log_sent_at ON public.notification_event_log(sent_at DESC);

ALTER TABLE public.notification_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_notification_event_log" ON public.notification_event_log;
CREATE POLICY "admin_manage_notification_event_log"
ON public.notification_event_log
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── Seed Default Event Configurations ────────────────────────────────────────
INSERT INTO public.notification_event_config
  (event_key, event_label, event_category, is_enabled, email_subject_template, email_body_template, email_badge, email_cta_label, email_cta_url_template)
VALUES
  (
    'document_sent',
    'Document Sent to Client',
    'documents',
    true,
    'A document has been shared with you — {{caseName}}',
    'Dear {{clientName}},

A new document has been shared with you for your case: {{caseName}}.

Document: {{documentName}}

Please log in to your client portal to review and download the document at your earliest convenience.',
    'Document Ready',
    'View Document',
    '{{siteUrl}}/portal/documents'
  ),
  (
    'case_status_updated',
    'Case Status Updated',
    'cases',
    true,
    'Case update: {{caseName}} — Status changed to {{newStatus}}',
    'Dear {{clientName}},

There has been an update to your case: {{caseName}}.

Your case status has been updated to: {{newStatus}}.

{{updateNotes}}

Please log in to your client portal to view the full details and any new documents or messages.',
    'Case Update',
    'View Case',
    '{{siteUrl}}/portal/cases'
  ),
  (
    'case_note_added',
    'Note Added to Case',
    'cases',
    true,
    'New note on your case — {{caseName}}',
    'Dear {{clientName}},

A new note has been added to your case: {{caseName}}.

{{noteContent}}

Log in to your portal to view the full case timeline and respond if needed.',
    'Case Note',
    'View Case',
    '{{siteUrl}}/portal/cases'
  ),
  (
    'invoice_issued',
    'Invoice Issued',
    'invoices',
    true,
    'Invoice #{{invoiceNumber}} — ${{amount}} due {{dueDate}}',
    'Dear {{clientName}},

A new invoice has been issued for your account.

Invoice #: {{invoiceNumber}}
Amount Due: ${{amount}}
Due Date: {{dueDate}}

Please log in to your client portal to review and pay your invoice.',
    'Invoice Issued',
    'Pay Invoice',
    '{{siteUrl}}/portal/invoices'
  ),
  (
    'invoice_overdue',
    'Invoice Overdue Reminder',
    'invoices',
    true,
    'Reminder: Invoice #{{invoiceNumber}} is past due — ${{amount}}',
    'Dear {{clientName}},

This is a friendly reminder that invoice #{{invoiceNumber}} for ${{amount}} was due on {{dueDate}} and remains unpaid.

Please log in to your client portal to complete payment at your earliest convenience. If you have any questions or need to discuss a payment arrangement, please do not hesitate to contact us.',
    'Payment Overdue',
    'Pay Now',
    '{{siteUrl}}/portal/invoices'
  ),
  (
    'invoice_paid',
    'Invoice Payment Confirmed',
    'invoices',
    true,
    'Payment received — Invoice #{{invoiceNumber}} confirmed',
    'Dear {{clientName}},

We have received your payment for invoice #{{invoiceNumber}} in the amount of ${{amount}}.

Thank you for your prompt payment. A receipt has been saved to your client portal for your records.',
    'Payment Confirmed',
    'View Receipt',
    '{{siteUrl}}/portal/billing'
  ),
  (
    'document_signature_requested',
    'Signature Requested on Document',
    'documents',
    true,
    'Your signature is required — {{documentName}}',
    'Dear {{clientName}},

Your electronic signature is required on the following document: {{documentName}}.

Please log in to your client portal to review and sign the document at your earliest convenience.',
    'Signature Required',
    'Sign Document',
    '{{siteUrl}}/portal/signatures'
  ),
  (
    'case_closed',
    'Case Closed',
    'cases',
    true,
    'Your case has been closed — {{caseName}}',
    'Dear {{clientName}},

We are writing to inform you that your case, {{caseName}}, has been officially closed.

It has been a pleasure working with you. All documents related to your matter are available in your client portal for your records.

If you have any questions or need assistance in the future, please do not hesitate to reach out.',
    'Case Closed',
    'View Portal',
    '{{siteUrl}}/portal/dashboard'
  )
ON CONFLICT (event_key) DO NOTHING;
