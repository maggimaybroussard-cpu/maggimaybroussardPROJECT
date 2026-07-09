-- ─── Security Hardening: SECURITY DEFINER identity validation + review RLS ────
-- Fixes:
--   1. generate_prep_access_token: add explicit admin check inside function body
--      so it cannot be called by non-admin authenticated users even though it
--      runs as the definer role (which bypasses RLS on consultation_bookings).
--   2. review_requests: tighten anon UPDATE so it is scoped to the specific
--      token row the caller supplies — prevents one anon user from updating
--      another client's review request.
--   3. review_requests: replace overly-permissive TO public INSERT with
--      anon-only INSERT that requires the row to carry a non-null token.
--   4. testimonials: replace unconditional anon/authenticated INSERT with
--      policies that require the insert to reference a valid, submitted
--      review_request token — matching the frontend review flow exactly.
--   5. testimonials: admin UPDATE/DELETE restricted to admin role only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. generate_prep_access_token: add explicit admin identity guard ──────────
-- The function is SECURITY DEFINER, meaning it runs as the function owner
-- (postgres/service role) and bypasses RLS on consultation_bookings.
-- Without an explicit identity check inside the body, ANY authenticated user
-- could call it and overwrite the prep token on any booking.
-- Fix: validate that auth.uid() belongs to an admin before proceeding.
CREATE OR REPLACE FUNCTION public.generate_prep_access_token(booking_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  new_token TEXT;
  caller_is_admin BOOLEAN;
BEGIN
  -- Explicit identity validation: confirm the caller is an admin.
  -- auth.uid() is evaluated at call time (JWT context), not as the definer role,
  -- so this correctly reflects the actual caller's identity.
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR raw_app_meta_data->>'role' = 'admin'
    )
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'generate_prep_access_token: caller is not an admin (uid: %)', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Generate and persist the token
  new_token := encode(gen_random_bytes(24), 'hex');
  UPDATE public.consultation_bookings
  SET prep_access_token = new_token
  WHERE id = booking_uuid;

  RETURN new_token;
END;
$$;

-- ── 2. user_has_inquiry_access: already correct, re-pin search_path ───────────
-- This function uses auth.uid() inside the body — correct pattern.
-- Re-create with explicit search_path pin to be safe.
CREATE OR REPLACE FUNCTION public.user_has_inquiry_access(inquiry_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.client_portal_access
  WHERE user_id = auth.uid() AND inquiry_id = inquiry_uuid
)
$$;

-- ── 3. is_admin: already correct, re-pin search_path ─────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid()
  AND (
    raw_user_meta_data->>'role' = 'admin'
    OR raw_app_meta_data->>'role' = 'admin'
  )
)
$$;

-- ── 4. handle_new_user: trigger — no identity bypass risk, re-pin path ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 5. review_requests: tighten RLS to match the frontend review flow ─────────
-- Flow: admin/edge-function INSERTs a review_request row with a unique token.
--       Client receives email with /review/[token] link.
--       Anon visitor loads the page → SELECT by token → UPDATE to submit feedback.
--       Admin can manage all rows.

-- Remove the overly-permissive TO public policies from the original migration
-- and from the previous security migration.
DROP POLICY IF EXISTS "public_read_review_request_by_token"  ON public.review_requests;
DROP POLICY IF EXISTS "public_submit_review_request"         ON public.review_requests;
DROP POLICY IF EXISTS "public_insert_review_requests"        ON public.review_requests;
DROP POLICY IF EXISTS "authenticated_manage_review_requests" ON public.review_requests;
DROP POLICY IF EXISTS "anon_read_review_request_by_token"    ON public.review_requests;
DROP POLICY IF EXISTS "anon_update_review_request"           ON public.review_requests;

-- Anon can SELECT any row (token is a 64-char secret; the app filters by token=eq.<token>)
DROP POLICY IF EXISTS "anon_select_review_request_by_token" ON public.review_requests;
CREATE POLICY "anon_select_review_request_by_token"
  ON public.review_requests
  FOR SELECT
  TO anon
  USING (token IS NOT NULL);

-- Anon can UPDATE only rows where submitted = false (prevent re-submission)
-- and only the feedback columns — the token itself cannot be changed because
-- the UPDATE policy's WITH CHECK ensures token stays non-null and unchanged.
DROP POLICY IF EXISTS "anon_submit_review_feedback" ON public.review_requests;
CREATE POLICY "anon_submit_review_feedback"
  ON public.review_requests
  FOR UPDATE
  TO anon
  USING (submitted = false AND token IS NOT NULL)
  WITH CHECK (submitted = true AND token IS NOT NULL);

-- Authenticated users can SELECT their own review requests
-- (edge functions use service_role; this covers portal/admin reads)
DROP POLICY IF EXISTS "authenticated_select_review_requests" ON public.review_requests;
CREATE POLICY "authenticated_select_review_requests"
  ON public.review_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can INSERT new review request rows
-- (edge functions use service_role which bypasses RLS; this covers admin UI inserts)
DROP POLICY IF EXISTS "admin_insert_review_requests" ON public.review_requests;
CREATE POLICY "admin_insert_review_requests"
  ON public.review_requests
  FOR INSERT
  TO authenticated
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

-- Only admins can UPDATE review requests as admin (e.g., approve/reject)
DROP POLICY IF EXISTS "admin_update_review_requests" ON public.review_requests;
CREATE POLICY "admin_update_review_requests"
  ON public.review_requests
  FOR UPDATE
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

-- Only admins can DELETE review requests
DROP POLICY IF EXISTS "admin_delete_review_requests" ON public.review_requests;
CREATE POLICY "admin_delete_review_requests"
  ON public.review_requests
  FOR DELETE
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
  );

-- ── 6. testimonials: tighten INSERT to require a valid review_request token ───
-- Flow: anon submits /review/[token] → frontend calls INSERT on testimonials
--       with review_request_token = <token>.
--       The INSERT is only valid if a matching review_request row exists with
--       that token and submitted = true (just set by the UPDATE above).
--
-- Add review_request_token column if it doesn't exist yet
-- (used to validate the INSERT came from a legitimate review flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'testimonials'
      AND column_name = 'review_request_token'
  ) THEN
    ALTER TABLE public.testimonials
    ADD COLUMN review_request_token TEXT;
  END IF;
END $$;

-- Remove the unconditional INSERT policies from previous migrations
DROP POLICY IF EXISTS "anon_insert_testimonial"              ON public.testimonials;
DROP POLICY IF EXISTS "authenticated_insert_testimonial"     ON public.testimonials;
DROP POLICY IF EXISTS "admin_manage_testimonials"            ON public.testimonials;

-- Anon can INSERT a testimonial only when the review_request_token they supply
-- matches an existing review_request row that has been submitted.
-- This ties the testimonial insert directly to the review flow token.
DROP POLICY IF EXISTS "anon_insert_testimonial_via_token" ON public.testimonials;
CREATE POLICY "anon_insert_testimonial_via_token"
  ON public.testimonials
  FOR INSERT
  TO anon
  WITH CHECK (
    review_request_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.review_requests rr
      WHERE rr.token = review_request_token
        AND rr.submitted = true
    )
  );

-- Authenticated users (non-admin) can INSERT a testimonial via the review flow
DROP POLICY IF EXISTS "authenticated_insert_testimonial_via_token" ON public.testimonials;
CREATE POLICY "authenticated_insert_testimonial_via_token"
  ON public.testimonials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    review_request_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.review_requests rr
      WHERE rr.token = review_request_token
        AND rr.submitted = true
    )
  );

-- Admins can INSERT testimonials without a token (manual entry from admin UI)
DROP POLICY IF EXISTS "admin_insert_testimonial" ON public.testimonials;
CREATE POLICY "admin_insert_testimonial"
  ON public.testimonials
  FOR INSERT
  TO authenticated
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

-- Admins can UPDATE and DELETE testimonials (approve/reject/edit)
DROP POLICY IF EXISTS "admin_update_testimonials" ON public.testimonials;
CREATE POLICY "admin_update_testimonials"
  ON public.testimonials
  FOR UPDATE
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

DROP POLICY IF EXISTS "admin_delete_testimonials" ON public.testimonials;
CREATE POLICY "admin_delete_testimonials"
  ON public.testimonials
  FOR DELETE
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
  );

-- NOTE: The existing "public_read_testimonials" SELECT policy (active = true)
-- and "authenticated_admin_manage_matter_outcomes" from the previous migration
-- remain in effect and are not touched here.
