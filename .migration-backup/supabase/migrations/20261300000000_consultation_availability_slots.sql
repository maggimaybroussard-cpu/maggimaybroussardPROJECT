-- ─── Consultation Availability Slots ─────────────────────────────────────────
-- Stores booked time slots so the scheduler can show real availability

CREATE TABLE IF NOT EXISTS public.consultation_availability_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date  DATE NOT NULL,
  booking_time  TIME NOT NULL,
  duration_mins INTEGER NOT NULL DEFAULT 30,
  is_blocked    BOOLEAN NOT NULL DEFAULT false,
  booking_id    UUID REFERENCES public.consultation_bookings(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_avail_slots_date_time_dur
  ON public.consultation_availability_slots (booking_date, booking_time, duration_mins);

CREATE INDEX IF NOT EXISTS idx_avail_slots_booking_date
  ON public.consultation_availability_slots (booking_date);

ALTER TABLE public.consultation_availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_slots" ON public.consultation_availability_slots;
CREATE POLICY "public_read_slots"
  ON public.consultation_availability_slots
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "service_role_manage_slots" ON public.consultation_availability_slots;
CREATE POLICY "service_role_manage_slots"
  ON public.consultation_availability_slots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also add duration_minutes column to consultation_bookings if not already there
-- (it already exists per migration 20260615220000, so this is a no-op guard)
ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS gcal_event_id TEXT,
  ADD COLUMN IF NOT EXISTS gcal_html_link TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to TEXT;
