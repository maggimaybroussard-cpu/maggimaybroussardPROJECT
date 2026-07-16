-- Post-Booking Intake Workflow
-- Tracks multi-step intake progress: docs → retainer signature → payment → case assignment

CREATE TABLE IF NOT EXISTS public.intake_workflow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  booking_event_id TEXT,
  booking_start_time TIMESTAMPTZ,
  booking_event_name TEXT,
  -- Step tracking
  step_docs_completed BOOLEAN DEFAULT FALSE,
  step_docs_completed_at TIMESTAMPTZ,
  step_signature_completed BOOLEAN DEFAULT FALSE,
  step_signature_completed_at TIMESTAMPTZ,
  step_payment_completed BOOLEAN DEFAULT FALSE,
  step_payment_completed_at TIMESTAMPTZ,
  step_case_assigned BOOLEAN DEFAULT FALSE,
  step_case_assigned_at TIMESTAMPTZ,
  -- Collected data
  intake_doc_data JSONB DEFAULT '{}'::JSONB,
  retainer_signature_data TEXT,
  retainer_signature_type TEXT,
  retainer_signed_name TEXT,
  payment_intent_id TEXT,
  payment_amount INTEGER,
  payment_status TEXT DEFAULT 'pending',
  assigned_attorney_name TEXT,
  assigned_attorney_email TEXT,
  -- QR code / appointment
  appointment_qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Status
  workflow_status TEXT DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_workflow_inquiry ON public.intake_workflow_sessions(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_intake_workflow_email ON public.intake_workflow_sessions(client_email);
CREATE INDEX IF NOT EXISTS idx_intake_workflow_qr ON public.intake_workflow_sessions(appointment_qr_token);

ALTER TABLE public.intake_workflow_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_intake_workflow" ON public.intake_workflow_sessions;
CREATE POLICY "public_insert_intake_workflow"
ON public.intake_workflow_sessions
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_intake_workflow_by_token" ON public.intake_workflow_sessions;
CREATE POLICY "public_select_intake_workflow_by_token"
ON public.intake_workflow_sessions
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "public_update_intake_workflow" ON public.intake_workflow_sessions;
CREATE POLICY "public_update_intake_workflow"
ON public.intake_workflow_sessions
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
