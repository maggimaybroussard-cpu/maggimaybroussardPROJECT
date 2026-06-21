-- Migration: Case Lifecycle Email Logs
-- Tracks automated emails sent for: deliverable_approved, case_stage_changed, invoice_issued, deadline_approaching

CREATE TABLE IF NOT EXISTS public.case_lifecycle_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type = ANY (ARRAY[
    'deliverable_approved'::text,
    'case_stage_changed'::text,
    'invoice_issued'::text,
    'deadline_approaching'::text
  ])),
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  subject TEXT,
  resend_email_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])),
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_case_lifecycle_email_logs_inquiry_id ON public.case_lifecycle_email_logs(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_case_lifecycle_email_logs_event_type ON public.case_lifecycle_email_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_case_lifecycle_email_logs_created_at ON public.case_lifecycle_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_lifecycle_email_logs_status ON public.case_lifecycle_email_logs(status);

-- RLS
ALTER TABLE public.case_lifecycle_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to case_lifecycle_email_logs"
  ON public.case_lifecycle_email_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
