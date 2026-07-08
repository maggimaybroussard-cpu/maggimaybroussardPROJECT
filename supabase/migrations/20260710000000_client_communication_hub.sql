-- Client Communication Hub tables
-- Adds message_type column to portal_messages if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_messages'
      AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.portal_messages ADD COLUMN message_type TEXT DEFAULT 'text';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_messages'
      AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE public.portal_messages ADD COLUMN sender_name TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'portal_messages'
      AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.portal_messages ADD COLUMN read_at TIMESTAMPTZ;
  END IF;
END $$;

-- Communication broadcast logs table
CREATE TABLE IF NOT EXISTS public.communication_broadcast_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  audience TEXT NOT NULL DEFAULT 'all',
  sent_by TEXT,
  recipient_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for broadcast logs
ALTER TABLE public.communication_broadcast_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'communication_broadcast_logs'
      AND policyname = 'Admin full access to broadcast logs'
  ) THEN
    CREATE POLICY "Admin full access to broadcast logs"
      ON public.communication_broadcast_logs
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- Index for portal_messages by inquiry_id
CREATE INDEX IF NOT EXISTS idx_portal_messages_inquiry_id
  ON public.portal_messages(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at
  ON public.portal_messages(created_at DESC);
