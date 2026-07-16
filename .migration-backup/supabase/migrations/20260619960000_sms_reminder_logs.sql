-- SMS Reminder Logs
-- Tracks all Twilio SMS reminders sent for matter deadlines and overdue payments

CREATE TABLE IF NOT EXISTS public.sms_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('client', 'staff')),
  message_type TEXT NOT NULL CHECK (message_type IN ('deadline', 'overdue_payment')),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sms_reminder_logs_sent_at ON public.sms_reminder_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_reminder_logs_status ON public.sms_reminder_logs (status);
CREATE INDEX IF NOT EXISTS idx_sms_reminder_logs_message_type ON public.sms_reminder_logs (message_type);

-- RLS
ALTER TABLE public.sms_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to sms_reminder_logs"
  ON public.sms_reminder_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'paralegal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'paralegal')
    )
  );
