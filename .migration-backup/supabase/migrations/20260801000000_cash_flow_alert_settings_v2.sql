-- Cash flow alert settings table (idempotent)
CREATE TABLE IF NOT EXISTS public.cash_flow_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_amount numeric(12,2) NOT NULL DEFAULT 5000,
  alert_enabled boolean NOT NULL DEFAULT true,
  look_ahead_months integer NOT NULL DEFAULT 3,
  notify_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed a default row if none exists
INSERT INTO public.cash_flow_alert_settings (threshold_amount, alert_enabled, look_ahead_months)
SELECT 5000, true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.cash_flow_alert_settings);

-- RLS
ALTER TABLE public.cash_flow_alert_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access cash_flow_alert_settings" ON public.cash_flow_alert_settings;
CREATE POLICY "Admin full access cash_flow_alert_settings"
  ON public.cash_flow_alert_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
