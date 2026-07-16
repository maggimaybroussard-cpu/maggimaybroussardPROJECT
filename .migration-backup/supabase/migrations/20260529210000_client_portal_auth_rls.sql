-- Client portal auth: ensure all portal-related tables have proper RLS for client access
-- This migration adds missing client-facing RLS policies for portal data access

-- ── payments: also allow lookup by email for pre-account payments ──────────
DROP POLICY IF EXISTS "clients_view_payments_by_email" ON public.payments;
CREATE POLICY "clients_view_payments_by_email"
ON public.payments
FOR SELECT
TO authenticated
USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- ── signature_requests: clients can read requests for their inquiry ─────────
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_read_own_signature_requests" ON public.signature_requests;
CREATE POLICY "clients_read_own_signature_requests"
ON public.signature_requests
FOR SELECT
TO authenticated
USING (public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_signature_requests" ON public.signature_requests;
CREATE POLICY "authenticated_manage_signature_requests"
ON public.signature_requests
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ── signatures: clients can read and insert their own signatures ────────────
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_read_own_signatures" ON public.signatures;
CREATE POLICY "clients_read_own_signatures"
ON public.signatures
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_insert_own_signatures" ON public.signatures;
CREATE POLICY "clients_insert_own_signatures"
ON public.signatures
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_manage_signatures" ON public.signatures;
CREATE POLICY "authenticated_manage_signatures"
ON public.signatures
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ── retainer_subscriptions: clients can read their own subscriptions ────────
ALTER TABLE public.retainer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_read_own_retainer_subscriptions" ON public.retainer_subscriptions;
CREATE POLICY "clients_read_own_retainer_subscriptions"
ON public.retainer_subscriptions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "authenticated_manage_retainer_subscriptions" ON public.retainer_subscriptions;
CREATE POLICY "authenticated_manage_retainer_subscriptions"
ON public.retainer_subscriptions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ── intake_submissions: clients can read their own intake submissions ───────
ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_read_own_intake_submissions" ON public.intake_submissions;
CREATE POLICY "clients_read_own_intake_submissions"
ON public.intake_submissions
FOR SELECT
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access WHERE user_id = auth.uid()
  )
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "authenticated_manage_intake_submissions" ON public.intake_submissions;
CREATE POLICY "authenticated_manage_intake_submissions"
ON public.intake_submissions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
