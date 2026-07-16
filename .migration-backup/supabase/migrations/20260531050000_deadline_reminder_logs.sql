-- ─── Deadline Reminder Logs ──────────────────────────────────────────────────
-- Tracks sent paralegal email reminders for court dates, deadlines, milestones

-- 1. Reminder config table (global settings)
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL UNIQUE, -- 'deadline' | 'court_date' | 'meeting' | 'milestone'
  days_before  INT NOT NULL DEFAULT 3,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed default settings
INSERT INTO public.reminder_settings (event_type, days_before, enabled)
VALUES
  ('deadline',   3,  true),
  ('court_date', 7,  true),
  ('meeting',    1,  true),
  ('milestone',  3,  true)
ON CONFLICT (event_type) DO NOTHING;

-- 2. Reminder logs table
CREATE TABLE IF NOT EXISTS public.schedule_reminder_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.case_schedule_events(id) ON DELETE CASCADE,
  paralegal_email TEXT NOT NULL,
  paralegal_name  TEXT,
  event_type      TEXT NOT NULL,
  event_title     TEXT NOT NULL,
  event_date      TIMESTAMPTZ NOT NULL,
  days_before     INT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resend_email_id TEXT,
  status          TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_reminder_logs_event_id ON public.schedule_reminder_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_reminder_logs_sent_at  ON public.schedule_reminder_logs(sent_at);

-- 3. RLS
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_reminder_settings" ON public.reminder_settings;
CREATE POLICY "admin_full_access_reminder_settings"
ON public.reminder_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_full_access_schedule_reminder_logs" ON public.schedule_reminder_logs;
CREATE POLICY "admin_full_access_schedule_reminder_logs"
ON public.schedule_reminder_logs FOR ALL TO authenticated
USING (true) WITH CHECK (true);
