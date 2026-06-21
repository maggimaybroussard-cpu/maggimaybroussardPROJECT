-- ─── Email Template Auto-Send Settings ───────────────────────────────────────
-- Stores global auto-send configuration: internal CC email, per-category toggles

CREATE TABLE IF NOT EXISTS public.email_template_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  internal_cc_email    TEXT NOT NULL DEFAULT '',
  auto_send_enabled    BOOLEAN NOT NULL DEFAULT true,
  cc_on_case_updates   BOOLEAN NOT NULL DEFAULT true,
  cc_on_appointments   BOOLEAN NOT NULL DEFAULT true,
  cc_on_invoices       BOOLEAN NOT NULL DEFAULT true,
  updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default row if not exists
INSERT INTO public.email_template_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_email_template_settings" ON public.email_template_settings;
CREATE POLICY "admin_full_access_email_template_settings"
  ON public.email_template_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_email_template_settings" ON public.email_template_settings;
CREATE POLICY "service_role_full_access_email_template_settings"
  ON public.email_template_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Email Send Log ───────────────────────────────────────────────────────────
-- Tracks every auto-sent email for audit and debugging

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      TEXT NOT NULL,
  to_email         TEXT NOT NULL,
  to_name          TEXT,
  subject          TEXT NOT NULL,
  resend_email_id  TEXT,
  cc_internal      BOOLEAN NOT NULL DEFAULT false,
  vars_used        JSONB,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_template_id ON public.email_send_log(template_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_to_email    ON public.email_send_log(to_email);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at     ON public.email_send_log(sent_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_email_send_log" ON public.email_send_log;
CREATE POLICY "admin_full_access_email_send_log"
  ON public.email_send_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_email_send_log" ON public.email_send_log;
CREATE POLICY "service_role_full_access_email_send_log"
  ON public.email_send_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
