-- Migration: overdue_invoice_alerts
-- Tracks invoices flagged as overdue (>30 days unpaid) and reminder email sends

CREATE TABLE IF NOT EXISTS public.overdue_invoice_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.client_invoices(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  invoice_number TEXT,
  amount_due NUMERIC DEFAULT 0,
  due_date DATE,
  days_overdue INTEGER DEFAULT 0,
  reminder_sent_at TIMESTAMPTZ,
  reminder_email_id TEXT,
  reminder_status TEXT DEFAULT 'pending',
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overdue_invoice_alerts_invoice_id ON public.overdue_invoice_alerts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_overdue_invoice_alerts_dismissed ON public.overdue_invoice_alerts(dismissed);
CREATE INDEX IF NOT EXISTS idx_overdue_invoice_alerts_created_at ON public.overdue_invoice_alerts(created_at DESC);

-- Unique constraint: one active alert per invoice (not dismissed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_overdue_invoice_alerts_unique_active
  ON public.overdue_invoice_alerts(invoice_id)
  WHERE dismissed = false;

ALTER TABLE public.overdue_invoice_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_overdue_invoice_alerts" ON public.overdue_invoice_alerts;
CREATE POLICY "admin_manage_overdue_invoice_alerts"
  ON public.overdue_invoice_alerts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
