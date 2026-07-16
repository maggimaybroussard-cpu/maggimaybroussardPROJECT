-- ─── Retainer Cases ──────────────────────────────────────────────────────────
-- Auto-created when admin marks a consultation as completed.
-- Links to the client's deliverable hub (case_documents via inquiry_id)
-- and action items timeline (consultation_action_items via inquiry_id).

-- 1. Retainer cases table
CREATE TABLE IF NOT EXISTS public.retainer_cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  case_number           TEXT NOT NULL,
  title                 TEXT NOT NULL,
  service_type          TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  -- Client info (denormalized for quick access)
  client_name           TEXT,
  client_email          TEXT,
  client_firm           TEXT,
  -- Retainer details
  retainer_tier         TEXT DEFAULT 'standard',
  retainer_amount       NUMERIC(10,2),
  -- Linked engagement (if one was created)
  engagement_id         UUID REFERENCES public.engagements(id) ON DELETE SET NULL,
  -- Dates
  consultation_date     TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at             TIMESTAMPTZ,
  -- Notes
  notes                 TEXT,
  -- Metadata
  created_by            TEXT DEFAULT 'system',
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sequence for case numbers
CREATE SEQUENCE IF NOT EXISTS public.retainer_case_number_seq START 1001;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_retainer_cases_inquiry_id   ON public.retainer_cases(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_retainer_cases_status        ON public.retainer_cases(status);
CREATE INDEX IF NOT EXISTS idx_retainer_cases_client_email  ON public.retainer_cases(client_email);
CREATE INDEX IF NOT EXISTS idx_retainer_cases_opened_at     ON public.retainer_cases(opened_at);

-- 4. Enable RLS
ALTER TABLE public.retainer_cases ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "admin_manage_retainer_cases" ON public.retainer_cases;
CREATE POLICY "admin_manage_retainer_cases"
ON public.retainer_cases
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_retainer_cases" ON public.retainer_cases;
CREATE POLICY "anon_read_retainer_cases"
ON public.retainer_cases
FOR SELECT
TO anon
USING (true);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_retainer_cases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retainer_cases_updated_at ON public.retainer_cases;
CREATE TRIGGER trg_retainer_cases_updated_at
BEFORE UPDATE ON public.retainer_cases
FOR EACH ROW EXECUTE FUNCTION public.set_retainer_cases_updated_at();
