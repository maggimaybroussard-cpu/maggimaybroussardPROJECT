-- Add Notion page ID tracking to case_notes
ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_case_notes_notion_page_id
  ON public.case_notes(notion_page_id)
  WHERE notion_page_id IS NOT NULL;

-- Add unsubscribe token to email_subscribers (for one-click unsubscribe links)
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

-- Backfill unsubscribe tokens for existing subscribers
UPDATE public.email_subscribers
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE unsubscribe_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_unsubscribe_token
  ON public.email_subscribers(unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;

-- RLS: allow anon to read case_notes for portal (via inquiry access)
-- case_notes already has RLS enabled; add policy for clients to read their own case notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'case_notes' AND policyname = 'clients_read_own_case_notes'
  ) THEN
    CREATE POLICY clients_read_own_case_notes ON public.case_notes
      FOR SELECT TO authenticated
      USING (
        inquiry_id IN (
          SELECT inquiry_id FROM public.client_portal_access
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow anon to update unsubscribe status via token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_subscribers' AND policyname = 'allow_token_unsubscribe_update'
  ) THEN
    CREATE POLICY allow_token_unsubscribe_update ON public.email_subscribers
      FOR UPDATE TO anon
      USING (unsubscribe_token IS NOT NULL)
      WITH CHECK (true);
  END IF;
END $$;
