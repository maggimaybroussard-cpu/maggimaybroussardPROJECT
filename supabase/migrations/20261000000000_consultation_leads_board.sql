-- ─── Consultation Leads Board ────────────────────────────────────────────────
-- Adds intake status, conversion tracking, and follow-up reminder fields
-- to consultation_bookings so Calendly + Google Calendar bookings can be
-- surfaced in a centralized leads table.

-- 1. Add leads-tracking columns to consultation_bookings
ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS source             TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS intake_form_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS intake_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversion_status  TEXT DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS converted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_due_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_notes    TEXT,
  ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
  ADD COLUMN IF NOT EXISTS calendly_invitee_uuid TEXT,
  ADD COLUMN IF NOT EXISTS calendly_event_name TEXT,
  ADD COLUMN IF NOT EXISTS calendly_meeting_location TEXT,
  ADD COLUMN IF NOT EXISTS gcal_event_id      TEXT,
  ADD COLUMN IF NOT EXISTS gcal_event_title   TEXT,
  ADD COLUMN IF NOT EXISTS gcal_html_link     TEXT,
  ADD COLUMN IF NOT EXISTS lead_score         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to        TEXT;

-- 2. Unique partial indexes for upsert conflict targets
CREATE UNIQUE INDEX IF NOT EXISTS idx_cb_gcal_event_id_unique
  ON public.consultation_bookings(gcal_event_id)
  WHERE gcal_event_id IS NOT NULL;

-- 3. Regular indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cb_source
  ON public.consultation_bookings(source);

CREATE INDEX IF NOT EXISTS idx_cb_intake_form_status
  ON public.consultation_bookings(intake_form_status);

CREATE INDEX IF NOT EXISTS idx_cb_conversion_status
  ON public.consultation_bookings(conversion_status);

CREATE INDEX IF NOT EXISTS idx_cb_follow_up_due_at
  ON public.consultation_bookings(follow_up_due_at)
  WHERE follow_up_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cb_calendly_event_uuid
  ON public.consultation_bookings(calendly_event_uuid)
  WHERE calendly_event_uuid IS NOT NULL;
