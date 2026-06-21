-- Migration: Add deliverable tracking fields to case_documents
-- Adds: deliverable_status (pending/completed/approved), due_date, deliverable_type, client_visible

-- Add deliverable_status column
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS deliverable_status TEXT DEFAULT 'pending'
  CHECK (deliverable_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'approved'::text, 'rejected'::text]));

-- Add due_date column
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add deliverable_type column for categorizing deliverable purpose
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS deliverable_type TEXT DEFAULT 'general'
  CHECK (deliverable_type = ANY (ARRAY['intake_document'::text, 'legal_research'::text, 'draft'::text, 'filing'::text, 'correspondence'::text, 'general'::text]));

-- Add client_visible flag so admin can control what clients see
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT true;

-- Add notes for status changes
ALTER TABLE public.case_documents
ADD COLUMN IF NOT EXISTS status_notes TEXT;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_case_documents_deliverable_status ON public.case_documents(deliverable_status);
CREATE INDEX IF NOT EXISTS idx_case_documents_due_date ON public.case_documents(due_date);
CREATE INDEX IF NOT EXISTS idx_case_documents_deliverable_type ON public.case_documents(deliverable_type);
CREATE INDEX IF NOT EXISTS idx_case_documents_client_visible ON public.case_documents(client_visible);
