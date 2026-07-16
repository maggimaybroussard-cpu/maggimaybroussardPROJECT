-- Consultation Action Items: auto-created tasks when consultation is marked completed

DROP TYPE IF EXISTS public.action_item_status CASCADE;
CREATE TYPE public.action_item_status AS ENUM ('pending', 'in_progress', 'completed', 'dismissed');

CREATE TABLE IF NOT EXISTS public.consultation_action_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id      UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  task_type       TEXT NOT NULL DEFAULT 'general',
  status          public.action_item_status NOT NULL DEFAULT 'pending'::public.action_item_status,
  priority        TEXT NOT NULL DEFAULT 'medium',
  due_date        TIMESTAMPTZ,
  assigned_to     TEXT,
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_action_items_inquiry_id ON public.consultation_action_items(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_consultation_action_items_status ON public.consultation_action_items(status);
CREATE INDEX IF NOT EXISTS idx_consultation_action_items_visible_to_client ON public.consultation_action_items(visible_to_client);

ALTER TABLE public.consultation_action_items ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "authenticated_full_access_consultation_action_items" ON public.consultation_action_items;
CREATE POLICY "authenticated_full_access_consultation_action_items"
  ON public.consultation_action_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon/client: read-only for client-visible items (portal uses anon key)
DROP POLICY IF EXISTS "anon_read_client_visible_action_items" ON public.consultation_action_items;
CREATE POLICY "anon_read_client_visible_action_items"
  ON public.consultation_action_items
  FOR SELECT
  TO anon
  USING (visible_to_client = true);
