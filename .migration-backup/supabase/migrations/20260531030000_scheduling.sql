-- ─── Scheduling Module ───────────────────────────────────────────────────────
-- Paralegal scheduling: deadlines, court dates, meetings, case milestones

-- 1. Types
DROP TYPE IF EXISTS public.schedule_event_type CASCADE;
CREATE TYPE public.schedule_event_type AS ENUM (
  'deadline',
  'court_date',
  'meeting',
  'milestone'
);

DROP TYPE IF EXISTS public.schedule_event_status CASCADE;
CREATE TYPE public.schedule_event_status AS ENUM (
  'upcoming',
  'completed',
  'cancelled',
  'overdue'
);

DROP TYPE IF EXISTS public.schedule_reminder_interval CASCADE;
CREATE TYPE public.schedule_reminder_interval AS ENUM (
  'none',
  '1_hour',
  '24_hours',
  '48_hours',
  '72_hours',
  '1_week'
);

-- 2. Core table
CREATE TABLE IF NOT EXISTS public.case_schedule_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  case_name         TEXT,
  event_type        public.schedule_event_type NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  event_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ,
  location          TEXT,
  assigned_to       TEXT,
  status            public.schedule_event_status DEFAULT 'upcoming'::public.schedule_event_status,
  reminder_interval public.schedule_reminder_interval DEFAULT 'none'::public.schedule_reminder_interval,
  reminder_sent_at  TIMESTAMPTZ,
  synced_to_portal  BOOLEAN DEFAULT false,
  portal_notified   BOOLEAN DEFAULT false,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_case_schedule_events_case_id ON public.case_schedule_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_schedule_events_event_date ON public.case_schedule_events(event_date);
CREATE INDEX IF NOT EXISTS idx_case_schedule_events_event_type ON public.case_schedule_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_schedule_events_status ON public.case_schedule_events(status);

-- 4. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_case_schedule_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.case_schedule_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — admin full access
DROP POLICY IF EXISTS "admin_full_access_case_schedule_events" ON public.case_schedule_events;
CREATE POLICY "admin_full_access_case_schedule_events"
ON public.case_schedule_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Trigger
DROP TRIGGER IF EXISTS trg_case_schedule_events_updated_at ON public.case_schedule_events;
CREATE TRIGGER trg_case_schedule_events_updated_at
  BEFORE UPDATE ON public.case_schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_case_schedule_events_updated_at();
