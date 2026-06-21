-- Migration: Lexi Practice Suite enhancements
-- Adds tables for deadline tracking, intake leads, and communication logs

-- ── Lexi Deadline Tracker ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lexi_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_type text NOT NULL,
  label text NOT NULL,
  trigger_date date NOT NULL,
  deadline_date date NOT NULL,
  days_remaining integer,
  statute text,
  case_ref text,
  client_name text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lexi_deadlines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lexi_deadlines' AND policyname = 'Admin full access lexi_deadlines'
  ) THEN
    CREATE POLICY "Admin full access lexi_deadlines"
      ON public.lexi_deadlines
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Lexi Intake Leads ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lexi_intake_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  matter_type text,
  date_of_incident date,
  description text,
  sol_deadline date,
  sol_days_remaining integer,
  conflict_check_status text DEFAULT 'pending' CHECK (conflict_check_status IN ('pending', 'clear', 'conflict')),
  conflict_notes text,
  follow_up_email_drafted text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'engaged', 'disqualified')),
  disqualification_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lexi_intake_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lexi_intake_leads' AND policyname = 'Admin full access lexi_intake_leads'
  ) THEN
    CREATE POLICY "Admin full access lexi_intake_leads"
      ON public.lexi_intake_leads
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Lexi Communication Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lexi_comm_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comm_type text NOT NULL,
  client_name text,
  client_email text,
  subject text,
  body text,
  case_ref text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lexi_comm_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lexi_comm_logs' AND policyname = 'Admin full access lexi_comm_logs'
  ) THEN
    CREATE POLICY "Admin full access lexi_comm_logs"
      ON public.lexi_comm_logs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Lexi Brief Drafts (extend lexi_document_drafts) ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lexi_document_drafts' AND column_name = 'brief_type'
  ) THEN
    ALTER TABLE public.lexi_document_drafts ADD COLUMN brief_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lexi_document_drafts' AND column_name = 'court_type'
  ) THEN
    ALTER TABLE public.lexi_document_drafts ADD COLUMN court_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lexi_document_drafts' AND column_name = 'citations'
  ) THEN
    ALTER TABLE public.lexi_document_drafts ADD COLUMN citations jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
