-- Add google_event_id to consultation_bookings
-- Stores the Google Calendar event ID so bookings can be updated/deleted on reschedule/cancel

ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_consultation_bookings_gcal_id
  ON public.consultation_bookings(google_event_id)
  WHERE google_event_id IS NOT NULL;
