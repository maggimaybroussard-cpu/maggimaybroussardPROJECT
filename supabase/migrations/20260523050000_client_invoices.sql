-- Client invoices table: formal invoices issued by Maggi May Broussard, linked to cases
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

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- Clients can view their own invoices (by user_id)
DROP POLICY IF EXISTS "clients_view_own_invoices" ON public.client_invoices;
CREATE POLICY "clients_view_own_invoices"
ON public.client_invoices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Clients can also view invoices linked to their inquiry via portal access
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

-- Service role (admin/edge functions) can insert invoices
DROP POLICY IF EXISTS "service_insert_invoices" ON public.client_invoices;
CREATE POLICY "service_insert_invoices"
ON public.client_invoices
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role can update invoices
DROP POLICY IF EXISTS "service_update_invoices" ON public.client_invoices;
CREATE POLICY "service_update_invoices"
ON public.client_invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Auto-update updated_at on row change
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
