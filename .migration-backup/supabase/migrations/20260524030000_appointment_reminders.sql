-- Appointment reminder sequences for booked consultations
-- Tracks 24-hour and 1-hour reminder emails to reduce no-shows

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  event_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  meeting_location TEXT,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24hr', '1hr')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the cron dispatcher to quickly find pending reminders
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_pending
  ON public.appointment_reminders(scheduled_at, send_status)
  WHERE send_status = 'pending';

-- Index for cancellation: skip reminders by inquiry_id
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_inquiry_id
  ON public.appointment_reminders(inquiry_id);

-- RLS: service role only (edge functions use service role key)
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to appointment_reminders"
  ON public.appointment_reminders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
