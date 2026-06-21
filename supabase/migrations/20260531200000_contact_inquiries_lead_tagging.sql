-- Add lead qualification and tagging columns to contact_inquiries
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS service_interest_tag TEXT,
ADD COLUMN IF NOT EXISTS retainer_tier_tag TEXT,
ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN,
ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lead_tags TEXT[] DEFAULT '{}';

-- Indexes for admin filtering
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_is_qualified
ON public.contact_inquiries(is_qualified);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_follow_up_status
ON public.contact_inquiries(follow_up_status);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_retainer_tier_tag
ON public.contact_inquiries(retainer_tier_tag);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_service_interest_tag
ON public.contact_inquiries(service_interest_tag);
