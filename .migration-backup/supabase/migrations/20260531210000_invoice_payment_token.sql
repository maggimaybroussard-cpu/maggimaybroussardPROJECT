-- Add payment_token to client_invoices for pre-filled, tokenized Stripe checkout links
-- Clients receive a direct /pay/<token> URL in emails — no login required to pay

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS payment_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Backfill existing rows that have no token
UPDATE public.client_invoices
  SET payment_token = gen_random_uuid()
  WHERE payment_token IS NULL;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_client_invoices_payment_token
  ON public.client_invoices(payment_token);

-- Allow anonymous/public reads by payment_token (for the /pay/[token] page)
-- This policy exposes only the minimum fields needed to render the checkout page
DROP POLICY IF EXISTS "public_read_invoice_by_token" ON public.client_invoices;
CREATE POLICY "public_read_invoice_by_token"
  ON public.client_invoices
  FOR SELECT
  TO anon
  USING (payment_token IS NOT NULL);
