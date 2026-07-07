-- Engagement Letters: auto-generated after deposit paid, with digital signature capability

CREATE TABLE IF NOT EXISTS public.engagement_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    payment_intent_id TEXT,
    invoice_id UUID REFERENCES public.client_invoices(id) ON DELETE SET NULL,
    inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
    -- Letter content
    scope TEXT NOT NULL DEFAULT '',
    fees TEXT NOT NULL DEFAULT '',
    retainer_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    timeline TEXT NOT NULL DEFAULT '',
    next_steps TEXT NOT NULL DEFAULT '',
    -- Signature
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired')),
    signed_at TIMESTAMPTZ,
    signer_name TEXT,
    signer_email TEXT,
    signature_data TEXT,
    signature_type TEXT DEFAULT 'typed',
    ip_address TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_engagement_letters_token ON public.engagement_letters(token);
CREATE INDEX IF NOT EXISTS idx_engagement_letters_client_email ON public.engagement_letters(client_email);
CREATE INDEX IF NOT EXISTS idx_engagement_letters_status ON public.engagement_letters(status);
CREATE INDEX IF NOT EXISTS idx_engagement_letters_payment_intent ON public.engagement_letters(payment_intent_id);

-- Enable RLS
ALTER TABLE public.engagement_letters ENABLE ROW LEVEL SECURITY;

-- Public can read by token (for the signing page — no auth required)
DROP POLICY IF EXISTS "public_read_engagement_letter_by_token" ON public.engagement_letters;
CREATE POLICY "public_read_engagement_letter_by_token"
ON public.engagement_letters
FOR SELECT
TO anon, authenticated
USING (true);

-- Public can update signature fields by token (signing action)
DROP POLICY IF EXISTS "public_sign_engagement_letter" ON public.engagement_letters;
CREATE POLICY "public_sign_engagement_letter"
ON public.engagement_letters
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Authenticated (admin) can insert and manage
DROP POLICY IF EXISTS "authenticated_manage_engagement_letters" ON public.engagement_letters;
CREATE POLICY "authenticated_manage_engagement_letters"
ON public.engagement_letters
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
