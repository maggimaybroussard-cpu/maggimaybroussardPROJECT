-- Lead nurture sequences: tracks automated follow-up sequences triggered by
-- form submissions and abandoned bookings, with lead scoring integration

-- ── Enum for nurture trigger types ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'nurture_trigger_type'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE TYPE public.nurture_trigger_type AS ENUM (
      'form_submission',
      'abandoned_booking',
      'intake_incomplete',
      'consultation_no_show',
      'post_consultation_no_convert'
    );
  END IF;
END $$;

-- ── Enum for nurture sequence status ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'nurture_sequence_status'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE TYPE public.nurture_sequence_status AS ENUM (
      'active',
      'paused',
      'completed',
      'converted',
      'unsubscribed'
    );
  END IF;
END $$;

-- ── Lead nurture sequences table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_nurture_sequences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  name                  TEXT NOT NULL,
  trigger_type          public.nurture_trigger_type NOT NULL DEFAULT 'form_submission',
  sequence_status       public.nurture_sequence_status NOT NULL DEFAULT 'active',
  current_step          INTEGER NOT NULL DEFAULT 0,
  total_steps           INTEGER NOT NULL DEFAULT 5,
  lead_score            INTEGER NOT NULL DEFAULT 0,
  score_tier            TEXT NOT NULL DEFAULT 'cold',
  last_email_sent_at    TIMESTAMPTZ,
  next_email_scheduled_at TIMESTAMPTZ,
  converted_at          TIMESTAMPTZ,
  conversion_type       TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lead_nurture_score_tier_check CHECK (score_tier IN ('hot', 'warm', 'cold'))
);

CREATE INDEX IF NOT EXISTS idx_lead_nurture_inquiry_id ON public.lead_nurture_sequences(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_lead_nurture_email ON public.lead_nurture_sequences(email);
CREATE INDEX IF NOT EXISTS idx_lead_nurture_status ON public.lead_nurture_sequences(sequence_status);
CREATE INDEX IF NOT EXISTS idx_lead_nurture_trigger ON public.lead_nurture_sequences(trigger_type);
CREATE INDEX IF NOT EXISTS idx_lead_nurture_next_scheduled ON public.lead_nurture_sequences(next_email_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lead_nurture_score ON public.lead_nurture_sequences(lead_score DESC);

-- ── Abandoned booking tracking table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.abandoned_booking_sequences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  name                  TEXT NOT NULL,
  abandoned_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booking_page_reached  TEXT,
  service_interest      TEXT,
  follow_up_count       INTEGER NOT NULL DEFAULT 0,
  last_follow_up_at     TIMESTAMPTZ,
  next_follow_up_at     TIMESTAMPTZ,
  sequence_status       public.nurture_sequence_status NOT NULL DEFAULT 'active',
  recovered_at          TIMESTAMPTZ,
  lead_score            INTEGER NOT NULL DEFAULT 0,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandoned_booking_inquiry_id ON public.abandoned_booking_sequences(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_booking_email ON public.abandoned_booking_sequences(email);
CREATE INDEX IF NOT EXISTS idx_abandoned_booking_status ON public.abandoned_booking_sequences(sequence_status);
CREATE INDEX IF NOT EXISTS idx_abandoned_booking_next_followup ON public.abandoned_booking_sequences(next_follow_up_at);

-- ── Nurture email log table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nurture_email_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nurture_sequence_id   UUID REFERENCES public.lead_nurture_sequences(id) ON DELETE CASCADE,
  abandoned_sequence_id UUID REFERENCES public.abandoned_booking_sequences(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  subject               TEXT NOT NULL,
  step_number           INTEGER NOT NULL DEFAULT 1,
  trigger_type          TEXT NOT NULL,
  send_status           TEXT NOT NULL DEFAULT 'pending',
  resend_email_id       TEXT,
  opened_at             TIMESTAMPTZ,
  clicked_at            TIMESTAMPTZ,
  error_message         TEXT,
  scheduled_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nurture_email_logs_nurture_id ON public.nurture_email_logs(nurture_sequence_id);
CREATE INDEX IF NOT EXISTS idx_nurture_email_logs_abandoned_id ON public.nurture_email_logs(abandoned_sequence_id);
CREATE INDEX IF NOT EXISTS idx_nurture_email_logs_email ON public.nurture_email_logs(email);
CREATE INDEX IF NOT EXISTS idx_nurture_email_logs_status ON public.nurture_email_logs(send_status);

-- ── Add lead_score column to contact_inquiries if not exists ─────────────────
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS score_tier TEXT DEFAULT 'cold';

ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS nurture_sequence_id UUID;

ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS last_nurture_step INTEGER DEFAULT 0;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.lead_nurture_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_booking_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurture_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_lead_nurture_sequences" ON public.lead_nurture_sequences;
CREATE POLICY "authenticated_manage_lead_nurture_sequences"
ON public.lead_nurture_sequences FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_lead_nurture_sequences" ON public.lead_nurture_sequences;
CREATE POLICY "public_insert_lead_nurture_sequences"
ON public.lead_nurture_sequences FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_abandoned_booking_sequences" ON public.abandoned_booking_sequences;
CREATE POLICY "authenticated_manage_abandoned_booking_sequences"
ON public.abandoned_booking_sequences FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_abandoned_booking_sequences" ON public.abandoned_booking_sequences;
CREATE POLICY "public_insert_abandoned_booking_sequences"
ON public.abandoned_booking_sequences FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_nurture_email_logs" ON public.nurture_email_logs;
CREATE POLICY "authenticated_manage_nurture_email_logs"
ON public.nurture_email_logs FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ── Auto-update updated_at triggers ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_lead_nurture_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_nurture_sequences_updated_at ON public.lead_nurture_sequences;
CREATE TRIGGER lead_nurture_sequences_updated_at
  BEFORE UPDATE ON public.lead_nurture_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_nurture_updated_at();

CREATE OR REPLACE FUNCTION public.update_abandoned_booking_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS abandoned_booking_sequences_updated_at ON public.abandoned_booking_sequences;
CREATE TRIGGER abandoned_booking_sequences_updated_at
  BEFORE UPDATE ON public.abandoned_booking_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_abandoned_booking_updated_at();
