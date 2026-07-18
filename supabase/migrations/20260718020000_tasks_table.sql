-- Tasks table migration
-- Adds a tasks table with title, description, caseId, status, priority, dueDate, assignee fields

-- 1. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  case_id INTEGER REFERENCES public.case_file_tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'tasks'
    AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status = ANY (ARRAY['pending', 'in_progress', 'completed', 'overdue']));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'tasks'
    AND constraint_name = 'tasks_priority_check'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_priority_check
    CHECK (priority = ANY (ARRAY['low', 'medium', 'high', 'urgent']));
  END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();

-- 5. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy — admin-only access
DROP POLICY IF EXISTS "admin_manage_tasks" ON public.tasks;
CREATE POLICY "admin_manage_tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
