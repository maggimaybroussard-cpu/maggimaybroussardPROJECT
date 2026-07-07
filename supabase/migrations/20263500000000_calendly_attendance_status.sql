-- Migration: Track Calendly attendance status on contact_inquiries
-- Adds attendance_status, no_show_flagged, and attendance_scored_at columns

-- Add attendance_status enum type if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendly_attendance_status') THEN
    CREATE TYPE calendly_attendance_status AS ENUM ('pending', 'attended', 'no_show', 'rescheduled', 'canceled');
  END IF;
END $$;

-- Add attendance tracking columns to contact_inquiries
ALTER TABLE contact_inquiries
  ADD COLUMN IF NOT EXISTS attendance_status calendly_attendance_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS no_show_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_score_delta integer DEFAULT 0;

-- Index for querying no-shows
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_no_show
  ON contact_inquiries (no_show_flagged)
  WHERE no_show_flagged = true;

-- Index for attendance status
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_attendance_status
  ON contact_inquiries (attendance_status);
