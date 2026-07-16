-- Case milestone notifications log
-- Tracks when milestone notifications are sent to clients

CREATE TABLE IF NOT EXISTS public.case_milestone_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_stage text,
  new_stage text NOT NULL,
  email_sent boolean DEFAULT false,
  in_app_created boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookup by case
CREATE INDEX IF NOT EXISTS idx_case_milestone_notifications_case_id
  ON public.case_milestone_notifications(case_id);

-- RLS: only admins can read/write
ALTER TABLE public.case_milestone_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'case_milestone_notifications'
    AND policyname = 'Admin full access to milestone notifications'
  ) THEN
    CREATE POLICY "Admin full access to milestone notifications"
      ON public.case_milestone_notifications
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
