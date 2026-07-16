-- Lexi persistent case sessions: stores conversation history, case summaries, hours context, and draft state per client/case

CREATE TABLE IF NOT EXISTS public.lexi_case_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL,           -- unique key: client_name + case_ref (slugified)
  client_name TEXT NOT NULL,
  case_ref TEXT,                        -- optional case/matter reference
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {role, content} messages
  case_summary TEXT,                    -- AI-generated running summary of the matter
  total_hours_logged NUMERIC(8,2) DEFAULT 0,  -- cumulative hours Lexi has logged for this case
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  draft_email_context JSONB,            -- last email draft context for this client
  alert_history JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of triggered alerts
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lexi_case_sessions_key ON public.lexi_case_sessions (session_key);
CREATE INDEX IF NOT EXISTS idx_lexi_case_sessions_client ON public.lexi_case_sessions (client_name);
CREATE INDEX IF NOT EXISTS idx_lexi_case_sessions_activity ON public.lexi_case_sessions (last_activity_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.lexi_session_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lexi_session_updated_at ON public.lexi_case_sessions;
CREATE TRIGGER lexi_session_updated_at
  BEFORE UPDATE ON public.lexi_case_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.lexi_session_set_updated_at();

ALTER TABLE public.lexi_case_sessions ENABLE ROW LEVEL SECURITY;

-- Admin-only access (this is an internal tool, no client-facing RLS needed)
DROP POLICY IF EXISTS "admin_full_access_lexi_case_sessions" ON public.lexi_case_sessions;
CREATE POLICY "admin_full_access_lexi_case_sessions"
  ON public.lexi_case_sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
