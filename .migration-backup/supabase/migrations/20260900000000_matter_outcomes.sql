-- ─── Matter Outcomes: Closed Matter Tracking ─────────────────────────────────
-- Tracks closed matter outcomes (settled, won, favorable judgment, dismissed)
-- Enables success rate analytics by case type and expertise strength areas

-- 1. Outcome type enum
DROP TYPE IF EXISTS public.matter_outcome_type CASCADE;
CREATE TYPE public.matter_outcome_type AS ENUM (
  'won',
  'settled',
  'favorable_judgment',
  'dismissed',
  'lost',
  'withdrawn',
  'pending_close'
);

-- 2. Matter outcomes table
CREATE TABLE IF NOT EXISTS public.matter_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  outcome public.matter_outcome_type NOT NULL,
  case_type TEXT NOT NULL,
  close_date DATE NOT NULL DEFAULT CURRENT_DATE,
  settlement_amount NUMERIC(12, 2),
  notes TEXT,
  marketing_highlight BOOLEAN NOT NULL DEFAULT false,
  expertise_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_matter_outcomes_inquiry_id
  ON public.matter_outcomes(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_matter_outcomes_outcome
  ON public.matter_outcomes(outcome);

CREATE INDEX IF NOT EXISTS idx_matter_outcomes_case_type
  ON public.matter_outcomes(case_type);

CREATE INDEX IF NOT EXISTS idx_matter_outcomes_close_date
  ON public.matter_outcomes(close_date DESC);

CREATE INDEX IF NOT EXISTS idx_matter_outcomes_marketing
  ON public.matter_outcomes(marketing_highlight) WHERE marketing_highlight = true;

-- 4. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_matter_outcomes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.matter_outcomes ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (admin-only via service role / open for admin panel)
DROP POLICY IF EXISTS "admin_manage_matter_outcomes" ON public.matter_outcomes;
CREATE POLICY "admin_manage_matter_outcomes"
  ON public.matter_outcomes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 7. Trigger
DROP TRIGGER IF EXISTS trg_matter_outcomes_updated_at ON public.matter_outcomes;
CREATE TRIGGER trg_matter_outcomes_updated_at
  BEFORE UPDATE ON public.matter_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_matter_outcomes_updated_at();

-- 8. Sample data
DO $$
DECLARE
  sample_inquiry_id UUID;
BEGIN
  SELECT id INTO sample_inquiry_id FROM public.contact_inquiries LIMIT 1;

  IF sample_inquiry_id IS NOT NULL THEN
    INSERT INTO public.matter_outcomes (
      id, inquiry_id, outcome, case_type, close_date,
      settlement_amount, notes, marketing_highlight, expertise_tags
    ) VALUES
      (gen_random_uuid(), sample_inquiry_id, 'won', 'Personal Injury',
       CURRENT_DATE - 30, 125000.00,
       'Jury verdict in favor of client. Damages awarded for medical expenses and pain and suffering.',
       true, ARRAY['personal injury', 'trial', 'jury verdict']),
      (gen_random_uuid(), sample_inquiry_id, 'settled', 'Employment Law',
       CURRENT_DATE - 60, 45000.00,
       'Pre-trial settlement reached. Client satisfied with outcome.',
       true, ARRAY['employment', 'discrimination', 'settlement']),
      (gen_random_uuid(), sample_inquiry_id, 'favorable_judgment', 'Contract Dispute',
       CURRENT_DATE - 90, NULL,
       'Summary judgment granted in favor of client. Contract enforced.',
       false, ARRAY['contract', 'business law', 'summary judgment']),
      (gen_random_uuid(), sample_inquiry_id, 'dismissed', 'Criminal Defense',
       CURRENT_DATE - 45, NULL,
       'Charges dismissed due to insufficient evidence.',
       true, ARRAY['criminal defense', 'dismissal'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample matter outcomes data skipped: %', SQLERRM;
END $$;
