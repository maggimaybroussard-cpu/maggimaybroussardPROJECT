-- Client Profiles: name, firm, email, rate, retainer status
-- Used for invoice recipient selection and billing history

CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  firm TEXT,
  email TEXT NOT NULL,
  hourly_rate NUMERIC(10, 2) DEFAULT 0,
  is_retainer BOOLEAN DEFAULT false,
  retainer_amount NUMERIC(10, 2),
  notes TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_email ON public.client_profiles(email);
CREATE INDEX IF NOT EXISTS idx_client_profiles_name ON public.client_profiles(name);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_client_profiles" ON public.client_profiles;
CREATE POLICY "admin_full_access_client_profiles"
ON public.client_profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_client_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_profiles_updated_at ON public.client_profiles;
CREATE TRIGGER set_client_profiles_updated_at
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_client_profiles_updated_at();
