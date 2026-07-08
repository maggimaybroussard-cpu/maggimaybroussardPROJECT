-- Case File Repository Audit Log
-- Tracks all file access events: upload, view, download, share, revoke
-- Builds on existing case_documents, document_download_history, shared_document_links

CREATE TABLE IF NOT EXISTS public.file_repository_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type = ANY (ARRAY['upload'::text, 'view'::text, 'download'::text, 'share'::text, 'revoke_share'::text, 'delete'::text, 'update_visibility'::text])),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'admin' CHECK (actor_role = ANY (ARRAY['admin'::text, 'paralegal'::text, 'client'::text])),
  file_name TEXT,
  document_type TEXT,
  notes TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_repository_audit_inquiry_id ON public.file_repository_audit(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_file_repository_audit_document_id ON public.file_repository_audit(document_id);
CREATE INDEX IF NOT EXISTS idx_file_repository_audit_created_at ON public.file_repository_audit(created_at DESC);

ALTER TABLE public.file_repository_audit ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admin_full_access_file_repository_audit" ON public.file_repository_audit;
CREATE POLICY "admin_full_access_file_repository_audit"
ON public.file_repository_audit
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also add client_visible column to case_documents if not present (idempotent)
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT true;

-- Enable realtime for audit log
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_repository_audit;
