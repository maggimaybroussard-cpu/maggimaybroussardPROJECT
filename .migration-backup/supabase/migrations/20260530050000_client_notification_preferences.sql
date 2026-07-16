-- Client Notification Preferences
-- Stores per-type notification settings for each client portal user

DROP TYPE IF EXISTS public.notification_frequency CASCADE;
CREATE TYPE public.notification_frequency AS ENUM (
  'immediate',
  'daily_digest',
  'weekly_digest',
  'off'
);

CREATE TABLE IF NOT EXISTS public.client_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency public.notification_frequency NOT NULL DEFAULT 'immediate',
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_sms BOOLEAN NOT NULL DEFAULT false,
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_client_notif_prefs_user_id
  ON public.client_notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_client_notif_prefs_type
  ON public.client_notification_preferences(notification_type);

-- Enable RLS
ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_notification_prefs" ON public.client_notification_preferences;
CREATE POLICY "clients_manage_own_notification_prefs"
ON public.client_notification_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_notification_prefs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON public.client_notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON public.client_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_prefs_updated_at();
