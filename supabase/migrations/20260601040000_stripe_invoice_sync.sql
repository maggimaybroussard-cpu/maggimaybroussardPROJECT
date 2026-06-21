-- ─── Stripe Invoice Sync ─────────────────────────────────────────────────────
-- Adds Stripe Invoice API fields to client_invoices so admin-created invoices
-- can be synced to Stripe and clients see hosted payment links in the portal.

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_url       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_pdf       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_sync_status       TEXT DEFAULT 'unsynced',
  ADD COLUMN IF NOT EXISTS stripe_synced_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT;

-- Index for fast lookup by Stripe invoice ID (used by webhook)
CREATE INDEX IF NOT EXISTS idx_client_invoices_stripe_invoice_id
  ON public.client_invoices(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- Index for sync status filtering (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_client_invoices_stripe_sync_status
  ON public.client_invoices(stripe_sync_status);

COMMENT ON COLUMN public.client_invoices.stripe_invoice_id    IS 'Stripe Invoice object ID (in_xxx)';
COMMENT ON COLUMN public.client_invoices.stripe_invoice_url   IS 'Stripe hosted invoice URL shown to client';
COMMENT ON COLUMN public.client_invoices.stripe_invoice_pdf   IS 'Stripe invoice PDF download URL';
COMMENT ON COLUMN public.client_invoices.stripe_sync_status   IS 'unsynced | syncing | synced | failed';
COMMENT ON COLUMN public.client_invoices.stripe_synced_at     IS 'Timestamp of last successful Stripe sync';
COMMENT ON COLUMN public.client_invoices.stripe_customer_id   IS 'Stripe Customer ID used for this invoice';
