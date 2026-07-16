-- ─── Matter Time Logger: Staff Assignment ────────────────────────────────────
-- Adds assigned_to column to retainer_time_logs for team member attribution
-- Enables per-staff utilization, hours logged, and revenue contribution per matter

ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Index for fast per-staff queries
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_assigned_to
  ON public.retainer_time_logs(assigned_to);

-- Composite index for matter + staff queries
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_inquiry_assigned
  ON public.retainer_time_logs(inquiry_id, assigned_to);

-- Backfill: copy logged_by into assigned_to where assigned_to is null
UPDATE public.retainer_time_logs
SET assigned_to = logged_by
WHERE assigned_to IS NULL AND logged_by IS NOT NULL;
