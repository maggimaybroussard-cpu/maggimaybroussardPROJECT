-- Client Portal: links an authenticated user (client) to their inquiry
CREATE TABLE IF NOT EXISTS public.client_portal_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, inquiry_id)
);

CREATE INDEX IF NOT EXISTS idx_client_portal_access_user_id ON public.client_portal_access(user_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_access_inquiry_id ON public.client_portal_access(inquiry_id);

-- Case notes visible to the client (admin creates these)
CREATE TABLE IF NOT EXISTS public.case_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Maggi May Broussard',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_notes_inquiry_id ON public.case_notes(inquiry_id);

-- Documents attached to a case
CREATE TABLE IF NOT EXISTS public.case_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    uploaded_by TEXT NOT NULL DEFAULT 'Maggi May Broussard',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_documents_inquiry_id ON public.case_documents(inquiry_id);

-- Timeline events for a case
CREATE TABLE IF NOT EXISTS public.case_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    event_title TEXT NOT NULL,
    event_description TEXT,
    event_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_timeline_inquiry_id ON public.case_timeline(inquiry_id);

-- Enable RLS on all portal tables
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_timeline ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user has access to an inquiry
CREATE OR REPLACE FUNCTION public.user_has_inquiry_access(inquiry_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE user_id = auth.uid() AND inquiry_id = inquiry_uuid
)
$$;

-- RLS: client_portal_access — users manage their own rows
DROP POLICY IF EXISTS "clients_view_own_portal_access" ON public.client_portal_access;
CREATE POLICY "clients_view_own_portal_access"
ON public.client_portal_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins (authenticated) can insert/delete portal access rows
DROP POLICY IF EXISTS "authenticated_manage_portal_access" ON public.client_portal_access;
CREATE POLICY "authenticated_manage_portal_access"
ON public.client_portal_access
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS: case_notes — clients can read notes for their inquiries
DROP POLICY IF EXISTS "clients_read_own_case_notes" ON public.case_notes;
CREATE POLICY "clients_read_own_case_notes"
ON public.case_notes
FOR SELECT
TO authenticated
USING (public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_case_notes" ON public.case_notes;
CREATE POLICY "authenticated_manage_case_notes"
ON public.case_notes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS: case_documents — clients can read docs for their inquiries
DROP POLICY IF EXISTS "clients_read_own_case_documents" ON public.case_documents;
CREATE POLICY "clients_read_own_case_documents"
ON public.case_documents
FOR SELECT
TO authenticated
USING (public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_case_documents" ON public.case_documents;
CREATE POLICY "authenticated_manage_case_documents"
ON public.case_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS: case_timeline — clients can read timeline for their inquiries
DROP POLICY IF EXISTS "clients_read_own_case_timeline" ON public.case_timeline;
CREATE POLICY "clients_read_own_case_timeline"
ON public.case_timeline
FOR SELECT
TO authenticated
USING (public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_case_timeline" ON public.case_timeline;
CREATE POLICY "authenticated_manage_case_timeline"
ON public.case_timeline
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS: contact_inquiries — clients can read their own linked inquiry
DROP POLICY IF EXISTS "clients_read_own_inquiry" ON public.contact_inquiries;
CREATE POLICY "clients_read_own_inquiry"
ON public.contact_inquiries
FOR SELECT
TO authenticated
USING (
    public.user_has_inquiry_access(id)
    OR (SELECT COUNT(*) FROM public.client_portal_access WHERE user_id = auth.uid()) = 0
);
