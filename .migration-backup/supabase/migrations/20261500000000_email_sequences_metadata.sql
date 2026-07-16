-- Add metadata column to email_sequences for storing extra context (recipient info, source, etc.)
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS metadata text;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS sent_at timestamptz;
