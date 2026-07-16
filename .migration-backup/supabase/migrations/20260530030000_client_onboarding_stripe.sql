-- Add Stripe tracking columns to client_onboarding for retainer fee automation

ALTER TABLE public.client_onboarding
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS retainer_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_client_onboarding_stripe_customer
  ON public.client_onboarding(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
