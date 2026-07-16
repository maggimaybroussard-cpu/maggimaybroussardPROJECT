-- Migration: Add prep_access_token to consultation_bookings
-- Allows clients to access their consultation prep page via a secure token

ALTER TABLE public.consultation_bookings
ADD COLUMN IF NOT EXISTS prep_access_token TEXT;

-- Unique index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_bookings_prep_token
  ON public.consultation_bookings(prep_access_token)
  WHERE prep_access_token IS NOT NULL;

-- Function to generate a secure token for a booking
CREATE OR REPLACE FUNCTION public.generate_prep_access_token(booking_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
BEGIN
  new_token := encode(gen_random_bytes(24), 'hex');
  UPDATE public.consultation_bookings
  SET prep_access_token = new_token
  WHERE id = booking_uuid;
  RETURN new_token;
END;
$$;

-- RLS: allow anon to read by token (for the prep page)
DROP POLICY IF EXISTS "public_read_booking_by_token" ON public.consultation_bookings;
CREATE POLICY "public_read_booking_by_token"
  ON public.consultation_bookings
  FOR SELECT
  TO anon
  USING (prep_access_token IS NOT NULL);
