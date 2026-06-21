-- ─── Client RLS for retainer_time_logs ──────────────────────────────────────
-- Allow portal clients to read time logs linked to their inquiry

-- Drop old user_id-only policy and replace with inquiry-based access
DROP POLICY IF EXISTS "users_read_own_retainer_time_logs" ON public.retainer_time_logs;

-- Clients can read logs where inquiry_id matches their portal access record
DROP POLICY IF EXISTS "clients_read_own_retainer_time_logs" ON public.retainer_time_logs;
CREATE POLICY "clients_read_own_retainer_time_logs"
  ON public.retainer_time_logs
  FOR SELECT
  TO authenticated
  USING (
    inquiry_id IN (
      SELECT inquiry_id
      FROM public.client_portal_access
      WHERE user_id = auth.uid()
        AND inquiry_id IS NOT NULL
    )
    OR user_id = auth.uid()
  );
