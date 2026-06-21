-- Add file_size column to case_documents
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS file_size bigint;

-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "clients_upload_own_documents" ON storage.objects;
CREATE POLICY "clients_upload_own_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: Allow authenticated users to read their own documents
DROP POLICY IF EXISTS "clients_read_own_documents" ON storage.objects;
CREATE POLICY "clients_read_own_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: Allow authenticated users to delete their own documents
DROP POLICY IF EXISTS "clients_delete_own_documents" ON storage.objects;
CREATE POLICY "clients_delete_own_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy for clients to INSERT their own case_documents records
DROP POLICY IF EXISTS "clients_insert_own_case_documents" ON public.case_documents;
CREATE POLICY "clients_insert_own_case_documents"
ON public.case_documents
FOR INSERT
TO authenticated
WITH CHECK (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access WHERE user_id = auth.uid()
  )
);

-- RLS policy for clients to DELETE their own case_documents records
DROP POLICY IF EXISTS "clients_delete_own_case_documents" ON public.case_documents;
CREATE POLICY "clients_delete_own_case_documents"
ON public.case_documents
FOR DELETE
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access WHERE user_id = auth.uid()
  )
);
