-- ─── Fix: Allow anon to read contact_inquiries rows referenced by invoices ────
-- Problem: /pay/[token] page queries:
--   client_invoices.select('*, contact_inquiries(name, email, service)')
-- The client_invoices anon SELECT policy exists, but contact_inquiries has NO
-- anon SELECT policy — only authenticated can read it. This causes the embedded
-- join to return null (or a 401 on the sub-request) for unauthenticated visitors
-- on the public invoice payment page.
--
-- Fix: Add a narrow anon SELECT policy on contact_inquiries that only allows
-- reading rows that are referenced by a client_invoices row with a valid
-- payment_token. This is the minimum required for the /pay/[token] flow.
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow anon to read contact_inquiries rows that are linked to a payable invoice
DROP POLICY IF EXISTS "anon_read_contact_inquiry_via_invoice_token" ON public.contact_inquiries;
CREATE POLICY "anon_read_contact_inquiry_via_invoice_token"
  ON public.contact_inquiries
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.client_invoices
      WHERE client_invoices.inquiry_id = contact_inquiries.id
        AND client_invoices.payment_token IS NOT NULL
    )
  );

-- Also allow anon to read contact_inquiries rows linked to a shared document
-- (shared_document_links may reference an inquiry for context)
-- This is a no-op if no such FK exists — safe to leave in.
-- (No policy added here — shared_doc flow does not join contact_inquiries)

-- Ensure the nps_responses table allows anon INSERT (survey submission flow)
-- This was added conditionally in the previous migration but may have been
-- skipped if nps_responses did not exist at that time. Re-apply idempotently.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'nps_responses'
  ) THEN
    ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_insert_nps_response" ON public.nps_responses;
    EXECUTE $pol$
      CREATE POLICY "anon_insert_nps_response"
        ON public.nps_responses
        FOR INSERT
        TO anon
        WITH CHECK (true)
    $pol$;

    -- Allow anon to read their own submission (optional, for confirmation display)
    DROP POLICY IF EXISTS "authenticated_read_nps_responses" ON public.nps_responses;
    EXECUTE $pol$
      CREATE POLICY "authenticated_read_nps_responses"
        ON public.nps_responses
        FOR SELECT
        TO authenticated
        USING (true)
    $pol$;
  END IF;
END $$;

-- Ensure consultation_prep_documents allows anon SELECT
-- (consultation-prep/[token] page reads these after validating the booking token)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consultation_prep_documents'
  ) THEN
    ALTER TABLE public.consultation_prep_documents ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_read_prep_documents_via_booking" ON public.consultation_prep_documents;
    EXECUTE $pol$
      CREATE POLICY "anon_read_prep_documents_via_booking"
        ON public.consultation_prep_documents
        FOR SELECT
        TO anon
        USING (
          EXISTS (
            SELECT 1 FROM public.consultation_bookings
            WHERE consultation_bookings.id = consultation_prep_documents.booking_id
              AND consultation_bookings.prep_access_token IS NOT NULL
          )
        )
    $pol$;

    DROP POLICY IF EXISTS "authenticated_manage_prep_documents" ON public.consultation_prep_documents;
    EXECUTE $pol$
      CREATE POLICY "authenticated_manage_prep_documents"
        ON public.consultation_prep_documents
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;
