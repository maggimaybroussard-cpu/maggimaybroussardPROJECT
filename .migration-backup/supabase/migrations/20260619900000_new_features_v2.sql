-- Migration: New features tables
-- court_deadlines, shared_document_links, nps_responses, nps_survey_requests,
-- webhook_endpoints, webhook_logs, lexi_research_history

-- ── Court Deadlines ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.court_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  deadline_type TEXT NOT NULL DEFAULT 'deadline' CHECK (deadline_type IN ('deadline', 'sol', 'hearing', 'filing', 'other')),
  matter_name TEXT NOT NULL,
  client_email TEXT,
  notes TEXT,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.court_deadlines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'court_deadlines' AND policyname = 'admin_all_court_deadlines') THEN
    CREATE POLICY admin_all_court_deadlines ON public.court_deadlines
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- ── Shared Document Links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT DEFAULT 'admin',
  access_count INTEGER DEFAULT 0,
  max_access INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  recipient_email TEXT,
  recipient_name TEXT,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shared_document_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_document_links' AND policyname = 'admin_all_shared_links') THEN
    CREATE POLICY admin_all_shared_links ON public.shared_document_links
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_document_links' AND policyname = 'public_read_shared_links') THEN
    CREATE POLICY public_read_shared_links ON public.shared_document_links
      FOR SELECT USING (is_active = TRUE AND expires_at > NOW());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_document_links' AND policyname = 'public_update_access_count') THEN
    CREATE POLICY public_update_access_count ON public.shared_document_links
      FOR UPDATE USING (is_active = TRUE AND expires_at > NOW())
      WITH CHECK (is_active = TRUE);
  END IF;
END $$;

-- ── NPS Survey Requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nps_survey_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nps_survey_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_survey_requests' AND policyname = 'admin_all_nps_requests') THEN
    CREATE POLICY admin_all_nps_requests ON public.nps_survey_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_survey_requests' AND policyname = 'public_read_nps_requests') THEN
    CREATE POLICY public_read_nps_requests ON public.nps_survey_requests
      FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_survey_requests' AND policyname = 'public_update_nps_requests') THEN
    CREATE POLICY public_update_nps_requests ON public.nps_survey_requests
      FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- ── NPS Responses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  nps_score INTEGER NOT NULL CHECK (nps_score BETWEEN 1 AND 10),
  feedback TEXT,
  service TEXT,
  attorney_rating INTEGER CHECK (attorney_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  outcome_rating INTEGER CHECK (outcome_rating BETWEEN 1 AND 5),
  would_refer BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_responses' AND policyname = 'admin_all_nps_responses') THEN
    CREATE POLICY admin_all_nps_responses ON public.nps_responses
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_responses' AND policyname = 'public_insert_nps_responses') THEN
    CREATE POLICY public_insert_nps_responses ON public.nps_responses
      FOR INSERT WITH CHECK (TRUE);
  END IF;
END $$;

-- ── Webhook Endpoints ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  secret TEXT,
  last_triggered_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_endpoints' AND policyname = 'admin_all_webhook_endpoints') THEN
    CREATE POLICY admin_all_webhook_endpoints ON public.webhook_endpoints
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney')
        )
      );
  END IF;
END $$;

-- ── Webhook Logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  response_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_logs' AND policyname = 'admin_all_webhook_logs') THEN
    CREATE POLICY admin_all_webhook_logs ON public.webhook_logs
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney')
        )
      );
  END IF;
END $$;

-- ── Lexi Research History ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lexi_research_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all',
  summary TEXT NOT NULL,
  matter_ref TEXT,
  matter_name TEXT,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lexi_research_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lexi_research_history' AND policyname = 'admin_all_research_history') THEN
    CREATE POLICY admin_all_research_history ON public.lexi_research_history
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- ── Add is_billable to retainer_time_logs if missing ────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retainer_time_logs' AND column_name = 'is_billable'
  ) THEN
    ALTER TABLE public.retainer_time_logs ADD COLUMN is_billable BOOLEAN DEFAULT TRUE;
  END IF;
END $$;
