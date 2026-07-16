-- Paralegal Billable Hours Logging
-- Paralegals log task, duration, hourly rate against cases
-- Lexi auto-drafts invoices from these logs for admin approval

CREATE TABLE IF NOT EXISTS public.paralegal_billable_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Case / client references
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE SET NULL,
  -- Paralegal info
  paralegal_name TEXT NOT NULL,
  paralegal_email TEXT,
  -- Billing details
  task_description TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'other',
  duration_hours NUMERIC(6, 2) NOT NULL CHECK (duration_hours > 0),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 150.00 CHECK (hourly_rate >= 0),
  total_amount NUMERIC(10, 2) GENERATED ALWAYS AS (duration_hours * hourly_rate) STORED,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Status
  billing_status TEXT NOT NULL DEFAULT 'unbilled' CHECK (billing_status IN ('unbilled', 'draft_queued', 'invoiced', 'approved', 'rejected')),
  invoice_draft_id UUID,
  notes TEXT,
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paralegal_billable_hours_inquiry ON public.paralegal_billable_hours(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_paralegal_billable_hours_retainer ON public.paralegal_billable_hours(retainer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_paralegal_billable_hours_work_date ON public.paralegal_billable_hours(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_paralegal_billable_hours_status ON public.paralegal_billable_hours(billing_status);
CREATE INDEX IF NOT EXISTS idx_paralegal_billable_hours_paralegal ON public.paralegal_billable_hours(paralegal_email);

ALTER TABLE public.paralegal_billable_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_paralegal_billable_hours" ON public.paralegal_billable_hours;
CREATE POLICY "admin_full_access_paralegal_billable_hours"
ON public.paralegal_billable_hours
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_paralegal_billable_hours_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paralegal_billable_hours_updated_at ON public.paralegal_billable_hours;
CREATE TRIGGER trg_paralegal_billable_hours_updated_at
BEFORE UPDATE ON public.paralegal_billable_hours
FOR EACH ROW EXECUTE FUNCTION public.update_paralegal_billable_hours_updated_at();

-- Seed sample data for demo
DO $$
DECLARE
  sample_inquiry_id UUID;
BEGIN
  SELECT id INTO sample_inquiry_id FROM public.contact_inquiries LIMIT 1;

  IF sample_inquiry_id IS NOT NULL THEN
    INSERT INTO public.paralegal_billable_hours (
      inquiry_id, paralegal_name, paralegal_email, task_description, task_type,
      duration_hours, hourly_rate, work_date, billing_status
    ) VALUES
      (sample_inquiry_id, 'Sarah Mitchell', 'sarah.mitchell@broussardlegal.com',
       'Reviewed discovery documents and prepared summary memo for attorney', 'review',
       2.5, 125.00, CURRENT_DATE - 2, 'unbilled'),
      (sample_inquiry_id, 'James Okafor', 'james.okafor@broussardlegal.com',
       'Drafted motion to compel discovery responses', 'drafting',
       3.0, 125.00, CURRENT_DATE - 1, 'unbilled'),
      (sample_inquiry_id, 'Sarah Mitchell', 'sarah.mitchell@broussardlegal.com',
       'Legal research on statute of limitations for breach of contract claim', 'research',
       1.75, 125.00, CURRENT_DATE, 'unbilled')
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample data insertion skipped: %', SQLERRM;
END $$;
