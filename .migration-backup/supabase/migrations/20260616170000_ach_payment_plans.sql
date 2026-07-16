-- ACH Bank Payments + Payment Plans
-- Adds payment_plans and payment_plan_installments tables

-- ── Payment Plans ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id           UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  invoice_id           UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  user_id              UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  customer_name        TEXT NOT NULL,
  customer_email       TEXT NOT NULL,
  stripe_customer_id   TEXT,
  total_amount         NUMERIC(10,2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'usd',
  installment_count    INTEGER NOT NULL DEFAULT 3,
  installment_amount   NUMERIC(10,2) NOT NULL,
  frequency            TEXT NOT NULL DEFAULT 'monthly', -- monthly | biweekly | weekly
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'active', -- active | completed | cancelled | paused
  next_due_date        DATE,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ── Payment Plan Installments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  installment_number   INTEGER NOT NULL,
  amount               NUMERIC(10,2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'usd',
  due_date             DATE NOT NULL,
  payment_intent_id    TEXT,
  stripe_customer_id   TEXT,
  payment_method_id    TEXT,
  payment_status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | succeeded | failed
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ── ACH Bank Payment Methods ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ach_payment_methods (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  inquiry_id           UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  stripe_customer_id   TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  bank_name            TEXT,
  last4                TEXT,
  account_type         TEXT, -- checking | savings
  status               TEXT NOT NULL DEFAULT 'active', -- active | removed
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id ON public.payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice_id ON public.payment_plans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_inquiry_id ON public.payment_plans(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON public.payment_plans(status);
CREATE INDEX IF NOT EXISTS idx_payment_plan_installments_plan_id ON public.payment_plan_installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_plan_installments_due_date ON public.payment_plan_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_ach_payment_methods_user_id ON public.ach_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_ach_payment_methods_stripe_customer ON public.ach_payment_methods(stripe_customer_id);

-- ── Add ACH columns to payments table ────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT DEFAULT 'card', -- card | ach | plan
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_id UUID REFERENCES public.payment_plan_installments(id) ON DELETE SET NULL;

-- ── Add payment plan link to client_invoices ─────────────────────────────────
ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_plan_enabled BOOLEAN DEFAULT false;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ach_payment_methods ENABLE ROW LEVEL SECURITY;

-- payment_plans: owner or admin
DROP POLICY IF EXISTS "users_view_own_payment_plans" ON public.payment_plans;
CREATE POLICY "users_view_own_payment_plans"
  ON public.payment_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_manage_payment_plans" ON public.payment_plans;
CREATE POLICY "service_role_manage_payment_plans"
  ON public.payment_plans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_payment_plans" ON public.payment_plans;
CREATE POLICY "anon_insert_payment_plans"
  ON public.payment_plans FOR INSERT TO anon
  WITH CHECK (true);

-- payment_plan_installments
DROP POLICY IF EXISTS "users_view_own_installments" ON public.payment_plan_installments;
CREATE POLICY "users_view_own_installments"
  ON public.payment_plan_installments FOR SELECT TO authenticated
  USING (
    plan_id IN (SELECT id FROM public.payment_plans WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_manage_installments" ON public.payment_plan_installments;
CREATE POLICY "service_role_manage_installments"
  ON public.payment_plan_installments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ach_payment_methods
DROP POLICY IF EXISTS "users_manage_own_ach_methods" ON public.ach_payment_methods;
CREATE POLICY "users_manage_own_ach_methods"
  ON public.ach_payment_methods FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_manage_ach_methods" ON public.ach_payment_methods;
CREATE POLICY "service_role_manage_ach_methods"
  ON public.ach_payment_methods FOR ALL TO service_role
  USING (true) WITH CHECK (true);
