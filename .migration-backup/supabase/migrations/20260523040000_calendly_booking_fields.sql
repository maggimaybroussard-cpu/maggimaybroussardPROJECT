-- Add Calendly booking fields to contact_inquiries
-- These are populated automatically when a Calendly webhook fires (invitee.created / invitee.canceled)

ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
  ADD COLUMN IF NOT EXISTS calendly_invitee_uuid TEXT,
  ADD COLUMN IF NOT EXISTS calendly_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendly_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendly_event_name TEXT,
  ADD COLUMN IF NOT EXISTS calendly_meeting_location TEXT;

-- Index for fast lookup by Calendly event UUID (e.g. for cancellation handling)
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_calendly_event_uuid
  ON public.contact_inquiries(calendly_event_uuid)
  WHERE calendly_event_uuid IS NOT NULL;
