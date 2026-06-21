-- Add source tracking to contact_inquiries and welcome sequence type to email_sequences

-- Add source column to contact_inquiries to track lead origin (contact_form vs chatbot)
ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'contact_form';

-- Add index on source for admin filtering
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_source ON public.contact_inquiries(source);

-- Extend email_sequence_type enum to include 'welcome'
-- We use a safe approach: add value only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'welcome'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'welcome';
  END IF;
END;
$$;
