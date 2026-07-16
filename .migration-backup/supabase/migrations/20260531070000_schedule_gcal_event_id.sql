-- Add google_calendar_event_id to case_schedule_events
-- Stores the Google Calendar event ID after syncing, enabling updates and deletions

ALTER TABLE public.case_schedule_events
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_case_schedule_events_gcal_id
  ON public.case_schedule_events(google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;
