-- Fix: Add payment_reminder to email_sequence_type enum and create client_invoices table
-- This migration supersedes 20260523060000 and 20260523050000 which may not have applied

-- ─── Step 1: Add payment_reminder enum value safely ──────────────────────────
-- ALTER TYPE ADD VALUE must run outside a transaction to commit before use.
-- We use a DO block with a check to avoid errors if already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'payment_reminder'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'payment_reminder';
  END IF;
END $$;

-- ─── Step 2: Create client_invoices table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_invoices_user_id ON public.client_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_inquiry_id ON public.client_invoices(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_status ON public.client_invoices(status);
CREATE INDEX IF NOT EXISTS idx_client_invoices_due_date_status ON public.client_invoices(due_date, status);

-- ─── Step 3: Enable RLS ───────────────────────────────────────────────────────
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- ─── Step 4: RLS Policies ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clients_view_own_invoices" ON public.client_invoices;
CREATE POLICY "clients_view_own_invoices"
ON public.client_invoices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_view_inquiry_invoices" ON public.client_invoices;
CREATE POLICY "clients_view_inquiry_invoices"
ON public.client_invoices
FOR SELECT
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "service_insert_invoices" ON public.client_invoices;
CREATE POLICY "service_insert_invoices"
ON public.client_invoices
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_invoices" ON public.client_invoices;
CREATE POLICY "service_update_invoices"
ON public.client_invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── Step 5: Auto-update updated_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_client_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_invoices_updated_at ON public.client_invoices;
CREATE TRIGGER trg_client_invoices_updated_at
  BEFORE UPDATE ON public.client_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_client_invoices_updated_at();

-- ─── Step 6: Index for payment reminder deduplication ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_sequences_payment_reminder
  ON public.email_sequences (inquiry_id, sequence_type, created_at);

-- ─── Step 7: RPC helper for inserting payment_reminder sequence rows ──────────
-- This function uses dynamic SQL to cast the enum at runtime, avoiding the
-- "new enum values must be committed before use" error in the same transaction.
CREATE OR REPLACE FUNCTION public.insert_payment_reminder_sequence(
  p_inquiry_id UUID,
  p_scheduled_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  EXECUTE format(
    'INSERT INTO public.email_sequences (inquiry_id, sequence_type, step_number, scheduled_at, send_status)
     VALUES ($1, %L::public.email_sequence_type, 1, $2, %L::public.email_send_status)
     RETURNING id',
    'payment_reminder',
    'pending'
  )
  INTO v_id
  USING p_inquiry_id, p_scheduled_at;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'insert_payment_reminder_sequence failed: %', SQLERRM;
    RETURN NULL;
END;
$$;
