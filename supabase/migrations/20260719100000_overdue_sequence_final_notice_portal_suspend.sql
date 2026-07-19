-- Migration: Add final_notice_sent and portal_suspended to overdue_invoice_sequences
-- Supports the full automated sequence: 7d → 14d → 30d → final notice → portal suspension

ALTER TABLE public.overdue_invoice_sequences
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS final_notice_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_notice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sequence_stage TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for quick lookup of active, non-resolved sequences
CREATE INDEX IF NOT EXISTS idx_overdue_sequences_active
  ON public.overdue_invoice_sequences(resolved, portal_suspended, days_overdue);

CREATE INDEX IF NOT EXISTS idx_overdue_sequences_stage
  ON public.overdue_invoice_sequences(sequence_stage);
