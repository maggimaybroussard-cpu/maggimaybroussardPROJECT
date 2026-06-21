-- Document download history tracking
CREATE TABLE IF NOT EXISTS public.document_download_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  downloaded_by TEXT NOT NULL DEFAULT 'Admin',
  downloaded_by_role TEXT NOT NULL DEFAULT 'admin',
  file_name TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_download_history_document_id ON public.document_download_history(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_download_history_inquiry_id ON public.document_download_history(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_doc_download_history_downloaded_at ON public.document_download_history(downloaded_at DESC);

ALTER TABLE public.document_download_history ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "admin_manage_download_history" ON public.document_download_history;
CREATE POLICY "admin_manage_download_history"
ON public.document_download_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add storage_path column to case_documents if not present (for signed URL generation)
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS storage_path TEXT;
