-- Portal Messages: direct messaging between clients and Maggi May, linked to cases
-- Timestamp: 20260530060000

-- ── 1. Types ──────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.message_sender_role CASCADE;
CREATE TYPE public.message_sender_role AS ENUM ('client', 'admin');

-- ── 2. Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id      UUID REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL,
  sender_role     public.message_sender_role NOT NULL,
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ DEFAULT NULL,
  reply_to_id     UUID REFERENCES public.portal_messages(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_messages_inquiry_id  ON public.portal_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_sender_id   ON public.portal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at  ON public.portal_messages(created_at DESC);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_portal_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_messages_updated_at ON public.portal_messages;
CREATE TRIGGER trg_portal_messages_updated_at
  BEFORE UPDATE ON public.portal_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_portal_messages_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Clients can read messages that belong to their linked inquiry
DROP POLICY IF EXISTS "clients_read_own_messages" ON public.portal_messages;
CREATE POLICY "clients_read_own_messages"
  ON public.portal_messages
  FOR SELECT
  TO authenticated
  USING (
    inquiry_id IN (
      SELECT inquiry_id FROM public.client_portal_access
      WHERE user_id = auth.uid()
    )
  );

-- Clients can insert messages for their own inquiry (sender_role = 'client', sender_id = auth.uid())
DROP POLICY IF EXISTS "clients_insert_own_messages" ON public.portal_messages;
CREATE POLICY "clients_insert_own_messages"
  ON public.portal_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'client'
    AND inquiry_id IN (
      SELECT inquiry_id FROM public.client_portal_access
      WHERE user_id = auth.uid()
    )
  );

-- Clients can update read_at on messages sent to them (admin messages)
DROP POLICY IF EXISTS "clients_mark_messages_read" ON public.portal_messages;
CREATE POLICY "clients_mark_messages_read"
  ON public.portal_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_role = 'admin'
    AND inquiry_id IN (
      SELECT inquiry_id FROM public.client_portal_access
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_role = 'admin'
    AND inquiry_id IN (
      SELECT inquiry_id FROM public.client_portal_access
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users (admin) can do everything
DROP POLICY IF EXISTS "admin_full_access_portal_messages" ON public.portal_messages;
CREATE POLICY "admin_full_access_portal_messages"
  ON public.portal_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
