-- Monthly Business Report Schedule and Referral Portal Tables

-- Monthly report logs
CREATE TABLE IF NOT EXISTS public.monthly_business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_reports_month ON public.monthly_business_reports(report_month);

-- Referral portal claims
CREATE TABLE IF NOT EXISTS public.referral_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_close_id UUID REFERENCES public.case_close_requests(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT,
  referred_by_name TEXT,
  referred_by_email TEXT,
  service_interest TEXT,
  message TEXT,
  claim_status TEXT NOT NULL DEFAULT 'pending',
  incentive_type TEXT DEFAULT 'credit',
  incentive_amount NUMERIC(10,2) DEFAULT 50,
  incentive_desc TEXT DEFAULT '$50 credit toward future services',
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_claims_code ON public.referral_claims(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_claims_email ON public.referral_claims(claimant_email);
CREATE INDEX IF NOT EXISTS idx_referral_claims_status ON public.referral_claims(claim_status);

-- Conflict of interest check logs
CREATE TABLE IF NOT EXISTS public.conflict_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_name TEXT NOT NULL,
  checked_email TEXT,
  checked_entity TEXT,
  opposing_party TEXT,
  service_type TEXT,
  conflicts_found JSONB DEFAULT '[]',
  conflict_count INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'none',
  checked_by TEXT DEFAULT 'Lexi',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_checks_name ON public.conflict_checks(checked_name);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_email ON public.conflict_checks(checked_email);

-- Lexi invoice drafts (queued for admin approval)
CREATE TABLE IF NOT EXISTS public.lexi_invoice_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  retainer_subscription_id UUID REFERENCES public.retainer_subscriptions(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  time_log_ids UUID[] DEFAULT '{}',
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 150,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  draft_status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexi_invoice_drafts_status ON public.lexi_invoice_drafts(draft_status);
CREATE INDEX IF NOT EXISTS idx_lexi_invoice_drafts_inquiry ON public.lexi_invoice_drafts(inquiry_id);

ALTER TABLE public.monthly_business_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexi_invoice_drafts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user_new_features()
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

DROP POLICY IF EXISTS "admin_manage_monthly_reports" ON public.monthly_business_reports;
CREATE POLICY "admin_manage_monthly_reports" ON public.monthly_business_reports
FOR ALL TO authenticated
USING (public.is_admin_user_new_features())
WITH CHECK (public.is_admin_user_new_features());

DROP POLICY IF EXISTS "public_insert_referral_claims" ON public.referral_claims;
CREATE POLICY "public_insert_referral_claims" ON public.referral_claims
FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_referral_claims" ON public.referral_claims;
CREATE POLICY "admin_manage_referral_claims" ON public.referral_claims
FOR ALL TO authenticated
USING (public.is_admin_user_new_features())
WITH CHECK (public.is_admin_user_new_features());

DROP POLICY IF EXISTS "admin_manage_conflict_checks" ON public.conflict_checks;
CREATE POLICY "admin_manage_conflict_checks" ON public.conflict_checks
FOR ALL TO authenticated
USING (public.is_admin_user_new_features())
WITH CHECK (public.is_admin_user_new_features());

DROP POLICY IF EXISTS "admin_manage_lexi_invoice_drafts" ON public.lexi_invoice_drafts;
CREATE POLICY "admin_manage_lexi_invoice_drafts" ON public.lexi_invoice_drafts
FOR ALL TO authenticated
USING (public.is_admin_user_new_features())
WITH CHECK (public.is_admin_user_new_features());
