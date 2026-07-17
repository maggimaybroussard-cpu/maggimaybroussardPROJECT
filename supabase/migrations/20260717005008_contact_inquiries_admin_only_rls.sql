-- ─── Contact Inquiries: Admin-Only RLS ───────────────────────────────────────
-- Tightens access to contact_inquiries so only the admin user (Maggi) can
-- read, update, and delete submissions. The public INSERT policy is preserved
-- so the contact form continues to work for unauthenticated visitors.
-- The narrow anon SELECT policy for the /pay/[token] invoice join is also
-- preserved (added in 20260712000000_fix_anon_contact_inquiries_join.sql).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Drop the overly-broad authenticated policies ──────────────────────────────
DROP POLICY IF EXISTS "authenticated_can_read_contact_inquiries" ON public.contact_inquiries;
DROP POLICY IF EXISTS "authenticated_can_update_contact_inquiries" ON public.contact_inquiries;
DROP POLICY IF EXISTS "authenticated_can_delete_contact_inquiries" ON public.contact_inquiries;

-- ── Admin-only SELECT ─────────────────────────────────────────────────────────
-- Only users whose auth metadata carries role = 'admin' (Maggi) can read rows.
DROP POLICY IF EXISTS "admin_read_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "admin_read_contact_inquiries"
  ON public.contact_inquiries
  FOR SELECT
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

-- ── Admin-only UPDATE ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "admin_update_contact_inquiries"
  ON public.contact_inquiries
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

-- ── Admin-only DELETE ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "admin_delete_contact_inquiries"
  ON public.contact_inquiries
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

-- ── Service-role bypass (Edge Functions / server-side operations) ─────────────
DROP POLICY IF EXISTS "service_role_full_access_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "service_role_full_access_contact_inquiries"
  ON public.contact_inquiries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Preserved: public INSERT (contact form submissions) ───────────────────────
-- "public_can_insert_contact_inquiries" already exists from the original
-- migration — no change needed.

-- ── Preserved: anon SELECT via invoice token ─────────────────────────────────
-- "anon_read_contact_inquiry_via_invoice_token" already exists from
-- 20260712000000_fix_anon_contact_inquiries_join.sql — no change needed.
