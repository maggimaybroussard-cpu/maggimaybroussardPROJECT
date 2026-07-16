-- Create partial index for prospect_followup sequences
-- This must run in a separate migration after the enum value 'prospect_followup'
-- has been committed (added in 20260523100000_prospect_followup_sequence.sql).
-- PostgreSQL does not allow new enum values to be used in index predicates
-- within the same transaction they were created.

DROP INDEX IF EXISTS public.idx_email_sequences_prospect_followup;

CREATE INDEX IF NOT EXISTS idx_email_sequences_prospect_followup
  ON public.email_sequences(inquiry_id, sequence_type)
  WHERE sequence_type = 'prospect_followup';
