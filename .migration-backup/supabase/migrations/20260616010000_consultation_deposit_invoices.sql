-- ─── Consultation Deposit Invoice Support ────────────────────────────────────
-- Adds payment_type and booking_id to client_invoices for deposit/retainer tracking

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.consultation_bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_invoices_payment_type ON public.client_invoices(payment_type);
CREATE INDEX IF NOT EXISTS idx_client_invoices_booking_id ON public.client_invoices(booking_id);
