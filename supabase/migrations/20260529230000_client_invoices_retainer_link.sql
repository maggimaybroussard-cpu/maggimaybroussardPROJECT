-- Add Stripe invoice linking and retainer subscription reference to client_invoices
-- These columns allow invoices to be traced back to the exact Stripe invoice
-- and the retainer subscription that triggered them.

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE SET NULL;

-- Index for fast lookup by Stripe invoice ID (deduplication in webhook)
CREATE INDEX IF NOT EXISTS idx_client_invoices_stripe_invoice_id
  ON public.client_invoices(stripe_invoice_id);

-- Index for fetching all invoices for a given retainer subscription
CREATE INDEX IF NOT EXISTS idx_client_invoices_retainer_subscription_id
  ON public.client_invoices(retainer_subscription_id);

-- Service role (edge functions) can do all operations — needed for webhook upserts
DROP POLICY IF EXISTS "service_role_all_client_invoices" ON public.client_invoices;
CREATE POLICY "service_role_all_client_invoices"
  ON public.client_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
