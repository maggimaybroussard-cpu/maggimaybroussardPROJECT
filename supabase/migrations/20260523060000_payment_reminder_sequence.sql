-- Add payment_reminder to email_sequence_type enum
-- ALTER TYPE ADD VALUE must run outside a transaction block to commit before use

ALTER TYPE public.email_sequence_type ADD VALUE IF NOT EXISTS 'payment_reminder';

-- Index to efficiently query email sequences per inquiry per day
-- NOTE: Cannot use a partial index with the new enum value in the same migration
-- (PostgreSQL 55P04: new enum values must be committed before use in expressions)
-- Using a non-partial index on the same columns instead
CREATE INDEX IF NOT EXISTS idx_email_sequences_payment_reminder
  ON public.email_sequences (inquiry_id, sequence_type, created_at);

-- Index on client_invoices for due_date + status lookups (used by schedule-payment-reminders)
CREATE INDEX IF NOT EXISTS idx_client_invoices_due_date_status
  ON public.client_invoices (due_date, status);
