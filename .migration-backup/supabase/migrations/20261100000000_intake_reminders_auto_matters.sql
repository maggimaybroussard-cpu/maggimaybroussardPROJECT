-- ─── Intake Reminder Schedules + Auto-Generated Matters ──────────────────────
-- Supports:
--   1. Scheduled intake reminder emails (configurable intervals)
--   2. Auto-generation of matters when intake is marked complete

-- ─── 1. Intake Reminder Schedules ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intake_reminder_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID REFERENCES public.consultation_bookings(id) ON DELETE CASCADE,
  client_name           TEXT NOT NULL,
  client_email          TEXT NOT NULL,
  case_type             TEXT,
  reminder_type         TEXT NOT NULL DEFAULT 'intake_reminder',
  -- Scheduling
  scheduled_at          TIMESTAMPTZ NOT NULL,
  sent_at               TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | cancelled | failed
  -- Recurrence
  interval_hours        INTEGER DEFAULT 24,
  max_reminders         INTEGER DEFAULT 3,
  reminder_count        INTEGER DEFAULT 0,
  -- Metadata
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_irs_booking_id
  ON public.intake_reminder_schedules(booking_id);

CREATE INDEX IF NOT EXISTS idx_irs_status
  ON public.intake_reminder_schedules(status);

CREATE INDEX IF NOT EXISTS idx_irs_scheduled_at
  ON public.intake_reminder_schedules(scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.intake_reminder_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_intake_reminder_schedules" ON public.intake_reminder_schedules;
CREATE POLICY "admin_manage_intake_reminder_schedules"
ON public.intake_reminder_schedules
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ─── 2. Auto-Generated Matters ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auto_generated_matters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID REFERENCES public.consultation_bookings(id) ON DELETE SET NULL,
  -- Matter details (pre-filled from intake)
  matter_name           TEXT NOT NULL,
  client_name           TEXT NOT NULL,
  client_email          TEXT NOT NULL,
  client_phone          TEXT,
  case_type             TEXT NOT NULL,
  practice_area         TEXT,
  -- Financial
  retainer_amount       NUMERIC(10,2),
  retainer_paid         BOOLEAN DEFAULT FALSE,
  retainer_paid_at      TIMESTAMPTZ,
  -- Status
  matter_status         TEXT NOT NULL DEFAULT 'open',  -- open | active | closed | on_hold
  -- First time log entry (auto-created)
  first_time_log_date   DATE DEFAULT CURRENT_DATE,
  first_time_log_hours  NUMERIC(5,2) DEFAULT 0.5,
  first_time_log_desc   TEXT DEFAULT 'Initial intake review and matter setup',
  first_time_log_rate   NUMERIC(10,2),
  -- Linked engagement
  engagement_id         UUID REFERENCES public.engagements(id) ON DELETE SET NULL,
  -- Metadata
  auto_generated        BOOLEAN DEFAULT TRUE,
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  generated_from        TEXT DEFAULT 'intake_complete',
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agm_booking_id
  ON public.auto_generated_matters(booking_id);

CREATE INDEX IF NOT EXISTS idx_agm_client_email
  ON public.auto_generated_matters(client_email);

CREATE INDEX IF NOT EXISTS idx_agm_matter_status
  ON public.auto_generated_matters(matter_status);

CREATE INDEX IF NOT EXISTS idx_agm_case_type
  ON public.auto_generated_matters(case_type);

ALTER TABLE public.auto_generated_matters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_auto_generated_matters" ON public.auto_generated_matters;
CREATE POLICY "admin_manage_auto_generated_matters"
ON public.auto_generated_matters
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ─── 3. Matter Time Log Entries ───────────────────────────────────────────────
-- Stores the first (and subsequent) time log entries linked to auto-generated matters
CREATE TABLE IF NOT EXISTS public.matter_time_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id             UUID REFERENCES public.auto_generated_matters(id) ON DELETE CASCADE,
  log_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  hours                 NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  description           TEXT NOT NULL,
  hourly_rate           NUMERIC(10,2),
  billable              BOOLEAN DEFAULT TRUE,
  billed                BOOLEAN DEFAULT FALSE,
  staff_name            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mte_matter_id
  ON public.matter_time_entries(matter_id);

ALTER TABLE public.matter_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_matter_time_entries" ON public.matter_time_entries;
CREATE POLICY "admin_manage_matter_time_entries"
ON public.matter_time_entries
FOR ALL
TO public
USING (true)
WITH CHECK (true);
