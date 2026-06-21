-- Google Calendar OAuth token storage
-- Stores the admin's Google OAuth refresh token so the edge function
-- can create/delete calendar events server-side without user interaction.

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_email text NOT NULL,
  access_token  text,
  refresh_token text NOT NULL,
  token_expiry  timestamptz,
  calendar_id   text NOT NULL DEFAULT 'primary',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one row ever needed (the admin's token)
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_tokens_singleton
  ON public.google_calendar_tokens (account_email);

-- RLS: only service-role can read/write
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'google_calendar_tokens'
      AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY service_role_only ON public.google_calendar_tokens
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- Track which Calendly events have been synced to Google Calendar
ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
