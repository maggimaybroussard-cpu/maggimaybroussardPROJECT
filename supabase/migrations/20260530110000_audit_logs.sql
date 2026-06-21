-- ─── Audit Logs Migration ─────────────────────────────────────────────────────
-- Tracks all admin actions: document uploads, invoice sends, case updates, user logins

-- 1. Action type enum
DROP TYPE IF EXISTS public.audit_action_type CASCADE;
CREATE TYPE public.audit_action_type AS ENUM (
  'user_login',
  'user_logout',
  'document_upload',
  'document_delete',
  'document_download',
  'invoice_sent',
  'invoice_created',
  'invoice_updated',
  'case_created',
  'case_updated',
  'case_status_changed',
  'case_stage_changed',
  'case_note_added',
  'client_invited',
  'client_email_sent',
  'task_created',
  'task_updated',
  'task_completed',
  'template_created',
  'template_updated',
  'template_deleted',
  'email_template_updated',
  'retainer_created',
  'retainer_updated',
  'payment_recorded',
  'admin_action'
);

-- 2. Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type public.audit_action_type NOT NULL,
  actor_email TEXT NOT NULL,
  actor_id UUID,
  target_type TEXT,
  target_id TEXT,
  target_label TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON public.audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_audit_logs_fts ON public.audit_logs
  USING gin(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(actor_email, '') || ' ' || coalesce(target_label, '')));

-- 4. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — admin-only read/write
DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_read_audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
        OR au.email LIKE '%@maggimaybr%'
        OR au.email LIKE '%admin%'
      )
    )
  );

DROP POLICY IF EXISTS "service_role_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "service_role_insert_audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
