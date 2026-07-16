-- E-Signatures: stores signature requests and completed signatures for client portal

CREATE TABLE IF NOT EXISTS public.signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_description TEXT,
    document_content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT NOT NULL DEFAULT 'Maggi May Broussard',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_inquiry_id ON public.signature_requests(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON public.signature_requests(status);

CREATE TABLE IF NOT EXISTS public.signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
    inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signature_data TEXT NOT NULL,
    signature_type TEXT NOT NULL DEFAULT 'drawn',
    ip_address TEXT,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signatures_request_id ON public.signatures(request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON public.signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_inquiry_id ON public.signatures(inquiry_id);

-- Enable RLS
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- RLS: signature_requests — clients can read requests for their inquiries
DROP POLICY IF EXISTS "clients_read_own_signature_requests" ON public.signature_requests;
CREATE POLICY "clients_read_own_signature_requests"
ON public.signature_requests
FOR SELECT
TO authenticated
USING (public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_signature_requests" ON public.signature_requests;
CREATE POLICY "authenticated_manage_signature_requests"
ON public.signature_requests
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS: signatures — clients can read and insert their own signatures
DROP POLICY IF EXISTS "clients_read_own_signatures" ON public.signatures;
CREATE POLICY "clients_read_own_signatures"
ON public.signatures
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "clients_insert_own_signatures" ON public.signatures;
CREATE POLICY "clients_insert_own_signatures"
ON public.signatures
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.user_has_inquiry_access(inquiry_id));

DROP POLICY IF EXISTS "authenticated_manage_signatures" ON public.signatures;
CREATE POLICY "authenticated_manage_signatures"
ON public.signatures
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
