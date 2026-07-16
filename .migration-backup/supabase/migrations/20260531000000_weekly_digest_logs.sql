-- Weekly digest logs: track every digest email sent to clients
CREATE TABLE IF NOT EXISTS public.weekly_digest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  cases_included INTEGER NOT NULL DEFAULT 0,
  invoices_included INTEGER NOT NULL DEFAULT 0,
  updates_included INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weekly_digest_logs_sent_at ON public.weekly_digest_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digest_logs_client_email ON public.weekly_digest_logs(client_email);
CREATE INDEX IF NOT EXISTS idx_weekly_digest_logs_status ON public.weekly_digest_logs(status);

ALTER TABLE public.weekly_digest_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admin) can read digest logs
DROP POLICY IF EXISTS "authenticated_can_read_digest_logs" ON public.weekly_digest_logs;
CREATE POLICY "authenticated_can_read_digest_logs"
ON public.weekly_digest_logs
FOR SELECT
TO authenticated
USING (true);

-- Service role can insert digest logs
DROP POLICY IF EXISTS "service_insert_digest_logs" ON public.weekly_digest_logs;
CREATE POLICY "service_insert_digest_logs"
ON public.weekly_digest_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
