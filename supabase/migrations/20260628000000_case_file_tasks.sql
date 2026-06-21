-- Migration: Case File Tasks
-- Adds task deadlines per matter for the Lexi Case Files screen.
-- Links tasks to matters (by ref string), clients, and optionally consultation bookings.

-- 1. Create case_file_tasks table
CREATE TABLE IF NOT EXISTS public.case_file_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_ref TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT 'Unknown',
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  linked_consultation_id UUID REFERENCES public.consultation_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. CHECK constraints for priority and status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'case_file_tasks'
      AND constraint_name = 'case_file_tasks_priority_check'
  ) THEN
    ALTER TABLE public.case_file_tasks
      ADD CONSTRAINT case_file_tasks_priority_check
      CHECK (priority = ANY (ARRAY['low', 'medium', 'high', 'urgent']));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'case_file_tasks'
      AND constraint_name = 'case_file_tasks_status_check'
  ) THEN
    ALTER TABLE public.case_file_tasks
      ADD CONSTRAINT case_file_tasks_status_check
      CHECK (status = ANY (ARRAY['pending', 'in_progress', 'completed', 'overdue']));
  END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_case_file_tasks_matter_ref
  ON public.case_file_tasks(matter_ref);

CREATE INDEX IF NOT EXISTS idx_case_file_tasks_due_date
  ON public.case_file_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_case_file_tasks_status
  ON public.case_file_tasks(status);

CREATE INDEX IF NOT EXISTS idx_case_file_tasks_linked_consultation
  ON public.case_file_tasks(linked_consultation_id);

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_case_file_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_file_tasks_updated_at ON public.case_file_tasks;
CREATE TRIGGER trg_case_file_tasks_updated_at
  BEFORE UPDATE ON public.case_file_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_case_file_tasks_updated_at();

-- 5. Enable RLS
ALTER TABLE public.case_file_tasks ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy — admin-only access
DROP POLICY IF EXISTS "admin_manage_case_file_tasks" ON public.case_file_tasks;
CREATE POLICY "admin_manage_case_file_tasks"
  ON public.case_file_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
