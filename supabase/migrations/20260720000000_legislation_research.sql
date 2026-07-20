-- Legislation research saved bills table
CREATE TABLE IF NOT EXISTS public.legislation_saved_bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id text NOT NULL,
  congress integer,
  bill_type text,
  bill_number text,
  title text NOT NULL,
  sponsor text,
  status text,
  latest_action text,
  introduced_date date,
  policy_area text,
  url text,
  ai_summary text,
  relevance_score integer CHECK (relevance_score BETWEEN 1 AND 10),
  practice_areas text[],
  case_types text[],
  key_provisions text[],
  client_impact text,
  urgency text CHECK (urgency IN ('high', 'medium', 'low')),
  case_context text,
  tags text[],
  notes text,
  saved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to lexi_research_history if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lexi_research_history' AND column_name = 'research_type') THEN
    ALTER TABLE public.lexi_research_history ADD COLUMN research_type text DEFAULT 'legislation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lexi_research_history' AND column_name = 'state_filter') THEN
    ALTER TABLE public.lexi_research_history ADD COLUMN state_filter text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lexi_research_history' AND column_name = 'category_filter') THEN
    ALTER TABLE public.lexi_research_history ADD COLUMN category_filter text;
  END IF;
END $$;

-- RLS for legislation_saved_bills
ALTER TABLE public.legislation_saved_bills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'legislation_saved_bills'
      AND policyname = 'Admin can manage saved bills'
  ) THEN
    CREATE POLICY "Admin can manage saved bills"
      ON public.legislation_saved_bills
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_legislation_saved_bills_created_at ON public.legislation_saved_bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legislation_saved_bills_policy_area ON public.legislation_saved_bills(policy_area);
CREATE INDEX IF NOT EXISTS idx_legislation_saved_bills_urgency ON public.legislation_saved_bills(urgency);
