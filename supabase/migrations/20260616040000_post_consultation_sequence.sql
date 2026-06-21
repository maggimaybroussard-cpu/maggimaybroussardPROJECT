-- Post-consultation email sequence tracking
-- Adds index and metadata to support post_consultation sequence type
-- The email_sequences table already exists; this migration adds supporting structure.

-- Index for fast lookup of post-consultation sequences by inquiry
CREATE INDEX IF NOT EXISTS idx_email_sequences_post_consultation
  ON public.email_sequences (inquiry_id, sequence_type, step_number)
  WHERE sequence_type = 'post_consultation';

-- Log table to track when post-consultation sequences were triggered
CREATE TABLE IF NOT EXISTS public.post_consultation_sequence_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id    uuid NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  triggered_at  timestamptz NOT NULL DEFAULT now(),
  triggered_by  text NOT NULL DEFAULT 'admin_status_change',
  client_email  text,
  client_name   text,
  service       text,
  steps_scheduled int NOT NULL DEFAULT 3,
  notes         text
);

-- RLS
ALTER TABLE public.post_consultation_sequence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access post_consultation_sequence_logs"
  ON public.post_consultation_sequence_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for quick lookup by inquiry
CREATE INDEX IF NOT EXISTS idx_post_consultation_logs_inquiry
  ON public.post_consultation_sequence_logs (inquiry_id);
