-- ─── Retainer Time Logs ──────────────────────────────────────────────────────
-- Tracks hours logged against a retainer subscription for depletion monitoring

CREATE TABLE IF NOT EXISTS public.retainer_time_logs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retainer_subscription_id  UUID NOT NULL REFERENCES public.retainer_subscriptions(id) ON DELETE CASCADE,
  user_id                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inquiry_id                UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  hours                     NUMERIC(6, 2) NOT NULL CHECK (hours > 0),
  description               TEXT,
  work_date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at                 TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  logged_by                 TEXT,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_subscription_id
  ON public.retainer_time_logs(retainer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_logged_at
  ON public.retainer_time_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_retainer_time_logs_user_id
  ON public.retainer_time_logs(user_id);

ALTER TABLE public.retainer_time_logs ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions / admin) can do everything
DROP POLICY IF EXISTS "service_role_all_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "service_role_all_retainer_time_logs"
  ON public.retainer_time_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own time logs
DROP POLICY IF EXISTS "users_read_own_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "users_read_own_retainer_time_logs"
  ON public.retainer_time_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users (admin) can insert time logs
DROP POLICY IF EXISTS "authenticated_insert_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "authenticated_insert_retainer_time_logs"
  ON public.retainer_time_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
