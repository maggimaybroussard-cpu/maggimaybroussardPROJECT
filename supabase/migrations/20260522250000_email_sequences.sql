-- Email sequences and nurture tracking for booking reminders and lead re-engagement

-- Enum for sequence types
DROP TYPE IF EXISTS public.email_sequence_type CASCADE;
CREATE TYPE public.email_sequence_type AS ENUM (
  'booking_reminder',
  'lead_nurture',
  'consultation_followup',
  'reengagement'
);

-- Enum for email send status
DROP TYPE IF EXISTS public.email_send_status CASCADE;
CREATE TYPE public.email_send_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

-- Table to track scheduled/sent nurture emails per inquiry
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  sequence_type public.email_sequence_type NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  send_status public.email_send_status NOT NULL DEFAULT 'pending',
  resend_email_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_sequences_inquiry_id ON public.email_sequences(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_scheduled_at ON public.email_sequences(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_sequences_send_status ON public.email_sequences(send_status);
CREATE INDEX IF NOT EXISTS idx_email_sequences_sequence_type ON public.email_sequences(sequence_type);

-- Enable RLS
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admin) can manage sequences
DROP POLICY IF EXISTS "authenticated_can_manage_email_sequences" ON public.email_sequences;
CREATE POLICY "authenticated_can_manage_email_sequences"
ON public.email_sequences
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Public can insert (triggered by contact form)
DROP POLICY IF EXISTS "public_can_insert_email_sequences" ON public.email_sequences;
CREATE POLICY "public_can_insert_email_sequences"
ON public.email_sequences
FOR INSERT
TO public
WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_email_sequences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_sequences_updated_at ON public.email_sequences;
CREATE TRIGGER email_sequences_updated_at
  BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_sequences_updated_at();
