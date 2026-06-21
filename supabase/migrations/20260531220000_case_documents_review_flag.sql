-- Add requires_client_review flag and document_type to case_documents
ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS requires_client_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('contract', 'filing', 'correspondence', 'invoice', 'evidence', 'other'));

-- Index for filtering pending review documents
CREATE INDEX IF NOT EXISTS idx_case_documents_requires_review ON public.case_documents(requires_client_review) WHERE requires_client_review = true;

-- Index for filtering by document type
CREATE INDEX IF NOT EXISTS idx_case_documents_document_type ON public.case_documents(document_type);
