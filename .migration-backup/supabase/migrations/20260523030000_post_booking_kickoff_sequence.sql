-- Add post_booking_kickoff to email_sequence_type enum
-- This supports the automated 3-step post-booking email sequence:
--   Step 1 (immediate): Document checklist
--   Step 2 (day 1):     Retainer confirmation & engagement options
--   Step 3 (day 3):     Next-step reminders & pre-consultation guide

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'post_booking_kickoff'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'post_booking_kickoff';
  END IF;
END;
$$;

-- Also add 'welcome' if not already present (used by schedule-nurture-sequence)
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

-- Index to efficiently query post-booking sequences by inquiry
-- Note: No partial WHERE filter on the new enum value — new enum values cannot be
-- referenced in the same migration transaction they are added in (PostgreSQL 55P04).
-- The composite index on (inquiry_id, sequence_type, step_number) is still effective.
CREATE INDEX IF NOT EXISTS idx_email_sequences_post_booking
  ON public.email_sequences(inquiry_id, sequence_type, step_number);
