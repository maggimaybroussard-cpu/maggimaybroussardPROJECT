-- Migration: billing_hourly_rates
-- Adds a table for admin-managed hourly billing rates per service type

CREATE TABLE IF NOT EXISTS public.billing_hourly_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type  TEXT NOT NULL,
  rate_per_hour NUMERIC NOT NULL CHECK (rate_per_hour > 0),
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_hourly_rates_service_type ON public.billing_hourly_rates (service_type);
CREATE INDEX IF NOT EXISTS idx_billing_hourly_rates_is_active ON public.billing_hourly_rates (is_active);

ALTER TABLE public.billing_hourly_rates ENABLE ROW LEVEL SECURITY;

-- Admin full access (uses auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin_for_billing()
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
      )
  )
$$;

DROP POLICY IF EXISTS "admin_manage_billing_hourly_rates" ON public.billing_hourly_rates;
CREATE POLICY "admin_manage_billing_hourly_rates"
  ON public.billing_hourly_rates
  FOR ALL
  TO authenticated
  USING (public.is_admin_for_billing())
  WITH CHECK (public.is_admin_for_billing());

-- Seed default rates
DO $$
BEGIN
  INSERT INTO public.billing_hourly_rates (service_type, rate_per_hour, description, is_active)
  VALUES
    ('Family Law',        350.00, 'Divorce, custody, and family matters',        true),
    ('Immigration',       300.00, 'Visa, green card, and citizenship matters',   true),
    ('Business Law',      400.00, 'Contracts, formations, and compliance',        true),
    ('Criminal Defense',  375.00, 'Misdemeanor and felony defense',              true),
    ('Estate Planning',   325.00, 'Wills, trusts, and probate',                  true),
    ('General Counsel',   275.00, 'General legal advice and document review',    true)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion skipped: %', SQLERRM;
END $$;
