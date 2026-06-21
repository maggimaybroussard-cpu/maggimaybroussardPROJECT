-- ─── Consultation Bookings Table ─────────────────────────────────────────────
-- Stores direct portal bookings (native calendar, not Calendly)

DROP TYPE IF EXISTS public.booking_status CASCADE;
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

DROP TYPE IF EXISTS public.booking_type CASCADE;
CREATE TYPE public.booking_type AS ENUM ('initial_consultation', 'case_checkin', 'follow_up', 'document_review');

CREATE TABLE IF NOT EXISTS public.consultation_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inquiry_id        UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  booking_type      public.booking_type NOT NULL DEFAULT 'initial_consultation',
  booking_date      DATE NOT NULL,
  booking_time      TIME NOT NULL,
  timezone          TEXT NOT NULL DEFAULT 'America/Chicago',
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  status            public.booking_status NOT NULL DEFAULT 'confirmed',
  notes             TEXT,
  meeting_location  TEXT DEFAULT 'Google Meet',
  confirmation_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_sent     BOOLEAN NOT NULL DEFAULT false,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_user_id ON public.consultation_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_booking_date ON public.consultation_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status ON public.consultation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_client_email ON public.consultation_bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_created_at ON public.consultation_bookings(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_consultation_bookings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_bookings_updated_at ON public.consultation_bookings;
CREATE TRIGGER trg_consultation_bookings_updated_at
  BEFORE UPDATE ON public.consultation_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_consultation_bookings_updated_at();

-- RLS
ALTER TABLE public.consultation_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_bookings" ON public.consultation_bookings;
CREATE POLICY "clients_manage_own_bookings"
  ON public.consultation_bookings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_full_access_bookings" ON public.consultation_bookings;
CREATE POLICY "service_role_full_access_bookings"
  ON public.consultation_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon inserts for prospects (not yet logged in)
DROP POLICY IF EXISTS "anon_insert_bookings" ON public.consultation_bookings;
CREATE POLICY "anon_insert_bookings"
  ON public.consultation_bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);
