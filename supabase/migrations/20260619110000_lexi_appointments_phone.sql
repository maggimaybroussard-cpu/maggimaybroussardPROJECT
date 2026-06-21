-- Migration: add client_phone to lexi_appointments for Twilio SMS
-- Timestamp: 20260619110000

ALTER TABLE public.lexi_appointments
  ADD COLUMN IF NOT EXISTS client_phone text;
