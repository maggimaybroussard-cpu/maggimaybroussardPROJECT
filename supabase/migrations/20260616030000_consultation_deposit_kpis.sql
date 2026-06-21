-- ─── Consultation Deposit KPI Tracking ───────────────────────────────────────
-- Tracks deposits collected from the booking form for KPI reporting

CREATE TABLE IF NOT EXISTS public.consultation_deposit_kpis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL DEFAULT 15000,
  currency              TEXT NOT NULL DEFAULT 'usd',
  client_name           TEXT NOT NULL,
  client_email          TEXT NOT NULL,
  booking_id            UUID REFERENCES public.consultation_bookings(id) ON DELETE SET NULL,
  inquiry_id            UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  invoice_id            UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  source                TEXT NOT NULL DEFAULT 'booking_form'
                          CHECK (source IN ('booking_form', 'payment_modal', 'admin')),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_kpis_status      ON public.consultation_deposit_kpis(status);
CREATE INDEX IF NOT EXISTS idx_deposit_kpis_client_email ON public.consultation_deposit_kpis(client_email);
CREATE INDEX IF NOT EXISTS idx_deposit_kpis_created_at  ON public.consultation_deposit_kpis(created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_kpis_source      ON public.consultation_deposit_kpis(source);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_deposit_kpis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposit_kpis_updated_at ON public.consultation_deposit_kpis;
CREATE TRIGGER trg_deposit_kpis_updated_at
  BEFORE UPDATE ON public.consultation_deposit_kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_deposit_kpis_updated_at();

-- RLS
ALTER TABLE public.consultation_deposit_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_deposit_kpis" ON public.consultation_deposit_kpis;
CREATE POLICY "service_role_full_access_deposit_kpis"
  ON public.consultation_deposit_kpis
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_deposit_kpis" ON public.consultation_deposit_kpis;
CREATE POLICY "anon_insert_deposit_kpis"
  ON public.consultation_deposit_kpis
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_insert_deposit_kpis" ON public.consultation_deposit_kpis;
CREATE POLICY "authenticated_insert_deposit_kpis"
  ON public.consultation_deposit_kpis
  FOR INSERT TO authenticated
  WITH CHECK (true);
