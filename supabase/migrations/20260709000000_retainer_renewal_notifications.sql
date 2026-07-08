-- ─── Retainer Renewal Notifications ──────────────────────────────────────────
-- Adds renewal tracking columns to retainer_subscriptions and creates
-- retainer_renewal_logs table for audit trail of all renewal notifications.

-- Add renewal tracking columns to retainer_subscriptions (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retainer_subscriptions' AND column_name = 'auto_renew_enabled') THEN
    ALTER TABLE public.retainer_subscriptions ADD COLUMN auto_renew_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retainer_subscriptions' AND column_name = 'renewal_accepted_at') THEN
    ALTER TABLE public.retainer_subscriptions ADD COLUMN renewal_accepted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retainer_subscriptions' AND column_name = 'renewal_declined_at') THEN
    ALTER TABLE public.retainer_subscriptions ADD COLUMN renewal_declined_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'retainer_subscriptions' AND column_name = 'customer_phone') THEN
    ALTER TABLE public.retainer_subscriptions ADD COLUMN customer_phone TEXT;
  END IF;
END $$;

-- ─── Retainer Renewal Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retainer_renewal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'renewal_reminder',
  channel TEXT NOT NULL DEFAULT 'email', -- 'email' | 'sms' | 'portal'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed' | 'queued' | 'accepted' | 'declined'
  days_before_expiry INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retainer_renewal_logs_subscription_id ON public.retainer_renewal_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_retainer_renewal_logs_sent_at ON public.retainer_renewal_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_retainer_renewal_logs_status ON public.retainer_renewal_logs(status);

-- RLS
ALTER TABLE public.retainer_renewal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access retainer_renewal_logs" ON public.retainer_renewal_logs;
CREATE POLICY "Admin full access retainer_renewal_logs"
  ON public.retainer_renewal_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'paralegal')
    )
  );
