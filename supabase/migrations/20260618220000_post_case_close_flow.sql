-- ─── Post-Case-Close Flow ────────────────────────────────────────────────────
-- Adds case_close_requests (one-click review + testimonial + referral per case)
-- and referral_submissions (tracks referred contacts from incentive links).

-- ── 1. case_close_requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_close_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id        UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  token             TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  service           TEXT,
  case_reference    TEXT,

  -- Review / Testimonial
  review_submitted        BOOLEAN NOT NULL DEFAULT false,
  review_submitted_at     TIMESTAMPTZ,
  rating                  INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_quote            TEXT,
  review_full_quote       TEXT,
  reviewer_role           TEXT,
  reviewer_firm           TEXT,
  reviewer_location       TEXT,
  allow_public_display    BOOLEAN NOT NULL DEFAULT true,

  -- Testimonial approval
  testimonial_status      TEXT NOT NULL DEFAULT 'pending'
                            CHECK (testimonial_status IN ('pending','approved','rejected')),
  testimonial_approved_at TIMESTAMPTZ,
  testimonial_id          UUID REFERENCES public.testimonials(id) ON DELETE SET NULL,

  -- Referral incentive
  referral_incentive_sent BOOLEAN NOT NULL DEFAULT false,
  referral_code           TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  referral_reward_desc    TEXT DEFAULT '$50 credit toward future services',

  -- Admin notes
  admin_notes             TEXT,

  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ccr_token        ON public.case_close_requests(token);
CREATE INDEX IF NOT EXISTS idx_ccr_inquiry_id   ON public.case_close_requests(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_ccr_status       ON public.case_close_requests(testimonial_status);
CREATE INDEX IF NOT EXISTS idx_ccr_email        ON public.case_close_requests(client_email);

-- ── 2. referral_submissions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_close_id     UUID REFERENCES public.case_close_requests(id) ON DELETE CASCADE,
  referral_code     TEXT,
  referred_name     TEXT NOT NULL,
  referred_email    TEXT NOT NULL,
  referred_firm     TEXT,
  referred_service  TEXT,
  message           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','contacted','converted','declined')),
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ref_sub_case_close_id ON public.referral_submissions(case_close_id);
CREATE INDEX IF NOT EXISTS idx_ref_sub_code          ON public.referral_submissions(referral_code);
CREATE INDEX IF NOT EXISTS idx_ref_sub_status        ON public.referral_submissions(status);

-- ── 3. updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_case_close_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ccr_updated_at ON public.case_close_requests;
CREATE TRIGGER ccr_updated_at
  BEFORE UPDATE ON public.case_close_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_case_close_requests_updated_at();

CREATE OR REPLACE FUNCTION public.set_referral_submissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ref_sub_updated_at ON public.referral_submissions;
CREATE TRIGGER ref_sub_updated_at
  BEFORE UPDATE ON public.referral_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_submissions_updated_at();

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.case_close_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_ccr_by_token" ON public.case_close_requests;
CREATE POLICY "public_read_ccr_by_token"
  ON public.case_close_requests FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "public_submit_ccr" ON public.case_close_requests;
CREATE POLICY "public_submit_ccr"
  ON public.case_close_requests FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_ccr" ON public.case_close_requests;
CREATE POLICY "public_insert_ccr"
  ON public.case_close_requests FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_ccr" ON public.case_close_requests;
CREATE POLICY "authenticated_manage_ccr"
  ON public.case_close_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.referral_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_referral" ON public.referral_submissions;
CREATE POLICY "public_insert_referral"
  ON public.referral_submissions FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_referral" ON public.referral_submissions;
CREATE POLICY "public_read_referral"
  ON public.referral_submissions FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "authenticated_manage_referral" ON public.referral_submissions;
CREATE POLICY "authenticated_manage_referral"
  ON public.referral_submissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
