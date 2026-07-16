-- Migration: Add tier_label, sms_sent, sms_sid columns to overdue_invoice_alerts
-- Supports 15-day, 30-day, and 45-day threshold tiers with SMS tracking

ALTER TABLE public.overdue_invoice_alerts
  ADD COLUMN IF NOT EXISTS tier_label text DEFAULT 'overdue',
  ADD COLUMN IF NOT EXISTS sms_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_sid text;

-- Backfill tier_label for existing rows based on days_overdue
UPDATE public.overdue_invoice_alerts
SET tier_label = CASE
  WHEN days_overdue >= 45 THEN 'critical'
  WHEN days_overdue >= 30 THEN 'overdue'
  ELSE 'early'
END
WHERE tier_label IS NULL OR tier_label = 'overdue';
