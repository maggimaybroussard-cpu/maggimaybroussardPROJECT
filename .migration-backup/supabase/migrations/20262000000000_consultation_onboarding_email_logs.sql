-- Migration: consultation_onboarding_email_logs
-- Tracks all automated onboarding emails sent to consultation clients
-- Types: payment_confirmation, prep_documents, pre_consultation_checklist, post_consultation_followup

CREATE TABLE IF NOT EXISTS public.consultation_onboarding_email_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  email_type       TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  recipient_name   TEXT,
  subject          TEXT,
  resend_id        TEXT,
  status           TEXT NOT NULL DEFAULT 'sent',
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_email_logs_inquiry_id
  ON public.consultation_onboarding_email_logs(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_logs_email_type
  ON public.consultation_onboarding_email_logs(email_type);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_logs_sent_at
  ON public.consultation_onboarding_email_logs(sent_at DESC);

-- RLS
ALTER TABLE public.consultation_onboarding_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_onboarding_email_logs" ON public.consultation_onboarding_email_logs;
CREATE POLICY "admin_manage_onboarding_email_logs"
  ON public.consultation_onboarding_email_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_insert_onboarding_email_logs" ON public.consultation_onboarding_email_logs;
CREATE POLICY "service_role_insert_onboarding_email_logs"
  ON public.consultation_onboarding_email_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
