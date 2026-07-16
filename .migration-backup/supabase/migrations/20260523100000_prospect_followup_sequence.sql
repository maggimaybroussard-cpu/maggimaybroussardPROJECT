-- Add prospect_followup to the email_sequence_type enum
-- This powers the dedicated follow-up sequence for prospects who contact but don't book

DO $$
BEGIN
  -- Add prospect_followup value to the existing enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'prospect_followup'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'email_sequence_type'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'prospect_followup';
  END IF;
END $$;

-- Index to efficiently query prospect_followup sequences
-- Note: partial index WHERE clause omitted here because PostgreSQL requires
-- new enum values to be committed before they can be used in index predicates.
-- A follow-up migration (20260523100001) creates the partial index after commit.
CREATE INDEX IF NOT EXISTS idx_email_sequences_prospect_followup
  ON public.email_sequences(inquiry_id, sequence_type);
