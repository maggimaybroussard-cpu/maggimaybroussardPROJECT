-- Enable real-time for contact_inquiries and notifications tables
-- Adds a DB trigger to auto-create a notification when booking_stage changes
-- and enables Supabase Realtime publication for both tables.

-- ── 1. Enable Realtime for contact_inquiries ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_inquiries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_inquiries;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add contact_inquiries to supabase_realtime: %', SQLERRM;
END $$;

-- ── 2. Enable Realtime for notifications ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add notifications to supabase_realtime: %', SQLERRM;
END $$;

-- ── 3. Enable Realtime for case_timeline ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'case_timeline'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_timeline;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add case_timeline to supabase_realtime: %', SQLERRM;
END $$;

-- ── 4. Trigger function: auto-create notification on booking_stage change ─────
CREATE OR REPLACE FUNCTION public.notify_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_stage_label TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Only fire when booking_stage actually changes
  IF (OLD.booking_stage IS NOT DISTINCT FROM NEW.booking_stage) THEN
    RETURN NEW;
  END IF;

  -- Human-readable stage label
  v_stage_label := CASE COALESCE(NEW.booking_stage, '')
    WHEN 'inquiry'       THEN 'Inquiry'
    WHEN 'intake'        THEN 'Intake'
    WHEN 'consultation'  THEN 'Consultation'
    WHEN 'proposal_sent' THEN 'Proposal Sent'
    WHEN 'active_client' THEN 'Active'
    WHEN 'active'        THEN 'Active'
    WHEN 'billed'        THEN 'Billed'
    WHEN 'closed'        THEN 'Closed'
    ELSE COALESCE(NEW.booking_stage, 'Updated')
  END;

  v_title := 'Case Status Updated: ' || v_stage_label;
  v_body  := 'Your case has moved to the ' || v_stage_label || ' stage.';

  -- Insert admin notification
  INSERT INTO public.notifications (
    audience,
    inquiry_id,
    notification_type,
    title,
    body,
    is_read,
    metadata
  ) VALUES (
    'admin',
    NEW.id,
    'case_update',
    v_title,
    'Case for ' || COALESCE(NEW.name, 'client') || ' moved to ' || v_stage_label || ' stage.',
    false,
    jsonb_build_object(
      'previous_stage', OLD.booking_stage,
      'new_stage', NEW.booking_stage,
      'client_name', NEW.name,
      'client_email', NEW.email
    )
  );

  -- Insert client notification (will be visible in portal)
  INSERT INTO public.notifications (
    audience,
    inquiry_id,
    notification_type,
    title,
    body,
    is_read,
    metadata
  ) VALUES (
    'client',
    NEW.id,
    'case_update',
    v_title,
    v_body,
    false,
    jsonb_build_object(
      'previous_stage', OLD.booking_stage,
      'new_stage', NEW.booking_stage
    )
  );

  -- Also insert a case_timeline event for the stage change
  INSERT INTO public.case_timeline (
    inquiry_id,
    event_title,
    event_description,
    event_date
  ) VALUES (
    NEW.id,
    'Stage Updated: ' || v_stage_label,
    'Case moved from ' || COALESCE(OLD.booking_stage, 'initial') || ' to ' || COALESCE(NEW.booking_stage, 'updated') || ' stage.',
    now()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'notify_on_stage_change error: %', SQLERRM;
    RETURN NEW;
END;
$func$;

-- ── 5. Attach trigger to contact_inquiries ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_stage_change ON public.contact_inquiries;
CREATE TRIGGER trg_notify_stage_change
  AFTER UPDATE OF booking_stage ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_stage_change();

-- ── 6. Index for fast notification lookups ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_inquiry_unread
  ON public.notifications (inquiry_id, is_read)
  WHERE is_read = false;
