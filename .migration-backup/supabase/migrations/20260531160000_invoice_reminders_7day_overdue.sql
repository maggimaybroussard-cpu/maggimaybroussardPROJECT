-- Migration: Add 7-days-after-due reminder support
-- The existing unique index on (invoice_id, reminder_type) prevents storing both
-- 3-day and 7-day after-due reminders for the same invoice.
-- We drop that index and replace it with (invoice_id, reminder_type, trigger_days).

-- 1. Drop the old unique index
DROP INDEX IF EXISTS public.idx_invoice_reminders_unique_type;

-- 2. Create new unique index that includes trigger_days
--    This allows: before_due/7, after_due/3, after_due/7 per invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_reminders_unique_type_days
  ON public.invoice_reminders(invoice_id, reminder_type, trigger_days);
