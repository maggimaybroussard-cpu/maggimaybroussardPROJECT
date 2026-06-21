-- Migration: Add attachment support to portal_messages and intake category to case_documents
-- Adds attachment_url and attachment_name columns to portal_messages for file sharing in messaging hub

-- 1. Add attachment columns to portal_messages
ALTER TABLE public.portal_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 2. Add 'intake' as a valid category for case documents (extend existing check if present)
-- The category column is free-text, so no constraint change needed — just ensure index exists
CREATE INDEX IF NOT EXISTS idx_case_documents_category
  ON public.case_documents(category);

-- 3. Index for faster message attachment queries
CREATE INDEX IF NOT EXISTS idx_portal_messages_attachment
  ON public.portal_messages(inquiry_id, created_at DESC)
  WHERE attachment_url IS NOT NULL;
