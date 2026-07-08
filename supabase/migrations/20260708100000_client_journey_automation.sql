-- Migration: Client Journey Automation Tables
-- Adds tables for conditional triggers and multi-step journey sequences

CREATE TABLE IF NOT EXISTS public.client_journey_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'cancelled', 'failed')),
  current_step INTEGER NOT NULL DEFAULT 1,
  enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.journey_trigger_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  condition_field TEXT NOT NULL CHECK (condition_field IN ('service_type', 'intake_source', 'urgency_flag', 'stage_change', 'time_elapsed')),
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('equals', 'not_equals', 'contains', 'is_set')),
  condition_value TEXT NOT NULL DEFAULT '',
  condition_logic TEXT NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.journey_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('consultation_reminder', 'retainer_reminder', 'follow_up_survey', 'nurture_email', 'sms_alert')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  delay_hours NUMERIC NOT NULL DEFAULT 0,
  subject TEXT NOT NULL DEFAULT '',
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.journey_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.client_journey_automations(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_journey_automations_inquiry_id ON public.client_journey_automations(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_client_journey_automations_rule_id ON public.client_journey_automations(rule_id);
CREATE INDEX IF NOT EXISTS idx_client_journey_automations_status ON public.client_journey_automations(status);
CREATE INDEX IF NOT EXISTS idx_journey_trigger_conditions_rule_id ON public.journey_trigger_conditions(rule_id);
CREATE INDEX IF NOT EXISTS idx_journey_sequence_steps_rule_id ON public.journey_sequence_steps(rule_id);
CREATE INDEX IF NOT EXISTS idx_journey_step_executions_automation_id ON public.journey_step_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_journey_step_executions_status ON public.journey_step_executions(status);

-- Enable RLS
ALTER TABLE public.client_journey_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_trigger_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_step_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin-only via auth metadata)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
  AND (
    au.raw_user_meta_data->>'role' = 'admin'
    OR au.raw_app_meta_data->>'role' = 'admin'
    OR au.email LIKE '%@broussardlegalservices.com'
  )
)
$$;

DROP POLICY IF EXISTS "admin_manage_client_journey_automations" ON public.client_journey_automations;
CREATE POLICY "admin_manage_client_journey_automations"
ON public.client_journey_automations
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_manage_journey_trigger_conditions" ON public.journey_trigger_conditions;
CREATE POLICY "admin_manage_journey_trigger_conditions"
ON public.journey_trigger_conditions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_manage_journey_sequence_steps" ON public.journey_sequence_steps;
CREATE POLICY "admin_manage_journey_sequence_steps"
ON public.journey_sequence_steps
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_manage_journey_step_executions" ON public.journey_step_executions;
CREATE POLICY "admin_manage_journey_step_executions"
ON public.journey_step_executions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_journey_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_journey_automations_updated_at ON public.client_journey_automations;
CREATE TRIGGER trg_client_journey_automations_updated_at
  BEFORE UPDATE ON public.client_journey_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_updated_at();

DROP TRIGGER IF EXISTS trg_journey_trigger_conditions_updated_at ON public.journey_trigger_conditions;
CREATE TRIGGER trg_journey_trigger_conditions_updated_at
  BEFORE UPDATE ON public.journey_trigger_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_updated_at();
