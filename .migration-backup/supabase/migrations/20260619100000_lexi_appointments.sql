-- Migration: lexi_appointments table for Lexi appointment management
-- Timestamp: 20260619100000

CREATE TABLE IF NOT EXISTS public.lexi_appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name     text NOT NULL,
  client_email    text NOT NULL,
  appointment_type text NOT NULL DEFAULT 'initial_consultation',
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  timezone        text NOT NULL DEFAULT 'America/Chicago',
  status          text NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('pending','confirmed','rescheduled','cancelled','completed')),
  notes           text,
  case_ref        text,
  reminder_sent   boolean NOT NULL DEFAULT false,
  google_event_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for client name lookups
CREATE INDEX IF NOT EXISTS lexi_appointments_client_name_idx
  ON public.lexi_appointments (client_name);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS lexi_appointments_date_idx
  ON public.lexi_appointments (appointment_date, appointment_time);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS lexi_appointments_status_idx
  ON public.lexi_appointments (status);

-- RLS: admin-only access (service role bypasses RLS)
ALTER TABLE public.lexi_appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lexi_appointments' AND policyname = 'admin_all_lexi_appointments'
  ) THEN
    CREATE POLICY admin_all_lexi_appointments
      ON public.lexi_appointments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
