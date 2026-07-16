-- ─── Invoice Tracking Enhancements ──────────────────────────────────────────
-- Adds late-payment alert tracking columns to client_invoices
-- Enables efficient overdue queries and alert deduplication

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS late_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE SET NULL;

-- Index for fast overdue invoice lookups (status pending/overdue, due_date in past)
CREATE INDEX IF NOT EXISTS idx_client_invoices_due_date
  ON public.client_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_client_invoices_retainer_subscription_id
  ON public.client_invoices(retainer_subscription_id);

-- Auto-mark invoices as overdue via a function (called on demand or via cron)
CREATE OR REPLACE FUNCTION public.refresh_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.client_invoices
  SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
