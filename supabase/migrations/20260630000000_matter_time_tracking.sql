-- ─── Matter Time Tracking: Billable / Write-Off Hours ────────────────────────
-- Adds billable flag and task_category to retainer_time_logs
-- Enables per-matter profitability calculations with billable vs write-off split

ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_category TEXT NOT NULL DEFAULT 'other';

-- Index for fast billable/write-off queries per matter
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_billable
  ON public.retainer_time_logs(inquiry_id, billable);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_task_category
  ON public.retainer_time_logs(task_category);

-- Seed sample time entries for demo (only if contact_inquiries has rows)
DO $$
DECLARE
  sample_inquiry_id UUID;
BEGIN
  SELECT id INTO sample_inquiry_id FROM public.contact_inquiries LIMIT 1;

  IF sample_inquiry_id IS NOT NULL THEN
    -- Billable entries
    INSERT INTO public.retainer_time_logs (
      id, inquiry_id, hours, description, work_date, logged_by,
      billable, task_category, hourly_rate
    ) VALUES
      (gen_random_uuid(), sample_inquiry_id, 2.5,
       'Drafted motion to compel and reviewed opposing counsel response',
       CURRENT_DATE - 5, 'Admin', true, 'drafting', 250.00),
      (gen_random_uuid(), sample_inquiry_id, 1.0,
       'Client call — case strategy discussion',
       CURRENT_DATE - 4, 'Admin', true, 'client_communication', 250.00),
      (gen_random_uuid(), sample_inquiry_id, 3.0,
       'Legal research on statute of limitations',
       CURRENT_DATE - 3, 'Admin', true, 'research', 250.00),
      -- Write-off entries
      (gen_random_uuid(), sample_inquiry_id, 0.5,
       'Internal file review — administrative overhead',
       CURRENT_DATE - 2, 'Admin', false, 'administrative', 250.00),
      (gen_random_uuid(), sample_inquiry_id, 1.0,
       'Duplicate work — superseded by revised filing',
       CURRENT_DATE - 1, 'Admin', false, 'other', 250.00)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample time log data skipped: %', SQLERRM;
END $$;
