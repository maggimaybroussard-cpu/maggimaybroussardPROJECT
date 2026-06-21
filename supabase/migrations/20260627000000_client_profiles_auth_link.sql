-- Client Profiles Auth Link
-- Adds user_id to client_profiles for role-based access
-- Clients can read/update their own profile; admins retain full access

-- ── 1. Add user_id column to client_profiles ─────────────────────────────────
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON public.client_profiles(user_id);

-- ── 2. Function: auto-create or link client_profile from intake data ──────────
-- Called by the Typeform intake webhook API route (server-side, service role)
CREATE OR REPLACE FUNCTION public.upsert_client_profile_from_intake(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_firm TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Upsert by email: create if not exists, update name/phone/firm if exists
  INSERT INTO public.client_profiles (name, email, phone, firm, notes)
  VALUES (p_name, p_email, p_phone, p_firm, p_notes)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, public.client_profiles.phone),
    firm = COALESCE(EXCLUDED.firm, public.client_profiles.firm),
    notes = COALESCE(EXCLUDED.notes, public.client_profiles.notes),
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

-- ── 3. Function: link client_profile to auth user on login ────────────────────
-- Triggered when a new auth user is created — links by matching email
CREATE OR REPLACE FUNCTION public.link_client_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If a client_profile exists with this email, link it to the new auth user
  UPDATE public.client_profiles
  SET user_id = NEW.id, updated_at = CURRENT_TIMESTAMP
  WHERE email = NEW.email
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

-- ── 4. Trigger: fires after new auth user created ─────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_link_client_profile ON auth.users;
CREATE TRIGGER on_auth_user_link_client_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_client_profile_on_signup();

-- ── 5. Backfill: link existing auth users to client_profiles by email ─────────
DO $$
BEGIN
  UPDATE public.client_profiles cp
  SET user_id = au.id, updated_at = CURRENT_TIMESTAMP
  FROM auth.users au
  WHERE au.email = cp.email
    AND cp.user_id IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill link skipped: %', SQLERRM;
END $$;

-- ── 6. RLS: clients can read their own profile ────────────────────────────────
-- Keep existing admin policy, add client self-access policy

DROP POLICY IF EXISTS "clients_read_own_profile" ON public.client_profiles;
CREATE POLICY "clients_read_own_profile"
ON public.client_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_update_own_profile" ON public.client_profiles;
CREATE POLICY "clients_update_own_profile"
ON public.client_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ── 7. Unique constraint on email for upsert ─────────────────────────────────
-- Only add if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_profiles'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'client_profiles_email_key'
  ) THEN
    ALTER TABLE public.client_profiles ADD CONSTRAINT client_profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unique constraint already exists or could not be added: %', SQLERRM;
END $$;
