-- Add post_service_followup to email_sequence_type enum
-- Add booking_stage tracking to contact_inquiries

-- Extend email_sequence_type enum with post_service_followup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'post_service_followup'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'email_sequence_type'
      )
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'post_service_followup';
  END IF;
END;
$$;

-- Add booking_stage column to contact_inquiries to track pipeline stage
ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS booking_stage TEXT NOT NULL DEFAULT 'inquiry'
  CHECK (booking_stage IN ('inquiry', 'consultation_booked', 'proposal_sent', 'active_client', 'completed', 'closed'));

-- Index for booking_stage filtering
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_booking_stage
  ON public.contact_inquiries(booking_stage);

-- Function to auto-schedule post-service follow-up when booking_stage changes to 'completed'
CREATE OR REPLACE FUNCTION public.handle_booking_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a case is marked completed, schedule a post-service follow-up sequence
  IF NEW.booking_stage = 'completed' AND OLD.booking_stage <> 'completed' THEN
    INSERT INTO public.email_sequences (
      inquiry_id,
      sequence_type,
      step_number,
      scheduled_at,
      send_status
    ) VALUES
      -- Day 3 post-completion: satisfaction check-in
      (NEW.id, 'post_service_followup', 1, NOW() + INTERVAL '3 days', 'pending'),
      -- Day 14 post-completion: testimonial / referral ask
      (NEW.id, 'post_service_followup', 2, NOW() + INTERVAL '14 days', 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_stage_change ON public.contact_inquiries;
CREATE TRIGGER on_booking_stage_change
  AFTER UPDATE OF booking_stage ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_stage_change();
