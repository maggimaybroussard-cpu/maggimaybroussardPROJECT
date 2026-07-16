-- ─── Consultation Alert Notifications ────────────────────────────────────────
-- Adds 'consultation' to notification_type_enum and tracks alert timestamps
-- on consultation_bookings.

-- Add 'consultation' value to existing notification_type_enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'consultation'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'notification_type_enum'
      )
  ) THEN
    ALTER TYPE public.notification_type_enum ADD VALUE 'consultation';
  END IF;
END $$;

-- Track when consultation alert emails were last sent per alert type
ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS confirmed_alert_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_alert_sent_at  TIMESTAMPTZ;

-- Also track on contact_inquiries (Calendly-based consultations)
ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS confirmed_alert_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_alert_sent_at  TIMESTAMPTZ;
