-- Migration: Intake Templates & Reporting Exports
-- Timestamp: 20260619950000

-- ─── intake_templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intake_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  practice_area TEXT NOT NULL,
  description TEXT,
  default_fields JSONB NOT NULL DEFAULT '{}',
  default_tasks JSONB NOT NULL DEFAULT '[]',
  court_deadlines JSONB NOT NULL DEFAULT '[]',
  engagement_type TEXT NOT NULL DEFAULT 'litigation',
  retainer_tier TEXT NOT NULL DEFAULT 'standard',
  hourly_rate NUMERIC(10,2),
  flat_fee NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'intake_templates' AND policyname = 'Admin full access intake_templates'
  ) THEN
    CREATE POLICY "Admin full access intake_templates"
      ON public.intake_templates
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'attorney', 'paralegal')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- ─── intake_template_applications ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intake_template_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.intake_templates(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  deadlines_created INTEGER NOT NULL DEFAULT 0,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_template_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'intake_template_applications' AND policyname = 'Admin full access template_applications'
  ) THEN
    CREATE POLICY "Admin full access template_applications"
      ON public.intake_template_applications
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'attorney', 'paralegal')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'attorney', 'paralegal')
        )
      );
  END IF;
END $$;

-- ─── Add source/template_id columns to admin_tasks if not present ─────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_tasks' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.admin_tasks ADD COLUMN source TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_tasks' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.admin_tasks ADD COLUMN template_id UUID REFERENCES public.intake_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Add source/template_id columns to court_deadlines if not present ─────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_deadlines' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.court_deadlines ADD COLUMN source TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_deadlines' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.court_deadlines ADD COLUMN template_id UUID REFERENCES public.intake_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'intake_templates_updated_at'
  ) THEN
    CREATE TRIGGER intake_templates_updated_at
      BEFORE UPDATE ON public.intake_templates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
