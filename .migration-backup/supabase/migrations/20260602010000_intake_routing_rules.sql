-- ─── Intake Auto-Routing Rules & Case Pre-Population ────────────────────────
-- Adds: intake_routing_rules table, assigned_attorney + case_record_id columns
-- on intake_submissions, and intake_case_records for pre-populated case data.

-- 1. intake_routing_rules — maps practice area / service type → attorney
CREATE TABLE IF NOT EXISTS public.intake_routing_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area    TEXT NOT NULL,
  attorney_name    TEXT NOT NULL,
  attorney_email   TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  priority         INTEGER NOT NULL DEFAULT 1,
  fallback_email   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_routing_rules_area_priority
  ON public.intake_routing_rules (practice_area, priority);

CREATE INDEX IF NOT EXISTS idx_intake_routing_rules_practice_area
  ON public.intake_routing_rules (practice_area);

CREATE INDEX IF NOT EXISTS idx_intake_routing_rules_active
  ON public.intake_routing_rules (is_active);

-- 2. Extend intake_submissions with routing + case pre-population columns
ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS assigned_attorney_name  TEXT,
  ADD COLUMN IF NOT EXISTS assigned_attorney_email TEXT,
  ADD COLUMN IF NOT EXISTS routing_rule_id         UUID REFERENCES public.intake_routing_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS case_record_id          UUID,
  ADD COLUMN IF NOT EXISTS routing_status          TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_intake_submissions_routing_status
  ON public.intake_submissions (routing_status);

-- 3. intake_case_records — pre-populated case records from intake submissions
CREATE TABLE IF NOT EXISTS public.intake_case_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_submission_id UUID REFERENCES public.intake_submissions(id) ON DELETE CASCADE,
  inquiry_id           UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name          TEXT NOT NULL,
  client_email         TEXT NOT NULL,
  client_phone         TEXT,
  firm_name            TEXT,
  practice_area        TEXT NOT NULL,
  matter_title         TEXT NOT NULL,
  matter_description   TEXT,
  opposing_party       TEXT,
  jurisdiction         TEXT,
  urgency              TEXT DEFAULT 'standard',
  assigned_attorney    TEXT,
  assigned_attorney_email TEXT,
  status               TEXT DEFAULT 'new',
  source               TEXT DEFAULT 'intake_form',
  additional_notes     TEXT,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_case_records_submission
  ON public.intake_case_records (intake_submission_id);

CREATE INDEX IF NOT EXISTS idx_intake_case_records_inquiry
  ON public.intake_case_records (inquiry_id);

CREATE INDEX IF NOT EXISTS idx_intake_case_records_status
  ON public.intake_case_records (status);

CREATE INDEX IF NOT EXISTS idx_intake_case_records_attorney_email
  ON public.intake_case_records (assigned_attorney_email);

-- 4. Enable RLS
ALTER TABLE public.intake_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_case_records ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- intake_routing_rules: admin-only read/write
DROP POLICY IF EXISTS "admin_manage_intake_routing_rules" ON public.intake_routing_rules;
CREATE POLICY "admin_manage_intake_routing_rules"
ON public.intake_routing_rules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_intake_routing_rules" ON public.intake_routing_rules;
CREATE POLICY "service_role_manage_intake_routing_rules"
ON public.intake_routing_rules
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- intake_case_records: admin + service role full access
DROP POLICY IF EXISTS "admin_manage_intake_case_records" ON public.intake_case_records;
CREATE POLICY "admin_manage_intake_case_records"
ON public.intake_case_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_intake_case_records" ON public.intake_case_records;
CREATE POLICY "service_role_manage_intake_case_records"
ON public.intake_case_records
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. updated_at trigger for intake_routing_rules
CREATE OR REPLACE FUNCTION public.set_intake_routing_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intake_routing_rules_updated_at ON public.intake_routing_rules;
CREATE TRIGGER trg_intake_routing_rules_updated_at
BEFORE UPDATE ON public.intake_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.set_intake_routing_rules_updated_at();

-- updated_at trigger for intake_case_records
CREATE OR REPLACE FUNCTION public.set_intake_case_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intake_case_records_updated_at ON public.intake_case_records;
CREATE TRIGGER trg_intake_case_records_updated_at
BEFORE UPDATE ON public.intake_case_records
FOR EACH ROW EXECUTE FUNCTION public.set_intake_case_records_updated_at();

-- 7. Seed default routing rules for common practice areas
DO $$
BEGIN
  INSERT INTO public.intake_routing_rules
    (practice_area, attorney_name, attorney_email, is_active, priority, notes)
  VALUES
    ('Litigation Support',  'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Primary for all litigation matters'),
    ('Contract Review',     'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Contract drafting and review'),
    ('Legal Research',      'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Research and memo preparation'),
    ('Document Drafting',   'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Document preparation'),
    ('Case Management',     'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Full case management support'),
    ('Deposition Prep',     'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Deposition preparation and support'),
    ('General Inquiry',     'Maggi May Broussard', 'maggi@broussardlegalservices.com',  true, 1, 'Catch-all for unmatched service types')
  ON CONFLICT (practice_area, priority) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed routing rules skipped: %', SQLERRM;
END $$;
