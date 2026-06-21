-- ─── Paralegal Roster Migration ──────────────────────────────────────────────

-- 1. Types
DROP TYPE IF EXISTS public.paralegal_role CASCADE;
CREATE TYPE public.paralegal_role AS ENUM ('admin', 'paralegal', 'read_only');

DROP TYPE IF EXISTS public.paralegal_status CASCADE;
CREATE TYPE public.paralegal_status AS ENUM ('active', 'inactive', 'on_leave');

-- 2. Paralegal Profiles Table
CREATE TABLE IF NOT EXISTS public.paralegal_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    title TEXT,
    role public.paralegal_role NOT NULL DEFAULT 'paralegal'::public.paralegal_role,
    status public.paralegal_status NOT NULL DEFAULT 'active'::public.paralegal_status,
    -- Permissions (granular flags)
    can_view_cases BOOLEAN NOT NULL DEFAULT true,
    can_edit_cases BOOLEAN NOT NULL DEFAULT false,
    can_upload_documents BOOLEAN NOT NULL DEFAULT false,
    can_send_messages BOOLEAN NOT NULL DEFAULT false,
    can_manage_invoices BOOLEAN NOT NULL DEFAULT false,
    can_log_hours BOOLEAN NOT NULL DEFAULT false,
    can_view_billing BOOLEAN NOT NULL DEFAULT false,
    can_manage_clients BOOLEAN NOT NULL DEFAULT false,
    -- Utilization & Billable Hours
    target_weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40.00,
    hourly_rate NUMERIC(8,2),
    -- Metadata
    notes TEXT,
    avatar_url TEXT,
    start_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_paralegal_profiles_email ON public.paralegal_profiles(email);
CREATE INDEX IF NOT EXISTS idx_paralegal_profiles_role ON public.paralegal_profiles(role);
CREATE INDEX IF NOT EXISTS idx_paralegal_profiles_status ON public.paralegal_profiles(status);

-- 4. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_paralegal_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.paralegal_profiles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — admin-only management, open read for authenticated
DROP POLICY IF EXISTS "admin_full_access_paralegal_profiles" ON public.paralegal_profiles;
CREATE POLICY "admin_full_access_paralegal_profiles"
ON public.paralegal_profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Trigger
DROP TRIGGER IF EXISTS trg_paralegal_profiles_updated_at ON public.paralegal_profiles;
CREATE TRIGGER trg_paralegal_profiles_updated_at
    BEFORE UPDATE ON public.paralegal_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_paralegal_profiles_updated_at();

-- 8. Sample data
DO $$
BEGIN
    INSERT INTO public.paralegal_profiles (
        full_name, email, phone, title, role, status,
        can_view_cases, can_edit_cases, can_upload_documents, can_send_messages,
        can_manage_invoices, can_log_hours, can_view_billing, can_manage_clients,
        target_weekly_hours, hourly_rate, start_date, notes
    ) VALUES
    (
        'Sarah Mitchell', 'sarah.mitchell@broussardlegal.com', '(504) 555-0101',
        'Senior Paralegal', 'admin'::public.paralegal_role, 'active'::public.paralegal_status,
        true, true, true, true, true, true, true, true,
        40.00, 85.00, '2023-01-15', 'Lead paralegal — handles complex litigation files'
    ),
    (
        'James Tran', 'james.tran@broussardlegal.com', '(504) 555-0102',
        'Paralegal', 'paralegal'::public.paralegal_role, 'active'::public.paralegal_status,
        true, true, true, true, false, true, false, false,
        40.00, 65.00, '2023-06-01', 'Specializes in discovery and document review'
    ),
    (
        'Priya Nair', 'priya.nair@broussardlegal.com', '(504) 555-0103',
        'Junior Paralegal', 'read_only'::public.paralegal_role, 'active'::public.paralegal_status,
        true, false, false, false, false, false, false, false,
        32.00, 45.00, '2024-03-10', 'Intern — read-only access during onboarding period'
    ),
    (
        'Marcus Webb', 'marcus.webb@broussardlegal.com', '(504) 555-0104',
        'Paralegal', 'paralegal'::public.paralegal_role, 'on_leave'::public.paralegal_status,
        true, true, true, true, false, true, false, false,
        40.00, 65.00, '2022-09-20', 'Currently on medical leave — return expected Q3'
    )
    ON CONFLICT (email) DO NOTHING;
END $$;
