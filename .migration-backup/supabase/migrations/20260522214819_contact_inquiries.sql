-- Create contact_inquiries table to store all form submissions
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    firm TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON public.contact_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email ON public.contact_inquiries(email);

-- Enable RLS
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Public can insert (contact form submissions)
DROP POLICY IF EXISTS "public_can_insert_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "public_can_insert_contact_inquiries"
ON public.contact_inquiries
FOR INSERT
TO public
WITH CHECK (true);

-- Only authenticated users (admin) can read, update, delete
DROP POLICY IF EXISTS "authenticated_can_read_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "authenticated_can_read_contact_inquiries"
ON public.contact_inquiries
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_can_update_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "authenticated_can_update_contact_inquiries"
ON public.contact_inquiries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_delete_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "authenticated_can_delete_contact_inquiries"
ON public.contact_inquiries
FOR DELETE
TO authenticated
USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_contact_inquiries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER contact_inquiries_updated_at
    BEFORE UPDATE ON public.contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contact_inquiries_updated_at();
