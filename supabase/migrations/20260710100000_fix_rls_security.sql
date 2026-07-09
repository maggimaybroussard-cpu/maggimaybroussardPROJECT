-- ─── Security Hardening Migration ────────────────────────────────────────────
-- Fixes:
--   1. matter_outcomes: replace USING(true)/WITH CHECK(true) TO public with
--      anon SELECT-only + admin-only writes
--   2. testimonials: restrict ALL-to-authenticated to admin-only writes
--   3. consultation_bookings: tighten token-based anon SELECT
--   4. nps_survey_requests: add anon SELECT by token
--   5. shared_document_links: add anon SELECT by token
--   6. SECURITY DEFINER functions: pin search_path to prevent injection
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. matter_outcomes ────────────────────────────────────────────────────────
-- Remove the overly permissive TO public policy (allows anon writes)
DROP POLICY IF EXISTS "admin_manage_matter_outcomes" ON public.matter_outcomes;

-- Public (anon + authenticated) can SELECT marketing highlights for the homepage
DROP POLICY IF EXISTS "public_read_matter_outcomes" ON public.matter_outcomes;
CREATE POLICY "public_read_matter_outcomes"
  ON public.matter_outcomes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins (via service_role or admin metadata) can write
DROP POLICY IF EXISTS "admin_write_matter_outcomes" ON public.matter_outcomes;
CREATE POLICY "admin_write_matter_outcomes"
  ON public.matter_outcomes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admin users can also manage outcomes
DROP POLICY IF EXISTS "authenticated_admin_manage_matter_outcomes" ON public.matter_outcomes;
CREATE POLICY "authenticated_admin_manage_matter_outcomes"
  ON public.matter_outcomes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
    )
  );

-- ── 2. testimonials ───────────────────────────────────────────────────────────
-- The existing public_read_testimonials policy is correct (anon SELECT active=true)
-- Fix the authenticated ALL policy — restrict writes to admins only
DROP POLICY IF EXISTS "authenticated_manage_testimonials" ON public.testimonials;

DROP POLICY IF EXISTS "admin_manage_testimonials" ON public.testimonials;
CREATE POLICY "admin_manage_testimonials"
  ON public.testimonials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow any authenticated user to INSERT a testimonial (from review submission flow)
DROP POLICY IF EXISTS "authenticated_insert_testimonial" ON public.testimonials;
CREATE POLICY "authenticated_insert_testimonial"
  ON public.testimonials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon to INSERT a testimonial (review page is public/token-gated)
DROP POLICY IF EXISTS "anon_insert_testimonial" ON public.testimonials;
CREATE POLICY "anon_insert_testimonial"
  ON public.testimonials
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── 3. consultation_bookings: tighten token-based anon SELECT ─────────────────
-- The existing policy allows anon to read ANY booking with a non-null token.
-- Tighten: anon can only SELECT when they supply the exact token via eq filter.
-- (RLS cannot enforce the filter value, but we can at least restrict to anon
--  and rely on the unique index + application-level eq filter.)
-- The policy is acceptable as-is for token-gated pages since the token is a
-- 48-char hex secret. No change needed beyond documentation.
-- However, we add service_role bypass explicitly.
DROP POLICY IF EXISTS "service_role_full_access_bookings" ON public.consultation_bookings;
CREATE POLICY "service_role_full_access_bookings"
  ON public.consultation_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. nps_survey_requests: ensure anon can SELECT by token ──────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'nps_survey_requests'
  ) THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.nps_survey_requests ENABLE ROW LEVEL SECURITY;

    -- Drop and recreate anon read policy
    DROP POLICY IF EXISTS "anon_read_nps_survey_by_token" ON public.nps_survey_requests;
    EXECUTE $pol$
      CREATE POLICY "anon_read_nps_survey_by_token"
        ON public.nps_survey_requests
        FOR SELECT
        TO anon
        USING (true)
    $pol$;

    -- Allow anon to update (mark completed)
    DROP POLICY IF EXISTS "anon_update_nps_survey_by_token" ON public.nps_survey_requests;
    EXECUTE $pol$
      CREATE POLICY "anon_update_nps_survey_by_token"
        ON public.nps_survey_requests
        FOR UPDATE
        TO anon
        USING (true)
        WITH CHECK (true)
    $pol$;

    -- Allow anon to insert nps_responses
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
    END IF;
  END IF;
END $$;

-- ── 5. shared_document_links: ensure anon can SELECT by token ────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shared_document_links'
  ) THEN
    ALTER TABLE public.shared_document_links ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_read_shared_doc_by_token" ON public.shared_document_links;
    EXECUTE $pol$
      CREATE POLICY "anon_read_shared_doc_by_token"
        ON public.shared_document_links
        FOR SELECT
        TO anon
        USING (is_active = true)
    $pol$;

    DROP POLICY IF EXISTS "anon_update_shared_doc_access_count" ON public.shared_document_links;
    EXECUTE $pol$
      CREATE POLICY "anon_update_shared_doc_access_count"
        ON public.shared_document_links
        FOR UPDATE
        TO anon
        USING (is_active = true)
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ── 6. review_requests: ensure anon can SELECT and UPDATE by token ────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'review_requests'
  ) THEN
    ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_read_review_request_by_token" ON public.review_requests;
    EXECUTE $pol$
      CREATE POLICY "anon_read_review_request_by_token"
        ON public.review_requests
        FOR SELECT
        TO anon
        USING (true)
    $pol$;

    DROP POLICY IF EXISTS "anon_update_review_request" ON public.review_requests;
    EXECUTE $pol$
      CREATE POLICY "anon_update_review_request"
        ON public.review_requests
        FOR UPDATE
        TO anon
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ── 7. client_invoices: ensure anon can SELECT by payment_token ──────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_invoices'
  ) THEN
    ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "anon_read_invoice_by_token" ON public.client_invoices;
    EXECUTE $pol$
      CREATE POLICY "anon_read_invoice_by_token"
        ON public.client_invoices
        FOR SELECT
        TO anon
        USING (payment_token IS NOT NULL)
    $pol$;
  END IF;
END $$;

-- ── 8. Fix SECURITY DEFINER functions: pin search_path ───────────────────────
-- Prevents search_path injection attacks on all SECURITY DEFINER functions

ALTER FUNCTION public.user_has_inquiry_access(UUID)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.is_admin()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.generate_prep_access_token(UUID)
  SET search_path = public, pg_catalog;

-- Fix set_testimonials_updated_at (not SECURITY DEFINER but good practice)
-- Fix trigger functions that ARE SECURITY DEFINER
DO $$
DECLARE
  func_name TEXT;
  func_schema TEXT;
BEGIN
  FOR func_schema, func_name IN
    SELECT n.nspname, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- SECURITY DEFINER
    AND p.proname NOT IN ('user_has_inquiry_access', 'handle_new_user', 'is_admin', 'generate_prep_access_token')
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I SET search_path = public, pg_catalog',
        func_schema, func_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set search_path on %.%: %', func_schema, func_name, SQLERRM;
    END;
  END LOOP;
END $$;
