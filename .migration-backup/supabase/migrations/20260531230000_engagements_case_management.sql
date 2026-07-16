-- ─── Engagements & Case Management ──────────────────────────────────────────
-- Adds: engagements (client work organized by matter), case_contacts (linked contacts per case)

-- 1. Engagements table
CREATE TABLE IF NOT EXISTS public.engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  matter_number TEXT,
  engagement_type TEXT DEFAULT 'general',
  retainer_tier TEXT DEFAULT 'none',
  status TEXT DEFAULT 'active',
  description TEXT,
  start_date DATE,
  end_date DATE,
  hourly_rate NUMERIC(10,2),
  flat_fee NUMERIC(10,2),
  retainer_amount NUMERIC(10,2),
  notes TEXT,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Case contacts junction (link additional contacts to a case/inquiry)
CREATE TABLE IF NOT EXISTS public.case_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  contact_role TEXT DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_engagements_inquiry_id ON public.engagements(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON public.engagements(status);
CREATE INDEX IF NOT EXISTS idx_engagements_retainer_tier ON public.engagements(retainer_tier);
CREATE INDEX IF NOT EXISTS idx_case_contacts_inquiry_id ON public.case_contacts(inquiry_id);

-- 4. Enable RLS
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_contacts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — admin-only access (service role bypasses RLS)
DROP POLICY IF EXISTS "admin_manage_engagements" ON public.engagements;
CREATE POLICY "admin_manage_engagements"
ON public.engagements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_case_contacts" ON public.case_contacts;
CREATE POLICY "admin_manage_case_contacts"
ON public.case_contacts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Updated_at trigger for engagements
CREATE OR REPLACE FUNCTION public.set_engagements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_engagements_updated_at ON public.engagements;
CREATE TRIGGER trg_engagements_updated_at
BEFORE UPDATE ON public.engagements
FOR EACH ROW EXECUTE FUNCTION public.set_engagements_updated_at();
