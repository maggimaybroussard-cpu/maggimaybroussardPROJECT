-- Subscriber nurture sequence for lead magnet opt-ins
-- Tracks nurture emails sent to email_subscribers (not contact_inquiries)

-- Extend email_sequence_type enum with subscriber-specific types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_welcome'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_welcome';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_case_tips'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_case_tips';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_consultation_prompt'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_consultation_prompt';
  END IF;
END $$;

-- Add nurture tracking columns to email_subscribers
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS nurture_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nurture_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Table to track scheduled/sent nurture emails per subscriber
CREATE TABLE IF NOT EXISTS public.subscriber_email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES public.email_subscribers(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_subscriber_sequences_subscriber_id ON public.subscriber_email_sequences(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_sequences_scheduled_at ON public.subscriber_email_sequences(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_subscriber_sequences_send_status ON public.subscriber_email_sequences(send_status);
CREATE INDEX IF NOT EXISTS idx_subscriber_sequences_sequence_type ON public.subscriber_email_sequences(sequence_type);

-- Enable RLS
ALTER TABLE public.subscriber_email_sequences ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admin) can manage sequences
DROP POLICY IF EXISTS "authenticated_can_manage_subscriber_sequences" ON public.subscriber_email_sequences;
CREATE POLICY "authenticated_can_manage_subscriber_sequences"
ON public.subscriber_email_sequences
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Service role can insert (triggered by opt-in API)
DROP POLICY IF EXISTS "service_can_insert_subscriber_sequences" ON public.subscriber_email_sequences;
CREATE POLICY "service_can_insert_subscriber_sequences"
ON public.subscriber_email_sequences
FOR INSERT
TO public
WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_subscriber_sequences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriber_sequences_updated_at ON public.subscriber_email_sequences;
CREATE TRIGGER subscriber_sequences_updated_at
  BEFORE UPDATE ON public.subscriber_email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscriber_sequences_updated_at();
