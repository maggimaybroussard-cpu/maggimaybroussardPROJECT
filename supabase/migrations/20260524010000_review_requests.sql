-- Review requests: schedule and track 5-day post-booking review emails
-- Each booking gets a unique secure token; clicking the link in the email
-- opens /review/[token] which auto-populates the testimonials table.

-- ── 1. Add review_request enum value ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'review_request'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'review_request';
  END IF;
END;
$$;

-- ── 2. Review requests table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id    UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  sequence_id   UUID REFERENCES public.email_sequences(id) ON DELETE SET NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name   TEXT NOT NULL,
  client_email  TEXT NOT NULL,
  service       TEXT,
  -- Feedback submitted via the one-click link
  submitted     BOOLEAN NOT NULL DEFAULT false,
  submitted_at  TIMESTAMPTZ,
  rating        INTEGER CHECK (rating >= 1 AND rating <= 5),
  quote         TEXT,
  full_quote    TEXT,
  -- Link to the testimonial row created from this review
  testimonial_id UUID REFERENCES public.testimonials(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_requests_token       ON public.review_requests(token);
CREATE INDEX IF NOT EXISTS idx_review_requests_inquiry_id  ON public.review_requests(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_submitted   ON public.review_requests(submitted);

-- ── 3. updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_review_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_requests_updated_at ON public.review_requests;
CREATE TRIGGER review_requests_updated_at
  BEFORE UPDATE ON public.review_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_review_requests_updated_at();

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

-- Public can read a single row by token (for the feedback page)
DROP POLICY IF EXISTS "public_read_review_request_by_token" ON public.review_requests;
CREATE POLICY "public_read_review_request_by_token"
  ON public.review_requests FOR SELECT
  TO public
  USING (true);

-- Public can submit feedback (UPDATE rating/quote/submitted fields via token)
DROP POLICY IF EXISTS "public_submit_review_request" ON public.review_requests;
CREATE POLICY "public_submit_review_request"
  ON public.review_requests FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Authenticated (admin) can manage all rows
DROP POLICY IF EXISTS "authenticated_manage_review_requests" ON public.review_requests;
CREATE POLICY "authenticated_manage_review_requests"
  ON public.review_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public can insert (edge function uses service role, but keep open for flexibility)
DROP POLICY IF EXISTS "public_insert_review_requests" ON public.review_requests;
CREATE POLICY "public_insert_review_requests"
  ON public.review_requests FOR INSERT
  TO public
  WITH CHECK (true);
