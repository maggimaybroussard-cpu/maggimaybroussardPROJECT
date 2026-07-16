-- Admin Tasks: internal deliverables, deadlines, and completion tracking

DROP TYPE IF EXISTS public.admin_task_priority CASCADE;
CREATE TYPE public.admin_task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

DROP TYPE IF EXISTS public.admin_task_status CASCADE;
CREATE TYPE public.admin_task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  case_id      UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  case_name    TEXT,
  assigned_to  TEXT,
  priority     public.admin_task_priority NOT NULL DEFAULT 'medium'::public.admin_task_priority,
  status       public.admin_task_status NOT NULL DEFAULT 'todo'::public.admin_task_status,
  due_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status   ON public.admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON public.admin_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_case_id  ON public.admin_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_date ON public.admin_tasks(due_date);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

-- Admin tasks are internal — allow full access to authenticated users (admin-only route)
DROP POLICY IF EXISTS "authenticated_full_access_admin_tasks" ON public.admin_tasks;
CREATE POLICY "authenticated_full_access_admin_tasks"
  ON public.admin_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
