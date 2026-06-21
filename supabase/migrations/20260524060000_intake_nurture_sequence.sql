-- Intake Nurture Sequence: adds intake_nurture type to email_sequence_type enum
-- and a dedicated intake_nurture_sequences table for tracking per-submission sequences

-- ── 1. Extend email_sequence_type enum ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'intake_nurture'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'intake_nurture';
  END IF;
END;
$$;

-- ── 2. intake_nurture_sequences table ─────────────────────────────────────────
-- Tracks the multi-step nurture sequence triggered by intake form submission.
-- Separate from email_sequences so it can be queried independently in admin.
CREATE TABLE IF NOT EXISTS public.intake_nurture_sequences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  inquiry_id        UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  recipient_email   TEXT NOT NULL,
  recipient_name    TEXT NOT NULL,
  case_type         TEXT NOT NULL,
  urgency           TEXT NOT NULL DEFAULT 'standard',
  sequence_type     TEXT NOT NULL DEFAULT 'intake_nurture',
  step_number       INTEGER NOT NULL DEFAULT 1,
  step_label        TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  sent_at           TIMESTAMPTZ,
  send_status       public.email_send_status NOT NULL DEFAULT 'pending',
  resend_email_id   TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_nurture_submission_id ON public.intake_nurture_sequences(submission_id);
CREATE INDEX IF NOT EXISTS idx_intake_nurture_recipient_email ON public.intake_nurture_sequences(recipient_email);
CREATE INDEX IF NOT EXISTS idx_intake_nurture_scheduled_at ON public.intake_nurture_sequences(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_intake_nurture_send_status ON public.intake_nurture_sequences(send_status);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.intake_nurture_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_manage_intake_nurture_sequences" ON public.intake_nurture_sequences;
CREATE POLICY "authenticated_can_manage_intake_nurture_sequences"
ON public.intake_nurture_sequences
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "public_can_insert_intake_nurture_sequences" ON public.intake_nurture_sequences;
CREATE POLICY "public_can_insert_intake_nurture_sequences"
ON public.intake_nurture_sequences
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_can_update_intake_nurture_sequences" ON public.intake_nurture_sequences;
CREATE POLICY "service_role_can_update_intake_nurture_sequences"
ON public.intake_nurture_sequences
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_intake_nurture_sequences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intake_nurture_sequences_updated_at ON public.intake_nurture_sequences;
CREATE TRIGGER intake_nurture_sequences_updated_at
  BEFORE UPDATE ON public.intake_nurture_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_intake_nurture_sequences_updated_at();
