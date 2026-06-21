-- Add frequency and documents_included columns to weekly_digest_logs
ALTER TABLE public.weekly_digest_logs
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS documents_included INTEGER NOT NULL DEFAULT 0;

-- Index for filtering by frequency
CREATE INDEX IF NOT EXISTS idx_weekly_digest_logs_frequency ON public.weekly_digest_logs(frequency);
