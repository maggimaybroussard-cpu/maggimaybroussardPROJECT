-- ─── Time Logs: Engagement & Case Linkage ───────────────────────────────────
-- Adds engagement_id and work_type to retainer_time_logs
-- Enables per-engagement and per-case hour consumption tracking

-- 1. Add engagement_id column
ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL;

-- 2. Add work_type column (structured, separate from description prefix)
ALTER TABLE public.retainer_time_logs
  ADD COLUMN IF NOT EXISTS work_type TEXT;

-- 3. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_engagement_id
  ON public.retainer_time_logs(engagement_id);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_work_type
  ON public.retainer_time_logs(work_type);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_work_date
  ON public.retainer_time_logs(work_date);

-- 4. RLS: allow clients to read their own case time logs via portal access
DROP POLICY IF EXISTS "clients_read_own_case_time_logs" ON public.retainer_time_logs;
CREATE POLICY "clients_read_own_case_time_logs"
  ON public.retainer_time_logs
  FOR SELECT
  TO authenticated
  USING (
    inquiry_id IN (
      SELECT ci.id
      FROM public.contact_inquiries ci
      JOIN public.client_portal_access cpa ON cpa.inquiry_id = ci.id
      WHERE cpa.user_id = auth.uid()
    )
  );
