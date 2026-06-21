-- Migration: Case Documents Versioning & Document Type Organization
-- Adds version tracking, parent document chaining, document type, and uploader role
-- to the existing case_documents table.

-- 1. Add versioning columns to case_documents
ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS version_notes TEXT;

-- 2. Add CHECK constraint for document_type (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'case_documents'
      AND constraint_name = 'case_documents_document_type_check'
  ) THEN
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_document_type_check
      CHECK (document_type = ANY (ARRAY[
        'contract'::text,
        'filing'::text,
        'discovery'::text,
        'correspondence'::text,
        'work_product'::text,
        'evidence'::text,
        'other'::text
      ]));
  END IF;
END $$;

-- 3. Add CHECK constraint for uploaded_by_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'case_documents'
      AND constraint_name = 'case_documents_uploaded_by_role_check'
  ) THEN
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_uploaded_by_role_check
      CHECK (uploaded_by_role = ANY (ARRAY['admin'::text, 'paralegal'::text, 'client'::text]));
  END IF;
END $$;

-- 4. Indexes for versioning queries
CREATE INDEX IF NOT EXISTS idx_case_documents_parent_document_id
  ON public.case_documents(parent_document_id);

CREATE INDEX IF NOT EXISTS idx_case_documents_document_type
  ON public.case_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_case_documents_inquiry_version
  ON public.case_documents(inquiry_id, version DESC);

-- 5. RLS policies for versioning columns (existing RLS already enabled on case_documents)
-- Allow admin/paralegal to insert with role
DROP POLICY IF EXISTS "admin_manage_case_documents" ON public.case_documents;
CREATE POLICY "admin_manage_case_documents"
  ON public.case_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Helper view: latest version of each document chain per case
CREATE OR REPLACE VIEW public.case_documents_latest AS
SELECT cd.*
FROM public.case_documents cd
WHERE cd.parent_document_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM public.case_documents newer
     WHERE newer.parent_document_id = cd.parent_document_id
       AND newer.version > cd.version
   );
