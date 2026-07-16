-- Testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  firm TEXT NOT NULL,
  location TEXT NOT NULL,
  service TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  quote TEXT NOT NULL,
  full_quote TEXT NOT NULL,
  image TEXT NOT NULL,
  alt TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_testimonials_active ON public.testimonials(active);
CREATE INDEX IF NOT EXISTS idx_testimonials_sort_order ON public.testimonials(sort_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_testimonials_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS testimonials_updated_at ON public.testimonials;
CREATE TRIGGER testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_testimonials_updated_at();

-- RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_testimonials" ON public.testimonials;
CREATE POLICY "public_read_testimonials"
  ON public.testimonials FOR SELECT
  TO public
  USING (active = true);

DROP POLICY IF EXISTS "authenticated_manage_testimonials" ON public.testimonials;
CREATE POLICY "authenticated_manage_testimonials"
  ON public.testimonials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.testimonials LIMIT 1) THEN
    INSERT INTO public.testimonials (name, role, firm, location, service, rating, quote, full_quote, image, alt, featured, sort_order) VALUES
    (
      'Catherine Hargrove', 'Partner', 'Hargrove & Whitfield LLP', 'Austin, TX', 'Litigation Support', 5,
      'Maggi May transformed how our firm handles overflow caseloads.',
      'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. We brought her on during a particularly demanding trial season and she delivered without a single missed deadline. An absolute asset to any legal team.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_1bb18e0a9-1763297020873.png',
      'Catherine Hargrove, Partner at Hargrove & Whitfield LLP, professional headshot',
      true, 1
    ),
    (
      'James Thibodeau', 'Solo Practitioner', 'Family Law', 'New Orleans, LA', 'Document Drafting', 5,
      'She handles my document drafting flawlessly and always meets deadlines.',
      'I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines. Her turnaround time is remarkable — I submitted a complex motion on a Friday afternoon and had a polished draft by Monday morning. I''ve since referred her to two colleagues.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_1a79b8e72-1763295320816.png',
      'James Thibodeau, solo family law practitioner, professional headshot',
      true, 2
    ),
    (
      'Renata Vásquez', 'Managing Attorney', 'Vásquez Law Group', 'Miami, FL', 'Litigation Support', 5,
      'Her litigation support during our trial prep saved us weeks of work.',
      'Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead. Maggi May assembled our exhibit binders, maintained the witness list, and flagged three inconsistencies in opposing counsel''s filings that we had missed. She thinks like a litigator.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_141e51895-1763296519617.png',
      'Renata Vásquez, Managing Attorney at Vásquez Law Group, professional headshot',
      true, 3
    ),
    (
      'Marcus Okonkwo', 'Director of Legal Affairs', 'Meridian Capital Group', 'Chicago, IL', 'Contract Review', 5,
      'Her attention to risk factors and clear summaries have become indispensable.',
      'We''ve worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team. She developed a custom risk matrix for our vendor agreements that our in-house counsel now uses as the standard template. Exceptional value for the quality delivered.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_179ebd6f2-1763294255544.png',
      'Marcus Okonkwo, Director of Legal Affairs at Meridian Capital Group, professional headshot',
      false, 4
    ),
    (
      'Diane Pellegrino', 'Senior Associate', 'Pellegrino & Marsh', 'Dallas, TX', 'Legal Research', 5,
      'The research memo she delivered was better than what our associates produce.',
      'The research memo she delivered was better than what our associates produce in twice the time. Maggi May has a rare ability to distill complex case law into actionable summaries. She cited 22 cases across three jurisdictions and organized them by relevance to our specific argument. I will be using her for every research-heavy matter going forward.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_141e51895-1763296519617.png',
      'Diane Pellegrino, Senior Associate at Pellegrino & Marsh, professional headshot',
      false, 5
    ),
    (
      'Robert Ashford', 'General Counsel', 'Ashford Realty Holdings', 'Baton Rouge, LA', 'Document Drafting', 5,
      'She drafted our entire lease template suite in under a week.',
      'She drafted our entire lease template suite in under a week — commercial, residential, and short-term rental — all tailored to Louisiana law. Each document was clean, well-organized, and required minimal revision. Maggi May saved us thousands in outside counsel fees and delivered a product we''re proud to put in front of clients.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_1a79b8e72-1763295320816.png',
      'Robert Ashford, General Counsel at Ashford Realty Holdings, professional headshot',
      false, 6
    ),
    (
      'Simone Beaumont', 'Partner', 'Beaumont & Croft Attorneys', 'Nashville, TN', 'Case Management', 5,
      'Our case management has never been more organized.',
      'Our case management has never been more organized. Maggi May built out our entire matter tracking system, set up deadline calendars, and created intake templates that cut our onboarding time in half. She''s proactive, communicates clearly, and treats every case as if it''s her own. I can''t imagine running our practice without her support.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_1c96c4732-1763297065148.png',
      'Simone Beaumont, Partner at Beaumont & Croft Attorneys, professional headshot',
      false, 7
    ),
    (
      'Thomas Nguyen', 'Immigration Attorney', 'Nguyen Law Office', 'Houston, TX', 'Document Drafting', 5,
      'She prepared 40 client files for an asylum hearing with zero errors.',
      'She prepared 40 client files for an asylum hearing with zero errors and two days to spare. Immigration work is detail-intensive and unforgiving — Maggi May understood that from day one. Her organizational system, cross-referencing, and document labeling were exactly what we needed. She''s now my first call for any high-volume filing.',
      'https://img.rocket.new/generatedImages/rocket_gen_img_1070e0b4b-1763292306155.png',
      'Thomas Nguyen, Immigration Attorney at Nguyen Law Office, professional headshot',
      false, 8
    );
  END IF;
END $$;
