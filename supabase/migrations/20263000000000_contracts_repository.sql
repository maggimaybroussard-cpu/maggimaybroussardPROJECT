-- ── Contracts Repository ──────────────────────────────────────────────────────
-- Stores contracts accessible by both admin and clients

CREATE TABLE IF NOT EXISTS public.contracts_repository (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  user_id UUID,
  client_email TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  signed_at TIMESTAMPTZ,
  effective_date DATE,
  expiry_date DATE,
  version TEXT DEFAULT '1.0',
  tags TEXT[],
  is_template BOOLEAN DEFAULT false,
  visible_to_client BOOLEAN DEFAULT true,
  uploaded_by TEXT DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_repository_inquiry_id ON public.contracts_repository(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_contracts_repository_user_id ON public.contracts_repository(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_repository_client_email ON public.contracts_repository(client_email);
CREATE INDEX IF NOT EXISTS idx_contracts_repository_status ON public.contracts_repository(status);
CREATE INDEX IF NOT EXISTS idx_contracts_repository_contract_type ON public.contracts_repository(contract_type);

ALTER TABLE public.contracts_repository ENABLE ROW LEVEL SECURITY;

-- Admin function (uses auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
      OR au.email LIKE '%@broussardlegalservices.com'
    )
  )
$$;

-- Client access function: checks if client is linked to the contract
CREATE OR REPLACE FUNCTION public.client_can_access_contract(contract_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts_repository cr
    LEFT JOIN public.client_portal_access cpa ON cpa.inquiry_id = cr.inquiry_id
    WHERE cr.id = contract_id
    AND cr.visible_to_client = true
    AND (
      cr.user_id = auth.uid()
      OR cpa.user_id = auth.uid()
    )
  )
$$;

-- Admin: full access
DROP POLICY IF EXISTS "admin_full_access_contracts_repository" ON public.contracts_repository;
CREATE POLICY "admin_full_access_contracts_repository"
ON public.contracts_repository
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Clients: read-only access to their own contracts
DROP POLICY IF EXISTS "clients_read_own_contracts" ON public.contracts_repository;
CREATE POLICY "clients_read_own_contracts"
ON public.contracts_repository
FOR SELECT
TO authenticated
USING (
  visible_to_client = true
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.user_id = auth.uid()
      AND cpa.inquiry_id = contracts_repository.inquiry_id
    )
  )
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_contracts_repository_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_repository_updated_at ON public.contracts_repository;
CREATE TRIGGER contracts_repository_updated_at
  BEFORE UPDATE ON public.contracts_repository
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contracts_repository_updated_at();
