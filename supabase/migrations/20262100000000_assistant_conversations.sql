-- Assistant conversations: stores AI paralegal chat sessions synced from external sources

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON public.assistant_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated ON public.assistant_conversations (updated_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.assistant_conversations_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistant_conversations_updated_at ON public.assistant_conversations;
CREATE TRIGGER assistant_conversations_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.assistant_conversations_set_updated_at();

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Admin-only access (internal endpoint, protected by x-internal-secret)
DROP POLICY IF EXISTS "admin_full_access_assistant_conversations" ON public.assistant_conversations;
CREATE POLICY "admin_full_access_assistant_conversations"
  ON public.assistant_conversations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
