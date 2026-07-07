-- SMS Triggers Schema
-- Adds phone storage to appointment_reminders, expands sms_reminder_logs message_type,
-- and adds abandoned_booking_sms_logs table for tracking nudge sends.

-- 1. Add recipient_phone to appointment_reminders so SMS can fire at send time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointment_reminders'
      AND column_name = 'recipient_phone'
  ) THEN
    ALTER TABLE public.appointment_reminders
      ADD COLUMN recipient_phone TEXT,
      ADD COLUMN sms_sent BOOLEAN DEFAULT false,
      ADD COLUMN sms_sid TEXT;
  END IF;
END $$;

-- 2. Expand sms_reminder_logs to accept new message types
-- Drop old constraint and add a broader one
DO $$
BEGIN
  -- Drop old check constraint if it exists (name may vary)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sms_reminder_logs'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.sms_reminder_logs
      DROP CONSTRAINT IF EXISTS sms_reminder_logs_message_type_check;
  END IF;

  -- Add broader constraint
  ALTER TABLE public.sms_reminder_logs
    ADD CONSTRAINT sms_reminder_logs_message_type_check
    CHECK (message_type IN (
      'deadline',
      'overdue_payment',
      'appointment_reminder',
      'lead_response',
      'abandoned_booking'
    ));
END $$;

-- 3. Add optional reference columns to sms_reminder_logs for traceability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sms_reminder_logs'
      AND column_name = 'inquiry_id'
  ) THEN
    ALTER TABLE public.sms_reminder_logs
      ADD COLUMN inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
      ADD COLUMN trigger_type TEXT; -- 'calendly_booking' | 'contact_form' | 'abandoned_booking'
  END IF;
END $$;

-- Index for inquiry lookups
CREATE INDEX IF NOT EXISTS idx_sms_reminder_logs_inquiry_id
  ON public.sms_reminder_logs (inquiry_id);
