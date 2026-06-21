-- ─── Matter Close Email Logs ─────────────────────────────────────────────────
-- Tracks transactional emails sent when a matter closes

CREATE TABLE IF NOT EXISTS public.matter_close_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  outcome_id UUID REFERENCES public.matter_outcomes(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('client', 'staff')),
  outcome TEXT NOT NULL,
  settlement_amount NUMERIC(12, 2),
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_matter_close_email_logs_inquiry
  ON public.matter_close_email_logs(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_matter_close_email_logs_sent_at
  ON public.matter_close_email_logs(sent_at DESC);

ALTER TABLE public.matter_close_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_matter_close_email_logs" ON public.matter_close_email_logs;
CREATE POLICY "admin_manage_matter_close_email_logs"
  ON public.matter_close_email_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
