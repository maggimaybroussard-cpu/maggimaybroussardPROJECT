-- ─── Consultation Outcomes ────────────────────────────────────────────────────
-- Captures post-consultation outcomes, notes, next steps, deliverables,
-- and links results back to the Clio matter record.

CREATE TABLE IF NOT EXISTS public.consultation_outcomes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID REFERENCES public.consultation_bookings(id) ON DELETE SET NULL,
  inquiry_id          UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  clio_matter_id      UUID REFERENCES public.clio_matters(id) ON DELETE SET NULL,
  clio_matter_clio_id BIGINT,
  client_name         TEXT,
  client_email        TEXT,
  consultation_date   DATE,
  outcome_summary     TEXT,
  consultation_notes  TEXT,
  next_steps          TEXT,
  deliverables        TEXT,
  follow_up_date      DATE,
  status              TEXT NOT NULL DEFAULT 'draft',
  linked_to_clio      BOOLEAN NOT NULL DEFAULT FALSE,
  clio_note_id        BIGINT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_outcomes_booking_id  ON public.consultation_outcomes(booking_id);
CREATE INDEX IF NOT EXISTS idx_consultation_outcomes_inquiry_id  ON public.consultation_outcomes(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_consultation_outcomes_clio_matter ON public.consultation_outcomes(clio_matter_id);
CREATE INDEX IF NOT EXISTS idx_consultation_outcomes_status      ON public.consultation_outcomes(status);

ALTER TABLE public.consultation_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_consultation_outcomes" ON public.consultation_outcomes;
CREATE POLICY "admin_manage_consultation_outcomes"
  ON public.consultation_outcomes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
