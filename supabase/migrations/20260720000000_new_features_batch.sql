-- Migration: New Features Batch
-- Adds tables for: referral tracking, overdue invoice sequences, conflict checker, PWA push enhancements

-- ── 1. Referral tracking enhancements ─────────────────────────────────────────
ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_name TEXT;

-- Referral log table
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  referrer_name TEXT,
  referrer_email TEXT,
  referred_inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  referred_name TEXT,
  referred_email TEXT,
  referral_source TEXT DEFAULT 'direct',
  booking_completed BOOLEAN DEFAULT false,
  reward_issued BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_logs_referrer ON public.referral_logs(referrer_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_referral_logs_referred ON public.referral_logs(referred_inquiry_id);

ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_referral_logs" ON public.referral_logs;
CREATE POLICY "admin_manage_referral_logs" ON public.referral_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Overdue invoice sequence tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.overdue_invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  amount_due NUMERIC(10,2),
  due_date DATE,
  days_overdue INTEGER DEFAULT 0,
  tier INTEGER DEFAULT 1, -- 1=7day, 2=14day, 3=30day
  sms_sent_7d BOOLEAN DEFAULT false,
  email_sent_7d BOOLEAN DEFAULT false,
  sms_sent_14d BOOLEAN DEFAULT false,
  email_sent_14d BOOLEAN DEFAULT false,
  sms_sent_30d BOOLEAN DEFAULT false,
  email_sent_30d BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  last_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overdue_seq_invoice ON public.overdue_invoice_sequences(invoice_id);
CREATE INDEX IF NOT EXISTS idx_overdue_seq_resolved ON public.overdue_invoice_sequences(resolved);

ALTER TABLE public.overdue_invoice_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_overdue_sequences" ON public.overdue_invoice_sequences;
CREATE POLICY "admin_manage_overdue_sequences" ON public.overdue_invoice_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Conflict of interest check log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conflict_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_name TEXT NOT NULL,
  checked_email TEXT,
  checked_firm TEXT,
  airtable_matches JSONB DEFAULT '[]'::jsonb,
  clio_matches JSONB DEFAULT '[]'::jsonb,
  supabase_matches JSONB DEFAULT '[]'::jsonb,
  conflict_found BOOLEAN DEFAULT false,
  conflict_details TEXT,
  checked_by TEXT,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_check_name ON public.conflict_check_logs(checked_name);
CREATE INDEX IF NOT EXISTS idx_conflict_check_email ON public.conflict_check_logs(checked_email);

ALTER TABLE public.conflict_check_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_conflict_checks" ON public.conflict_check_logs;
CREATE POLICY "admin_manage_conflict_checks" ON public.conflict_check_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Google Meet links on consultation bookings ─────────────────────────────
ALTER TABLE public.consultation_bookings
  ADD COLUMN IF NOT EXISTS meet_link TEXT,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
