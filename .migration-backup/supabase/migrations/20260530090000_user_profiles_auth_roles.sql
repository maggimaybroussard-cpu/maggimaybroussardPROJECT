-- User Profiles & Auth Roles
-- Creates user_profiles table, auto-creation trigger, role-based access control

-- ── 1. user_profiles table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    company TEXT,
    address_line1 TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    role TEXT NOT NULL DEFAULT 'client',
    avatar_url TEXT,
    notification_prefs JSONB,
    invoice_email_settings JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- ── 2. Functions (MUST be before RLS policies) ────────────────────────────────

-- Auto-create user_profiles row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'client')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Check if current user is admin (reads from auth metadata — no recursion risk)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
    )
)
$$;

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ───────────────────────────────────────────────────────────

-- Users can read and update their own profile
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can read all profiles
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update all profiles
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── 5. Triggers ───────────────────────────────────────────────────────────────

-- Auto-create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profile changes
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ── 6. Backfill existing auth users into user_profiles ────────────────────────
DO $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
    SELECT
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'full_name', ''),
        COALESCE(au.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(au.raw_user_meta_data->>'role', 'client')
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped or partial: %', SQLERRM;
END $$;
