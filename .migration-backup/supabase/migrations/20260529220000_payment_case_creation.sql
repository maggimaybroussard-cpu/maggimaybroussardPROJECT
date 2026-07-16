-- Add payment_intent_id to contact_inquiries for linking payments to cases
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_payment_intent_id
ON public.contact_inquiries(payment_intent_id);

-- Add payment_type and firm_name columns for retainer context
ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS payment_type TEXT;

ALTER TABLE public.contact_inquiries
ADD COLUMN IF NOT EXISTS firm_name TEXT;
