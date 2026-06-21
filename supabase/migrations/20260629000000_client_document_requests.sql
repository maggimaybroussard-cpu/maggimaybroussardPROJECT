-- Migration: Client Document Requests
-- Adds client_document_requests table for the Client Hub document request feature.
-- Clients can request documents without email; admins review and fulfill requests.

-- 1. Create client_document_requests table
CREATE TABLE IF NOT EXISTS public.client_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. CHECK constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'client_document_requests'
      AND constraint_name = 'client_document_requests_status_check'
  ) THEN
    ALTER TABLE public.client_document_requests
      ADD CONSTRAINT client_document_requests_status_check
      CHECK (status = ANY (ARRAY['pending', 'in_review', 'fulfilled', 'declined']));
  END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_client_document_requests_inquiry_id
  ON public.client_document_requests(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_client_document_requests_client_id
  ON public.client_document_requests(client_id);

CREATE INDEX IF NOT EXISTS idx_client_document_requests_status
  ON public.client_document_requests(status);

CREATE INDEX IF NOT EXISTS idx_client_document_requests_created_at
  ON public.client_document_requests(created_at DESC);

-- 4. Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_client_document_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_document_requests_updated_at ON public.client_document_requests;
CREATE TRIGGER trg_client_document_requests_updated_at
  BEFORE UPDATE ON public.client_document_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_document_requests_updated_at();

-- 5. Enable RLS
ALTER TABLE public.client_document_requests ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Clients can view their own requests
DROP POLICY IF EXISTS "clients_view_own_document_requests" ON public.client_document_requests;
CREATE POLICY "clients_view_own_document_requests"
  ON public.client_document_requests
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Clients can insert their own requests
DROP POLICY IF EXISTS "clients_insert_own_document_requests" ON public.client_document_requests;
CREATE POLICY "clients_insert_own_document_requests"
  ON public.client_document_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Admins have full access (using auth metadata role check)
DROP POLICY IF EXISTS "admin_manage_document_requests" ON public.client_document_requests;
CREATE POLICY "admin_manage_document_requests"
  ON public.client_document_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (
          au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (
          au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin'
        )
    )
  );
