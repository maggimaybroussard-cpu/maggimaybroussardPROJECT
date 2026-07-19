-- Referral tracking table
CREATE TABLE IF NOT EXISTS public.referral_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by_client_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  referred_by_name TEXT,
  new_client_name TEXT NOT NULL,
  new_client_email TEXT NOT NULL,
  source_note TEXT,
  booking_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted', 'lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_tracking' AND policyname = 'admin_all_referral_tracking') THEN
    CREATE POLICY admin_all_referral_tracking ON public.referral_tracking
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Invoice reminder logs table (tracks which tier reminders have been sent)
CREATE TABLE IF NOT EXISTS public.invoice_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  client_name TEXT,
  client_email TEXT,
  tier_days INTEGER NOT NULL CHECK (tier_days IN (7, 14, 30)),
  days_overdue INTEGER,
  amount NUMERIC(10,2),
  channel TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_reminder_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_reminder_logs' AND policyname = 'admin_all_invoice_reminder_logs') THEN
    CREATE POLICY admin_all_invoice_reminder_logs ON public.invoice_reminder_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Notification events log
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  client_id UUID,
  client_email TEXT,
  message TEXT,
  channel TEXT NOT NULL DEFAULT 'push',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_events' AND policyname = 'admin_all_notification_events') THEN
    CREATE POLICY admin_all_notification_events ON public.notification_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
