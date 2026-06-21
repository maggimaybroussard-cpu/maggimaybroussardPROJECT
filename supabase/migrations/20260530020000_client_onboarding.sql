-- Client Onboarding: tracks multi-step welcome sequence completion per user

CREATE TABLE IF NOT EXISTS public.client_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Step completion flags
    email_verified BOOLEAN NOT NULL DEFAULT false,
    profile_completed BOOLEAN NOT NULL DEFAULT false,
    retainer_accepted BOOLEAN NOT NULL DEFAULT false,
    payment_linked BOOLEAN NOT NULL DEFAULT false,
    case_confirmed BOOLEAN NOT NULL DEFAULT false,
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    -- Profile data collected during onboarding
    firm_name TEXT,
    practice_area TEXT,
    phone TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_onboarding_user_id ON public.client_onboarding(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_client_onboarding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    IF NEW.onboarding_complete = true AND OLD.onboarding_complete = false THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_onboarding_updated_at ON public.client_onboarding;
CREATE TRIGGER trg_client_onboarding_updated_at
    BEFORE UPDATE ON public.client_onboarding
    FOR EACH ROW
    EXECUTE FUNCTION public.update_client_onboarding_updated_at();

-- Enable RLS
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own onboarding record
DROP POLICY IF EXISTS "clients_manage_own_onboarding" ON public.client_onboarding;
CREATE POLICY "clients_manage_own_onboarding"
ON public.client_onboarding
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can read all onboarding records
DROP POLICY IF EXISTS "authenticated_read_all_onboarding" ON public.client_onboarding;
CREATE POLICY "authenticated_read_all_onboarding"
ON public.client_onboarding
FOR SELECT
TO authenticated
USING (true);
