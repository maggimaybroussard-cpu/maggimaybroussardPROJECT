-- Retainer invoice schedules: auto-generate invoices on a schedule with admin approval
CREATE TABLE IF NOT EXISTS public.retainer_invoice_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,

  -- Schedule config
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'custom')),
  custom_interval_days INTEGER, -- used when frequency = 'custom'
  billing_type TEXT NOT NULL DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'hourly')),
  fixed_amount DECIMAL(10,2),   -- used when billing_type = 'fixed'
  hourly_rate DECIMAL(10,2),    -- used when billing_type = 'hourly'
  description TEXT,

  -- Scheduling state
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retainer_invoice_schedules_sub_id
  ON public.retainer_invoice_schedules(retainer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_retainer_invoice_schedules_next_run
  ON public.retainer_invoice_schedules(next_run_at) WHERE is_active = true;

-- Pending (draft) invoices awaiting admin approval before sending
CREATE TABLE IF NOT EXISTS public.retainer_invoice_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.retainer_invoice_schedules(id) ON DELETE CASCADE,
  retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,

  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  billing_type TEXT NOT NULL DEFAULT 'fixed',
  hours_billed DECIMAL(8,2),
  hourly_rate DECIMAL(10,2),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,

  -- Approval workflow
  approval_status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'sent')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  sent_at TIMESTAMPTZ,

  -- Link to actual invoice once approved+sent
  client_invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retainer_invoice_drafts_schedule_id
  ON public.retainer_invoice_drafts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_retainer_invoice_drafts_approval_status
  ON public.retainer_invoice_drafts(approval_status);
CREATE INDEX IF NOT EXISTS idx_retainer_invoice_drafts_inquiry_id
  ON public.retainer_invoice_drafts(inquiry_id);

-- RLS
ALTER TABLE public.retainer_invoice_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainer_invoice_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_schedules" ON public.retainer_invoice_schedules;
CREATE POLICY "admin_all_schedules"
  ON public.retainer_invoice_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_drafts" ON public.retainer_invoice_drafts;
CREATE POLICY "admin_all_drafts"
  ON public.retainer_invoice_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_retainer_invoice_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_retainer_invoice_schedules_updated_at ON public.retainer_invoice_schedules;
CREATE TRIGGER trg_retainer_invoice_schedules_updated_at
  BEFORE UPDATE ON public.retainer_invoice_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_retainer_invoice_schedules_updated_at();

CREATE OR REPLACE FUNCTION public.update_retainer_invoice_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_retainer_invoice_drafts_updated_at ON public.retainer_invoice_drafts;
CREATE TRIGGER trg_retainer_invoice_drafts_updated_at
  BEFORE UPDATE ON public.retainer_invoice_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_retainer_invoice_drafts_updated_at();
