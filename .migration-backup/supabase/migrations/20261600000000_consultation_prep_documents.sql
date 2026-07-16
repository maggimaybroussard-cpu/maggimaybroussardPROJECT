-- Migration: consultation_prep_documents
-- Stores prep documents/resources attached to consultation bookings
-- These are included in the client's confirmation email

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_prep_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES public.consultation_bookings(id) ON DELETE CASCADE,
  inquiry_id      UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  public_url      TEXT,
  description     TEXT,
  uploaded_by     TEXT DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prep_docs_booking_id  ON public.consultation_prep_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_prep_docs_inquiry_id  ON public.consultation_prep_documents(inquiry_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.consultation_prep_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_prep_documents" ON public.consultation_prep_documents;
CREATE POLICY "admin_manage_prep_documents"
  ON public.consultation_prep_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_prep_documents" ON public.consultation_prep_documents;
CREATE POLICY "public_read_prep_documents"
  ON public.consultation_prep_documents
  FOR SELECT
  TO anon
  USING (true);

-- ── Storage: allow prep-documents folder in case-documents bucket ──────────
-- The case-documents bucket already exists; we just add a policy for the
-- consultation-prep subfolder so admins can upload/delete there.

DROP POLICY IF EXISTS "admin_upload_prep_docs" ON storage.objects;
CREATE POLICY "admin_upload_prep_docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = 'consultation-prep');

DROP POLICY IF EXISTS "admin_delete_prep_docs" ON storage.objects;
CREATE POLICY "admin_delete_prep_docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = 'consultation-prep');

DROP POLICY IF EXISTS "public_read_prep_docs" ON storage.objects;
CREATE POLICY "public_read_prep_docs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = 'consultation-prep');
