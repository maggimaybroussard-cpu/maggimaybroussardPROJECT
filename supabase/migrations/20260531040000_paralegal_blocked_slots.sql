-- Migration: paralegal_blocked_slots
-- Allows paralegals to block time slots on their availability calendar
-- so the auto-routing engine skips them during those periods.

-- ─── Types ────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.blocked_slot_reason CASCADE;
CREATE TYPE public.blocked_slot_reason AS ENUM (
  'court_date',
  'meeting',
  'vacation',
  'personal',
  'training',
  'other'
);

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paralegal_blocked_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paralegal_id    TEXT NOT NULL,
  paralegal_name  TEXT NOT NULL,
  title           TEXT NOT NULL,
  reason          public.blocked_slot_reason NOT NULL DEFAULT 'other',
  start_datetime  TIMESTAMPTZ NOT NULL,
  end_datetime    TIMESTAMPTZ NOT NULL,
  all_day         BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_end_after_start CHECK (end_datetime > start_datetime)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_paralegal_blocked_slots_paralegal_id
  ON public.paralegal_blocked_slots (paralegal_id);

CREATE INDEX IF NOT EXISTS idx_paralegal_blocked_slots_start_datetime
  ON public.paralegal_blocked_slots (start_datetime);

CREATE INDEX IF NOT EXISTS idx_paralegal_blocked_slots_end_datetime
  ON public.paralegal_blocked_slots (end_datetime);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_paralegal_blocked_slots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paralegal_blocked_slots_updated_at ON public.paralegal_blocked_slots;
CREATE TRIGGER trg_paralegal_blocked_slots_updated_at
  BEFORE UPDATE ON public.paralegal_blocked_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_paralegal_blocked_slots_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.paralegal_blocked_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_paralegal_blocked_slots" ON public.paralegal_blocked_slots;
CREATE POLICY "admin_full_access_paralegal_blocked_slots"
  ON public.paralegal_blocked_slots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
