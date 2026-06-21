-- ─── Paid Receipt Logs ───────────────────────────────────────────────────────
-- Tracks every payment_intent.succeeded event processed by the webhook.
-- Provides idempotency, audit trail, and admin visibility for all paid receipts.

CREATE TABLE IF NOT EXISTS public.paid_receipt_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id TEXT NOT NULL UNIQUE,
  invoice_id      UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  invoice_number  TEXT,
  amount          DECIMAL(10, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'usd',
  customer_email  TEXT,
  customer_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'paid_in_full'
                    CHECK (status IN ('paid_in_full', 'partial', 'no_invoice_match')),
  raw_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paid_receipt_logs_invoice_id
  ON public.paid_receipt_logs(invoice_id);

CREATE INDEX IF NOT EXISTS idx_paid_receipt_logs_created_at
  ON public.paid_receipt_logs(created_at DESC);

ALTER TABLE public.paid_receipt_logs ENABLE ROW LEVEL SECURITY;

-- Only service role / admin can read receipt logs
DROP POLICY IF EXISTS "service_manage_paid_receipt_logs" ON public.paid_receipt_logs;
CREATE POLICY "service_manage_paid_receipt_logs"
ON public.paid_receipt_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);
