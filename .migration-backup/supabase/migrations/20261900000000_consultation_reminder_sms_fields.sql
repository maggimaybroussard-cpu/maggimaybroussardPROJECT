-- Migration: add SMS fields to consultation_reminder_logs
-- Adds recipient_phone, sms_sent, and sms_sid columns for Twilio SMS tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultation_reminder_logs'
      AND column_name = 'recipient_phone'
  ) THEN
    ALTER TABLE public.consultation_reminder_logs
      ADD COLUMN recipient_phone TEXT,
      ADD COLUMN sms_sent BOOLEAN DEFAULT false,
      ADD COLUMN sms_sid TEXT;
  END IF;
END $$;
