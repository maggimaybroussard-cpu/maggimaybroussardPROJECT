-- Enable real-time for portal_messages table (matter message threads)
-- This migration enables Supabase Realtime publication for portal_messages
-- so clients and staff can exchange messages in real-time within the matter view.

-- Add sender_name column to portal_messages for display purposes (if not exists)
ALTER TABLE public.portal_messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT NULL;

-- Add thread_type column to distinguish matter-embedded threads from hub messages
ALTER TABLE public.portal_messages
  ADD COLUMN IF NOT EXISTS thread_type TEXT DEFAULT 'matter' CHECK (thread_type IN ('matter', 'hub'));

-- Index for fast real-time queries per matter
CREATE INDEX IF NOT EXISTS idx_portal_messages_inquiry_created
  ON public.portal_messages (inquiry_id, created_at ASC);

-- Enable RLS (idempotent)
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all portal messages
DROP POLICY IF EXISTS "admin_full_access_portal_messages" ON public.portal_messages;
CREATE POLICY "admin_full_access_portal_messages"
  ON public.portal_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (
          au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (
          au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin'
        )
    )
  );

-- Client: can read and insert messages for cases they have access to
DROP POLICY IF EXISTS "client_access_own_matter_messages" ON public.portal_messages;
CREATE POLICY "client_access_own_matter_messages"
  ON public.portal_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.inquiry_id = portal_messages.inquiry_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.inquiry_id = portal_messages.inquiry_id
    )
  );

-- Enable Supabase Realtime for portal_messages
-- This adds the table to the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'portal_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add portal_messages to supabase_realtime publication: %', SQLERRM;
END $$;
