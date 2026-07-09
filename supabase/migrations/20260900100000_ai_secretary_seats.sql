-- AI Legal Secretary: Seat management, access control, and conversation logs
-- Admin-only: maggimaybroussard@gmail.com and maggimay@broussardlegalservices.com
-- Architecture ready for future employee seat billing via Stripe

-- ── 1. AI Secretary Seats Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_secretary_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  seat_type TEXT NOT NULL DEFAULT 'admin',
  -- Future billing fields
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_plan TEXT DEFAULT 'admin_free',
  monthly_seat_cost NUMERIC(10,2) DEFAULT 0.00,
  seat_activated_at TIMESTAMPTZ DEFAULT now(),
  seat_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_secretary_seats_email ON public.ai_secretary_seats (email);
CREATE INDEX IF NOT EXISTS idx_ai_secretary_seats_active ON public.ai_secretary_seats (is_active);

-- ── 2. AI Secretary Conversations Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_secretary_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_email TEXT NOT NULL,
  session_key TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'general',
  -- context_type: 'billable_hours', 'case_management', 'billing', 'document', 'general'
  case_id TEXT,
  client_name TEXT,
  matter_ref TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  ai_actions_taken JSONB DEFAULT '[]'::jsonb,
  -- Tracks what the AI did: drafted doc, logged hours, flagged deadline, etc.
  total_tokens_used INTEGER DEFAULT 0,
  session_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sec_conv_seat ON public.ai_secretary_conversations (seat_email);
CREATE INDEX IF NOT EXISTS idx_ai_sec_conv_context ON public.ai_secretary_conversations (context_type);
CREATE INDEX IF NOT EXISTS idx_ai_sec_conv_updated ON public.ai_secretary_conversations (updated_at DESC);

-- ── 3. AI Secretary Actions Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_secretary_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_email TEXT NOT NULL,
  conversation_id UUID REFERENCES public.ai_secretary_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  -- action_type: 'hours_logged', 'invoice_drafted', 'deadline_flagged', 'document_drafted',
  --              'case_summarized', 'email_drafted', 'research_completed', 'billing_analyzed'
  action_data JSONB DEFAULT '{}'::jsonb,
  related_case_id TEXT,
  related_client TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sec_actions_seat ON public.ai_secretary_actions (seat_email);
CREATE INDEX IF NOT EXISTS idx_ai_sec_actions_type ON public.ai_secretary_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_ai_sec_actions_created ON public.ai_secretary_actions (created_at DESC);

-- ── 4. AI Secretary Billable Hours Suggestions ───────────────────────────────
-- AI-suggested time entries pending admin approval
CREATE TABLE IF NOT EXISTS public.ai_hours_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by_email TEXT NOT NULL,
  conversation_id UUID REFERENCES public.ai_secretary_conversations(id) ON DELETE SET NULL,
  inquiry_id UUID,
  retainer_subscription_id UUID,
  client_name TEXT,
  task_description TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'other',
  suggested_hours NUMERIC(6,2) NOT NULL,
  hourly_rate NUMERIC(10,2) DEFAULT 150.00,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_confidence TEXT DEFAULT 'medium',
  -- 'high', 'medium', 'low'
  approval_status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected', 'auto_logged'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_hours_sugg_status ON public.ai_hours_suggestions (approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_hours_sugg_email ON public.ai_hours_suggestions (suggested_by_email);

-- ── 5. Auto-update updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_ai_secretary_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_secretary_seats_updated_at ON public.ai_secretary_seats;
CREATE TRIGGER ai_secretary_seats_updated_at
  BEFORE UPDATE ON public.ai_secretary_seats
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_secretary_updated_at();

DROP TRIGGER IF EXISTS ai_secretary_conversations_updated_at ON public.ai_secretary_conversations;
CREATE TRIGGER ai_secretary_conversations_updated_at
  BEFORE UPDATE ON public.ai_secretary_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_secretary_updated_at();

DROP TRIGGER IF EXISTS ai_hours_suggestions_updated_at ON public.ai_hours_suggestions;
CREATE TRIGGER ai_hours_suggestions_updated_at
  BEFORE UPDATE ON public.ai_hours_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_secretary_updated_at();

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_secretary_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_secretary_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_secretary_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hours_suggestions ENABLE ROW LEVEL SECURITY;

-- Admin-only access (protected by Supabase auth + email allowlist in app)
DROP POLICY IF EXISTS "admin_full_access_ai_secretary_seats" ON public.ai_secretary_seats;
CREATE POLICY "admin_full_access_ai_secretary_seats"
  ON public.ai_secretary_seats FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_full_access_ai_secretary_conversations" ON public.ai_secretary_conversations;
CREATE POLICY "admin_full_access_ai_secretary_conversations"
  ON public.ai_secretary_conversations FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_full_access_ai_secretary_actions" ON public.ai_secretary_actions;
CREATE POLICY "admin_full_access_ai_secretary_actions"
  ON public.ai_secretary_actions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_full_access_ai_hours_suggestions" ON public.ai_hours_suggestions;
CREATE POLICY "admin_full_access_ai_hours_suggestions"
  ON public.ai_hours_suggestions FOR ALL TO public USING (true) WITH CHECK (true);

-- ── 7. Seed admin seats ───────────────────────────────────────────────────────
INSERT INTO public.ai_secretary_seats (email, display_name, role, seat_type, billing_plan, monthly_seat_cost)
VALUES
  ('maggimaybroussard@gmail.com', 'Maggi May Broussard', 'admin', 'admin', 'admin_free', 0.00),
  ('maggimay@broussardlegalservices.com', 'Maggi May (BLS)', 'admin', 'admin', 'admin_free', 0.00)
ON CONFLICT (email) DO NOTHING;
