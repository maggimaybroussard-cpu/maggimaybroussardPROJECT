-- Portal Engagement Events
-- Tracks client portal login patterns, form submissions, document uploads, and invoice downloads

CREATE TABLE IF NOT EXISTS public.portal_engagement_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  event_data    jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_portal_engagement_events_created_at
  ON public.portal_engagement_events (created_at DESC);

-- Index for per-user queries
CREATE INDEX IF NOT EXISTS idx_portal_engagement_events_user_id
  ON public.portal_engagement_events (user_id);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_portal_engagement_events_event_type
  ON public.portal_engagement_events (event_type);

-- RLS
ALTER TABLE public.portal_engagement_events ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own events
CREATE POLICY "portal_engagement_events_insert_own"
  ON public.portal_engagement_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Clients can read their own events
CREATE POLICY "portal_engagement_events_select_own"
  ON public.portal_engagement_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (admin) can read all events
CREATE POLICY "portal_engagement_events_admin_select"
  ON public.portal_engagement_events
  FOR SELECT
  TO service_role
  USING (true);
