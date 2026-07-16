-- Intake submissions table: stores post-booking intake form data
-- Linked to contact_inquiries via email (since inquiry may not exist yet at intake time)

CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  firm_name           TEXT,
  case_type           TEXT NOT NULL,
  case_description    TEXT NOT NULL,
  opposing_party      TEXT,
  urgency             TEXT NOT NULL DEFAULT 'standard',
  additional_notes    TEXT,
  calendly_event_uuid TEXT,
  inquiry_id          UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  submitted_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_email ON public.intake_submissions(email);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_inquiry_id ON public.intake_submissions(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_calendly_event_uuid ON public.intake_submissions(calendly_event_uuid);

ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

-- Public insert: anyone who has a booking link can submit intake
DROP POLICY IF EXISTS "public_can_insert_intake_submissions" ON public.intake_submissions;
CREATE POLICY "public_can_insert_intake_submissions"
ON public.intake_submissions
FOR INSERT
TO public
WITH CHECK (true);

-- Only authenticated users (admin) can read intake submissions
DROP POLICY IF EXISTS "authenticated_can_read_intake_submissions" ON public.intake_submissions;
CREATE POLICY "authenticated_can_read_intake_submissions"
ON public.intake_submissions
FOR SELECT
TO authenticated
USING (true);

-- Allow public update (for status updates from edge functions)
DROP POLICY IF EXISTS "public_can_update_intake_submissions" ON public.intake_submissions;
CREATE POLICY "public_can_update_intake_submissions"
ON public.intake_submissions
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Storage policy: allow public uploads to case-documents bucket for intake
-- (bucket already exists, policies may already be set — add if missing)
DO $$
BEGIN
  -- Allow public uploads to case-documents for intake form
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'intake_public_upload_case_documents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "intake_public_upload_case_documents"
      ON storage.objects
      FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'case-documents')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'intake_public_select_case_documents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "intake_public_select_case_documents"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'case-documents')
    $policy$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Storage policy setup skipped: %', SQLERRM;
END $$;
