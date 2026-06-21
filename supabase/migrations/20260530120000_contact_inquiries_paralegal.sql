-- Add assigned_paralegal column to contact_inquiries for lead capture auto-suggest
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS assigned_paralegal TEXT;

-- Add suggested_service column to track auto-suggested service type
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS suggested_service TEXT;

-- Index for paralegal filtering in admin
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_assigned_paralegal
ON public.contact_inquiries(assigned_paralegal);
