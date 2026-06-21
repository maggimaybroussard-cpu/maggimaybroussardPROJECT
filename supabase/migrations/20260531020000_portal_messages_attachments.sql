-- Add file attachment support to portal_messages
ALTER TABLE public.portal_messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Index for faster message lookups by inquiry
CREATE INDEX IF NOT EXISTS idx_portal_messages_inquiry_id ON public.portal_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at ON public.portal_messages(inquiry_id, created_at);

-- Ensure RLS is enabled
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "clients_view_own_case_messages" ON public.portal_messages;
DROP POLICY IF EXISTS "clients_insert_own_case_messages" ON public.portal_messages;
DROP POLICY IF EXISTS "admin_manage_all_messages" ON public.portal_messages;
DROP POLICY IF EXISTS "portal_messages_client_select" ON public.portal_messages;
DROP POLICY IF EXISTS "portal_messages_client_insert" ON public.portal_messages;
DROP POLICY IF EXISTS "portal_messages_admin_all" ON public.portal_messages;

-- Clients can view messages for their cases
CREATE POLICY "portal_messages_client_select"
ON public.portal_messages
FOR SELECT
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access
    WHERE user_id = auth.uid()
  )
);

-- Clients can insert messages for their cases
CREATE POLICY "portal_messages_client_insert"
ON public.portal_messages
FOR INSERT
TO authenticated
WITH CHECK (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access
    WHERE user_id = auth.uid()
  )
  AND sender_role = 'client'
);

-- Clients can update read_at on admin messages (mark as read)
DROP POLICY IF EXISTS "portal_messages_client_update_read" ON public.portal_messages;
CREATE POLICY "portal_messages_client_update_read"
ON public.portal_messages
FOR UPDATE
TO authenticated
USING (
  inquiry_id IN (
    SELECT inquiry_id FROM public.client_portal_access
    WHERE user_id = auth.uid()
  )
);

-- Storage policy: allow authenticated users to upload to case-documents bucket
-- (bucket already exists, policies managed via Supabase dashboard or existing migrations)
