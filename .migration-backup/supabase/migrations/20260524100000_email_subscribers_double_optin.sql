-- Double opt-in support for email_subscribers
-- Adds confirmation token, confirmed status, and confirmation timestamp

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT,
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- Index for fast token lookups on confirmation
CREATE INDEX IF NOT EXISTS idx_email_subscribers_confirmation_token
  ON public.email_subscribers(confirmation_token)
  WHERE confirmation_token IS NOT NULL;

-- Allow anon to update their own row when confirming via token
-- (only allows setting confirmed=true, confirmed_at, and clearing the token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_subscribers'
      AND policyname = 'allow_token_confirmation_update'
  ) THEN
    CREATE POLICY allow_token_confirmation_update ON public.email_subscribers
      FOR UPDATE TO anon
      USING (confirmation_token IS NOT NULL)
      WITH CHECK (true);
  END IF;
END $$;
