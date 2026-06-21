-- Invoice reminders table: tracks scheduled and sent automated reminders for client invoices
CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.client_invoices(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('before_due', 'after_due')),
  trigger_days INTEGER NOT NULL, -- 7 = 7 days before due, 3 = 3 days after due
  scheduled_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'skipped')),
  resend_email_id TEXT,
  error_message TEXT,
  portal_alert_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id ON public.invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_inquiry_id ON public.invoice_reminders(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_scheduled_date ON public.invoice_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_send_status ON public.invoice_reminders(send_status);

-- Unique index: one reminder per invoice per type (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_reminders_unique_type
  ON public.invoice_reminders(invoice_id, reminder_type);

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

-- Admin (service role) full access
DROP POLICY IF EXISTS "service_manage_invoice_reminders" ON public.invoice_reminders;
CREATE POLICY "service_manage_invoice_reminders"
ON public.invoice_reminders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Clients can view their own reminders via portal access
DROP POLICY IF EXISTS "clients_view_own_invoice_reminders" ON public.invoice_reminders;
CREATE POLICY "clients_view_own_invoice_reminders"
ON public.invoice_reminders
FOR SELECT
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access WHERE user_id = auth.uid()
  )
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_invoice_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_reminders_updated_at ON public.invoice_reminders;
CREATE TRIGGER trg_invoice_reminders_updated_at
  BEFORE UPDATE ON public.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_reminders_updated_at();
