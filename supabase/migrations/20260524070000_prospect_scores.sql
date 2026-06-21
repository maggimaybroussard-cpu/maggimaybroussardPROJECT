-- Prospect scoring table: stores auto-generated scores for intake submissions
-- Scores are computed from case complexity, budget signals, and engagement history

CREATE TABLE IF NOT EXISTS public.prospect_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         UUID REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  inquiry_id            UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  email                 TEXT NOT NULL,
  name                  TEXT NOT NULL,

  -- Score dimensions (0–100 each)
  complexity_score      INTEGER NOT NULL DEFAULT 0,
  budget_score          INTEGER NOT NULL DEFAULT 0,
  engagement_score      INTEGER NOT NULL DEFAULT 0,
  total_score           INTEGER NOT NULL DEFAULT 0,

  -- Score tier: hot / warm / cold
  score_tier            TEXT NOT NULL DEFAULT 'cold',

  -- Scoring signals (stored for transparency)
  signals               JSONB NOT NULL DEFAULT '{}',

  -- Recommended action
  recommended_action    TEXT,

  -- Metadata
  scored_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT prospect_scores_tier_check CHECK (score_tier IN ('hot', 'warm', 'cold'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_scores_submission_id ON public.prospect_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_prospect_scores_inquiry_id ON public.prospect_scores(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_prospect_scores_email ON public.prospect_scores(email);
CREATE INDEX IF NOT EXISTS idx_prospect_scores_total_score ON public.prospect_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_scores_score_tier ON public.prospect_scores(score_tier);

ALTER TABLE public.prospect_scores ENABLE ROW LEVEL SECURITY;

-- Public insert: edge function (anon key) can write scores
DROP POLICY IF EXISTS "public_can_insert_prospect_scores" ON public.prospect_scores;
CREATE POLICY "public_can_insert_prospect_scores"
ON public.prospect_scores
FOR INSERT
TO public
WITH CHECK (true);

-- Authenticated (admin) can read all scores
DROP POLICY IF EXISTS "authenticated_can_read_prospect_scores" ON public.prospect_scores;
CREATE POLICY "authenticated_can_read_prospect_scores"
ON public.prospect_scores
FOR SELECT
TO authenticated
USING (true);

-- Public update: edge function can update scores
DROP POLICY IF EXISTS "public_can_update_prospect_scores" ON public.prospect_scores;
CREATE POLICY "public_can_update_prospect_scores"
ON public.prospect_scores
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
