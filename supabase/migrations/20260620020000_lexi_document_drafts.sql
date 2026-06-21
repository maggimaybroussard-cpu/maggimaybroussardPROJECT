-- Migration: lexi_document_drafts
-- Stores AI-generated legal document drafts for admin review and sending

CREATE TABLE IF NOT EXISTS public.lexi_document_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL, -- 'motion', 'brief', 'discovery_request', 'demand_letter', 'settlement_agreement', 'contract_review'
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  case_ref TEXT,
  service_type TEXT,
  case_facts TEXT NOT NULL,
  custom_instructions TEXT,
  draft_content TEXT NOT NULL,
  draft_status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'sent'
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  sent_by TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  contact_inquiry_id UUID REFERENCES public.contact_inquiries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexi_document_drafts_status ON public.lexi_document_drafts(draft_status);
CREATE INDEX IF NOT EXISTS idx_lexi_document_drafts_created_at ON public.lexi_document_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lexi_document_drafts_document_type ON public.lexi_document_drafts(document_type);
CREATE INDEX IF NOT EXISTS idx_lexi_document_drafts_contact_inquiry_id ON public.lexi_document_drafts(contact_inquiry_id);

ALTER TABLE public.lexi_document_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_lexi_document_drafts" ON public.lexi_document_drafts;
CREATE POLICY "admin_full_access_lexi_document_drafts"
ON public.lexi_document_drafts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_lexi_document_drafts" ON public.lexi_document_drafts;
CREATE POLICY "public_insert_lexi_document_drafts"
ON public.lexi_document_drafts
FOR INSERT
TO anon
WITH CHECK (true);
