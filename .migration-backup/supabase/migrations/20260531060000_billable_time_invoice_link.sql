-- ─── Billable Time Entries: Invoice Line Item Linkage ────────────────────────
-- Adds case_task and invoice linkage to retainer_time_logs
-- Allows paralegal time entries to feed directly into invoice line items

ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS case_task TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_invoice_id
  ON public.retainer_time_logs(invoice_id);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_case_task
  ON public.retainer_time_logs(case_task);

-- Allow authenticated users to update their own time log entries (for invoice linking)
DROP POLICY IF EXISTS "authenticated_update_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "authenticated_update_retainer_time_logs"
  ON public.retainer_time_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete time log entries
DROP POLICY IF EXISTS "authenticated_delete_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "authenticated_delete_retainer_time_logs"
  ON public.retainer_time_logs
  FOR DELETE
  TO authenticated
  USING (true);
