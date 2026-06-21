-- Unified Notification Center
-- Stores all in-app notifications for both admin and portal users

DROP TYPE IF EXISTS public.notification_type_enum CASCADE;
CREATE TYPE public.notification_type_enum AS ENUM (
  'case_update',
  'document_change',
  'approval_request',
  'deadline_alert',
  'message',
  'invoice',
  'payment',
  'task',
  'system'
);

DROP TYPE IF EXISTS public.notification_audience_enum CASCADE;
CREATE TYPE public.notification_audience_enum AS ENUM ('admin', 'client');

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience public.notification_audience_enum NOT NULL DEFAULT 'client',
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  notification_type public.notification_type_enum NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON public.notifications(audience);
CREATE INDEX IF NOT EXISTS idx_notifications_inquiry_id ON public.notifications(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_archived ON public.notifications(is_archived);
CREATE INDEX IF NOT EXISTS idx_notifications_is_dismissed ON public.notifications(is_dismissed);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admin can see all admin-audience notifications
DROP POLICY IF EXISTS "admin_manage_notifications" ON public.notifications;
CREATE POLICY "admin_manage_notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (
    audience = 'admin'::public.notification_audience_enum
    AND (
      SELECT raw_app_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'role' = 'admin'
      FROM auth.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    audience = 'admin'::public.notification_audience_enum
    AND (
      SELECT raw_app_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'role' = 'admin'
      FROM auth.users WHERE id = auth.uid()
    )
  );

-- Clients can see their own client-audience notifications
DROP POLICY IF EXISTS "clients_manage_own_notifications" ON public.notifications;
CREATE POLICY "clients_manage_own_notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (
    audience = 'client'::public.notification_audience_enum
    AND user_id = auth.uid()
  )
  WITH CHECK (
    audience = 'client'::public.notification_audience_enum
    AND user_id = auth.uid()
  );
