-- IOLTA Trust Account Tracker
-- Dedicated ledger and reconciliation view for client trust funds

CREATE TABLE IF NOT EXISTS public.iolta_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL DEFAULT 'IOLTA Trust Account',
  bank_name TEXT,
  account_number_last4 TEXT,
  routing_number_last4 TEXT,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TYPE IF EXISTS public.iolta_transaction_type CASCADE;
CREATE TYPE public.iolta_transaction_type AS ENUM (
  'deposit', 'disbursement', 'transfer', 'fee_earned', 'adjustment'
);

CREATE TABLE IF NOT EXISTS public.iolta_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.iolta_accounts(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  transaction_type public.iolta_transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  reference_number TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cleared BOOLEAN NOT NULL DEFAULT false,
  cleared_date DATE,
  running_balance NUMERIC(12,2),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.iolta_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.iolta_accounts(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  statement_balance NUMERIC(12,2) NOT NULL,
  book_balance NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) GENERATED ALWAYS AS (statement_balance - book_balance) STORED,
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  reconciled_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iolta_transactions_account_id ON public.iolta_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_iolta_transactions_inquiry_id ON public.iolta_transactions(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_iolta_transactions_date ON public.iolta_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_iolta_reconciliations_account_id ON public.iolta_reconciliations(account_id);

ALTER TABLE public.iolta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iolta_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iolta_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user_iolta()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
  AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin')
)
$$;

DROP POLICY IF EXISTS "admin_manage_iolta_accounts" ON public.iolta_accounts;
CREATE POLICY "admin_manage_iolta_accounts" ON public.iolta_accounts
FOR ALL TO authenticated
USING (public.is_admin_user_iolta())
WITH CHECK (public.is_admin_user_iolta());

DROP POLICY IF EXISTS "admin_manage_iolta_transactions" ON public.iolta_transactions;
CREATE POLICY "admin_manage_iolta_transactions" ON public.iolta_transactions
FOR ALL TO authenticated
USING (public.is_admin_user_iolta())
WITH CHECK (public.is_admin_user_iolta());

DROP POLICY IF EXISTS "admin_manage_iolta_reconciliations" ON public.iolta_reconciliations;
CREATE POLICY "admin_manage_iolta_reconciliations" ON public.iolta_reconciliations
FOR ALL TO authenticated
USING (public.is_admin_user_iolta())
WITH CHECK (public.is_admin_user_iolta());

-- Seed default IOLTA account
DO $$
DECLARE
  acct_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.iolta_accounts (id, account_name, bank_name, current_balance)
  VALUES (acct_id, 'Broussard Legal IOLTA Trust', 'First Bank', 0)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'IOLTA seed skipped: %', SQLERRM;
END $$;
