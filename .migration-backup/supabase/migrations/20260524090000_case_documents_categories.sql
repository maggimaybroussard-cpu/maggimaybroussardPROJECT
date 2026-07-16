-- Add category and description columns to case_documents
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add a check constraint for valid categories
ALTER TABLE public.case_documents
DROP CONSTRAINT IF EXISTS case_documents_category_check;

ALTER TABLE public.case_documents
ADD CONSTRAINT case_documents_category_check
CHECK (category IN ('work_product', 'discovery', 'case_files', 'court_filings', 'contracts', 'correspondence', 'other'));

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_case_documents_category ON public.case_documents(category);
CREATE INDEX IF NOT EXISTS idx_case_documents_inquiry_category ON public.case_documents(inquiry_id, category);

-- Allow admin/staff to upload to the paralegal folder in case-documents bucket
DROP POLICY IF EXISTS "staff_upload_documents" ON storage.objects;
CREATE POLICY "staff_upload_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'paralegal'
  )
);

-- Allow admin/staff to read all documents in case-documents bucket
DROP POLICY IF EXISTS "staff_read_all_documents" ON storage.objects;
CREATE POLICY "staff_read_all_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'paralegal'
  )
);

-- Allow admin/staff to delete documents
DROP POLICY IF EXISTS "staff_delete_documents" ON storage.objects;
CREATE POLICY "staff_delete_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'paralegal'
  )
);

-- Allow clients to read documents shared with them (from paralegal folder for their inquiry)
-- This is handled via the case_documents table RLS + file_url stored in DB
-- Clients access via the stored public URL, not direct storage access

-- Update the existing clients_read_own_documents policy to also allow reading paralegal folder
-- for documents linked to their inquiry
DROP POLICY IF EXISTS "clients_read_own_documents" ON storage.objects;
CREATE POLICY "clients_read_own_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'paralegal'
  )
);
