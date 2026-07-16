-- Document Templates: contract, retainer, and discovery templates
-- that auto-populate with case/client details for quick Active stage setup

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL CHECK (template_type IN ('contract', 'retainer', 'discovery')),
  name          TEXT NOT NULL,
  description   TEXT,
  body          TEXT NOT NULL DEFAULT '',
  variables     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_document_templates_type
  ON public.document_templates (template_type);

-- ── Updated-at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_document_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_document_templates_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_document_templates" ON public.document_templates;
CREATE POLICY "admin_full_access_document_templates"
  ON public.document_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Seed default templates ────────────────────────────────────────────────────

DO $$
BEGIN
  -- Contract template
  INSERT INTO public.document_templates (id, template_type, name, description, body, variables, is_default)
  VALUES (
    gen_random_uuid(),
    'contract',
    'Standard Legal Services Agreement',
    'General engagement contract for new clients covering scope, fees, and terms.',
    E'LEGAL SERVICES AGREEMENT\n\nThis Legal Services Agreement ("Agreement") is entered into as of {{agreementDate}} between Broussard Legal Services ("Firm") and {{clientName}} ("Client").\n\n1. SCOPE OF SERVICES\nThe Firm agrees to provide legal services in connection with the following matter:\n\nMatter: {{caseName}}\nService Type: {{serviceType}}\n\n2. FEES AND BILLING\nClient agrees to pay the Firm at the agreed rate for all services rendered. Invoices will be issued periodically and are due within 30 days of receipt.\n\n3. RETAINER\nClient shall pay an initial retainer of ${{retainerAmount}} upon execution of this Agreement. The retainer will be applied against fees as they are earned.\n\n4. COMMUNICATION\nThe Firm will communicate with Client primarily via email at {{clientEmail}}. Client agrees to respond to communications within a reasonable time.\n\n5. CONFIDENTIALITY\nThe Firm will maintain the confidentiality of all information provided by Client in accordance with applicable professional responsibility rules.\n\n6. TERMINATION\nEither party may terminate this Agreement upon written notice. Client remains responsible for fees incurred prior to termination.\n\nIN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.\n\n_______________________________\nMaggi May Broussard, Esq.\nBroussard Legal Services\n\n_______________________________\n{{clientName}}\nDate: {{agreementDate}}',
    ARRAY['{{clientName}}', '{{clientEmail}}', '{{caseName}}', '{{serviceType}}', '{{agreementDate}}', '{{retainerAmount}}'],
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Retainer template
  INSERT INTO public.document_templates (id, template_type, name, description, body, variables, is_default)
  VALUES (
    gen_random_uuid(),
    'retainer',
    'Monthly Retainer Agreement',
    'Ongoing retainer arrangement for clients requiring regular legal support.',
    E'RETAINER AGREEMENT\n\nThis Retainer Agreement ("Agreement") is entered into as of {{agreementDate}} between Broussard Legal Services ("Firm") and {{clientName}} ("Client").\n\n1. RETAINER ARRANGEMENT\nClient retains the Firm to provide ongoing legal services for the following matter(s):\n\nMatter: {{caseName}}\nService Type: {{serviceType}}\n\n2. MONTHLY RETAINER FEE\nClient agrees to pay a monthly retainer fee of ${{retainerAmount}}, due on the 1st of each month. This fee covers up to {{includedHours}} hours of legal services per month.\n\n3. ADDITIONAL HOURS\nHours in excess of the included monthly hours will be billed at the Firm''s standard hourly rate.\n\n4. RETAINER TERM\nThis Agreement commences on {{startDate}} and continues on a month-to-month basis until terminated by either party with 30 days written notice.\n\n5. SCOPE\nServices covered under this retainer include: legal research, document drafting, client consultations, correspondence, and related legal work within the scope of {{serviceType}}.\n\n6. BILLING\nThe Firm will provide monthly statements detailing hours worked and services rendered. Any overage fees are due within 15 days of invoice.\n\nIN WITNESS WHEREOF, the parties have executed this Agreement.\n\n_______________________________\nMaggi May Broussard, Esq.\nBroussard Legal Services\n\n_______________________________\n{{clientName}}\nDate: {{agreementDate}}',
    ARRAY['{{clientName}}', '{{clientEmail}}', '{{caseName}}', '{{serviceType}}', '{{agreementDate}}', '{{retainerAmount}}', '{{includedHours}}', '{{startDate}}'],
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Discovery template
  INSERT INTO public.document_templates (id, template_type, name, description, body, variables, is_default)
  VALUES (
    gen_random_uuid(),
    'discovery',
    'Client Discovery & Intake Questionnaire',
    'Structured discovery document to gather all relevant case facts and client background.',
    E'CLIENT DISCOVERY QUESTIONNAIRE\n\nDate: {{agreementDate}}\nClient: {{clientName}}\nEmail: {{clientEmail}}\nFirm/Organization: {{firmName}}\nMatter: {{caseName}}\nService Type: {{serviceType}}\n\n─────────────────────────────────────────\nSECTION 1: CLIENT BACKGROUND\n─────────────────────────────────────────\n\n1. Full legal name:\n\n2. Date of birth (if applicable):\n\n3. Business entity type (if applicable):\n\n4. State of incorporation/formation (if applicable):\n\n5. Primary contact information:\n   Phone:\n   Address:\n\n─────────────────────────────────────────\nSECTION 2: MATTER OVERVIEW\n─────────────────────────────────────────\n\n6. Please describe the legal issue or matter in your own words:\n\n\n7. When did the issue first arise?\n\n8. Have you previously consulted with or retained another attorney on this matter? If yes, please explain:\n\n9. Are there any pending deadlines, court dates, or filing deadlines we should be aware of?\n\n─────────────────────────────────────────\nSECTION 3: RELEVANT PARTIES\n─────────────────────────────────────────\n\n10. List all parties involved (opposing parties, witnesses, related entities):\n\n\n11. Are any of the parties represented by counsel? If yes, provide attorney contact information:\n\n─────────────────────────────────────────\nSECTION 4: DOCUMENTS & EVIDENCE\n─────────────────────────────────────────\n\n12. List all documents you have that are relevant to this matter:\n\n\n13. Are there documents you are aware of but do not currently have access to?\n\n─────────────────────────────────────────\nSECTION 5: GOALS & EXPECTATIONS\n─────────────────────────────────────────\n\n14. What outcome are you hoping to achieve?\n\n\n15. Are there any constraints (budget, timeline, relationship preservation) we should factor into our approach?\n\n16. How do you prefer to communicate? (Email / Phone / Portal messages)\n\n─────────────────────────────────────────\nCLIENT CERTIFICATION\n─────────────────────────────────────────\n\nI certify that the information provided above is accurate and complete to the best of my knowledge.\n\n_______________________________\n{{clientName}}\nDate: {{agreementDate}}',
    ARRAY['{{clientName}}', '{{clientEmail}}', '{{firmName}}', '{{caseName}}', '{{serviceType}}', '{{agreementDate}}'],
    true
  )
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
