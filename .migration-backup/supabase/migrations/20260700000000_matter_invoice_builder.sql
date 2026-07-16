-- ─── Matter Invoice Builder ──────────────────────────────────────────────────
-- Adds invoice_id link to retainer_time_logs for tracking which time entries
-- have been invoiced, and adds partial payment tracking to client_invoices.

-- 1. Link time logs to invoices (track which entries are billed)
ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_invoice_id
  ON public.retainer_time_logs(invoice_id)
  WHERE invoice_id IS NOT NULL;

-- 2. Add partial payment tracking to client_invoices
ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_amount DECIMAL(10,2);

-- payment_status: unpaid | partial | paid | written_off
COMMENT ON COLUMN public.client_invoices.payment_status IS 'unpaid | partial | paid | written_off';
COMMENT ON COLUMN public.client_invoices.last_payment_date IS 'Date of most recent payment received';
COMMENT ON COLUMN public.client_invoices.last_payment_amount IS 'Amount of most recent payment';

-- 3. Index for payment status filtering
CREATE INDEX IF NOT EXISTS idx_client_invoices_payment_status
  ON public.client_invoices(payment_status);

-- 4. Function to auto-update payment_status based on amount_paid vs amount
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount_paid >= NEW.amount THEN
    NEW.payment_status := 'paid';
    NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.payment_status := 'partial';
  ELSE
    NEW.payment_status := 'unpaid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_payment_status ON public.client_invoices;
CREATE TRIGGER trg_sync_invoice_payment_status
  BEFORE INSERT OR UPDATE OF amount_paid ON public.client_invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_status();

-- 5. Backfill payment_status for existing rows
UPDATE public.client_invoices
SET payment_status = CASE
  WHEN amount_paid >= amount THEN 'paid'
  WHEN amount_paid > 0 THEN 'partial'
  ELSE 'unpaid'
END
WHERE payment_status = 'unpaid';
