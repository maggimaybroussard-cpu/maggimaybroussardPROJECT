-- Add stripe_checkout_session_id to client_invoices for idempotent webhook processing
-- This allows the webhook to deduplicate checkout.session.completed events

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Index for fast lookup by checkout session ID
CREATE INDEX IF NOT EXISTS idx_client_invoices_stripe_checkout_session_id
  ON public.client_invoices(stripe_checkout_session_id);

-- Ensure service_role policy exists for webhook updates (upserts from webhook handler)
DROP POLICY IF EXISTS "service_role_all_client_invoices_v2" ON public.client_invoices;
CREATE POLICY "service_role_all_client_invoices_v2"
  ON public.client_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure payments table allows service_role inserts (for recording invoice payments)
DROP POLICY IF EXISTS "service_role_all_payments" ON public.payments;
CREATE POLICY "service_role_all_payments"
  ON public.payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
