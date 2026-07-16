-- ─── Retainer Subscriptions ──────────────────────────────────────────────────
-- Tracks Stripe recurring retainer subscriptions, renewal status, and email history

CREATE TABLE IF NOT EXISTS public.retainer_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name             TEXT NOT NULL,
  customer_email            TEXT NOT NULL,
  stripe_customer_id        TEXT NOT NULL,
  stripe_subscription_id    TEXT NOT NULL UNIQUE,
  stripe_price_id           TEXT,
  plan_name                 TEXT NOT NULL DEFAULT 'Monthly Retainer',
  amount                    NUMERIC NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'usd',
  billing_interval          TEXT NOT NULL DEFAULT 'month',
  status                    TEXT NOT NULL DEFAULT 'active',
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT false,
  canceled_at               TIMESTAMPTZ,
  renewal_email_sent_at     TIMESTAMPTZ,
  renewal_email_status      TEXT DEFAULT 'pending',
  inquiry_id                UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  user_id                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata                  JSONB DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retainer_subscriptions_email
  ON public.retainer_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_retainer_subscriptions_status
  ON public.retainer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_retainer_subscriptions_stripe_sub_id
  ON public.retainer_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_retainer_subscriptions_period_end
  ON public.retainer_subscriptions(current_period_end);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_retainer_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retainer_subscriptions_updated_at ON public.retainer_subscriptions;
CREATE TRIGGER trg_retainer_subscriptions_updated_at
  BEFORE UPDATE ON public.retainer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_retainer_subscriptions_updated_at();

-- RLS
ALTER TABLE public.retainer_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin (service role) can do everything — edge functions use service role key
DROP POLICY IF EXISTS "service_role_all_retainer_subscriptions" ON public.retainer_subscriptions;
CREATE POLICY "service_role_all_retainer_subscriptions"
  ON public.retainer_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own subscriptions
DROP POLICY IF EXISTS "users_read_own_retainer_subscriptions" ON public.retainer_subscriptions;
CREATE POLICY "users_read_own_retainer_subscriptions"
  ON public.retainer_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Anon can insert (guest checkout creates subscription)
DROP POLICY IF EXISTS "anon_insert_retainer_subscriptions" ON public.retainer_subscriptions;
CREATE POLICY "anon_insert_retainer_subscriptions"
  ON public.retainer_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
