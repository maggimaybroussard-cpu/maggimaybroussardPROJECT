-- Migration: consultation_reminder_logs
-- Tracks scheduled and sent 24-hour reminders for consultation bookings

CREATE TABLE IF NOT EXISTS public.consultation_reminder_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID REFERENCES public.consultation_bookings(id) ON DELETE CASCADE,
  reminder_type       TEXT NOT NULL DEFAULT '24hr',
  recipient_email     TEXT NOT NULL,
  recipient_name      TEXT,
  booking_date        DATE,
  booking_time        TIME,
  duration_minutes    INTEGER DEFAULT 30,
  meeting_link        TEXT,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  send_status         TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'skipped', 'failed')),
  sent_at             TIMESTAMPTZ,
  resend_id           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add reminder tracking columns to consultation_bookings if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultation_bookings'
      AND column_name = 'reminder_24hr_sent'
  ) THEN
    ALTER TABLE public.consultation_bookings
      ADD COLUMN reminder_24hr_sent BOOLEAN DEFAULT false,
      ADD COLUMN reminder_24hr_sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for cron job: find pending reminders due to be sent
CREATE INDEX IF NOT EXISTS idx_consultation_reminder_logs_pending
  ON public.consultation_reminder_logs (scheduled_at, send_status)
  WHERE send_status = 'pending';

-- RLS
ALTER TABLE public.consultation_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on consultation_reminder_logs"
  ON public.consultation_reminder_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
