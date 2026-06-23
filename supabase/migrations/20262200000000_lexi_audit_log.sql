-- ============================================================
-- Lexi AI Assistant: Audit Log + Visitor Session Memory
-- ============================================================

-- Visitor session memory for returning users
CREATE TABLE IF NOT EXISTS public.lexi_visitor_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text NOT NULL UNIQUE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexi_visitor_sessions_visitor_id
  ON public.lexi_visitor_sessions (visitor_id);

CREATE INDEX IF NOT EXISTS idx_lexi_visitor_sessions_updated_at
  ON public.lexi_visitor_sessions (updated_at DESC);

-- Audit log: every Lexi response, flagged if disclaimer triggered
CREATE TABLE IF NOT EXISTS public.lexi_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id text,
  ip_address text,
  user_message text NOT NULL DEFAULT '',
  assistant_response text NOT NULL DEFAULT '',
  disclaimer_triggered boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexi_audit_log_disclaimer
  ON public.lexi_audit_log (disclaimer_triggered, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lexi_audit_log_created_at
  ON public.lexi_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lexi_audit_log_visitor_id
  ON public.lexi_audit_log (visitor_id);

-- RLS: admin-only read access
ALTER TABLE public.lexi_visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexi_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lexi_visitor_sessions' AND policyname = 'admin_read_lexi_sessions'
  ) THEN
    CREATE POLICY admin_read_lexi_sessions ON public.lexi_visitor_sessions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'paralegal')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lexi_audit_log' AND policyname = 'admin_read_lexi_audit'
  ) THEN
    CREATE POLICY admin_read_lexi_audit ON public.lexi_audit_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'paralegal')
        )
      );
  END IF;
END $$;

-- Allow anon inserts (the API route uses anon key for writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lexi_visitor_sessions' AND policyname = 'anon_upsert_lexi_sessions'
  ) THEN
    CREATE POLICY anon_upsert_lexi_sessions ON public.lexi_visitor_sessions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lexi_audit_log' AND policyname = 'anon_insert_lexi_audit'
  ) THEN
    CREATE POLICY anon_insert_lexi_audit ON public.lexi_audit_log
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
