-- ─── Branded Email Templates ─────────────────────────────────────────────────
-- Stores admin-edited template overrides for invoices, reminders, case updates,
-- and notifications. Falls back to code defaults when no override exists.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  preheader     TEXT NOT NULL DEFAULT '',
  badge         TEXT NOT NULL DEFAULT '',
  heading       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  cta_label     TEXT NOT NULL DEFAULT '',
  cta_url       TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_template_id ON public.email_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category    ON public.email_templates(category);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_email_templates" ON public.email_templates;
CREATE POLICY "admin_full_access_email_templates"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_email_templates" ON public.email_templates;
CREATE POLICY "service_role_full_access_email_templates"
  ON public.email_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
