-- Payments table for consultation deposits and retainer agreements
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_charge_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_type TEXT NOT NULL,
  description TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON public.payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_email ON public.payments(customer_email);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own payments
DROP POLICY IF EXISTS "users_view_own_payments" ON public.payments;
CREATE POLICY "users_view_own_payments"
ON public.payments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can insert (edge functions use service role)
DROP POLICY IF EXISTS "service_insert_payments" ON public.payments;
CREATE POLICY "service_insert_payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role can update (edge functions use service role)
DROP POLICY IF EXISTS "service_update_payments" ON public.payments;
CREATE POLICY "service_update_payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow anon inserts for guest checkout (edge function handles this via service role)
DROP POLICY IF EXISTS "anon_insert_payments" ON public.payments;
CREATE POLICY "anon_insert_payments"
ON public.payments
FOR INSERT
TO anon
WITH CHECK (true);
