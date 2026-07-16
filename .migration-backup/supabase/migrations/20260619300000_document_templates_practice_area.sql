-- Add practice_area column to document_templates
-- Supports: litigation, contracts, discovery

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS practice_area TEXT NOT NULL DEFAULT 'contracts'
    CHECK (practice_area IN ('litigation', 'contracts', 'discovery'));

-- Back-fill existing rows
UPDATE public.document_templates
  SET practice_area = CASE
    WHEN template_type = 'discovery' THEN 'discovery'
    WHEN template_type = 'retainer'  THEN 'contracts'
    ELSE 'contracts'
  END
WHERE practice_area = 'contracts';

CREATE INDEX IF NOT EXISTS idx_document_templates_practice_area
  ON public.document_templates (practice_area);

-- ── Seed default litigation templates ─────────────────────────────────────────

DO $$
BEGIN
  -- Motion to Dismiss
  INSERT INTO public.document_templates (template_type, practice_area, name, description, body, variables, is_default)
  VALUES (
    'contract',
    'litigation',
    'Motion to Dismiss',
    'Standard motion to dismiss for failure to state a claim under Rule 12(b)(6).',
    E'MOTION TO DISMISS\n\nCourt: {{courtName}}\nCase No.: {{caseNumber}}\nDate: {{filingDate}}\n\nIN THE MATTER OF:\n{{clientName}} v. {{opposingParty}}\n\n─────────────────────────────────────────\nI. INTRODUCTION\n─────────────────────────────────────────\n\nDefendant {{clientName}} respectfully moves this Court pursuant to Rule 12(b)(6) to dismiss the Complaint filed by {{opposingParty}} for failure to state a claim upon which relief can be granted.\n\n─────────────────────────────────────────\nII. STATEMENT OF FACTS\n─────────────────────────────────────────\n\n{{caseName}}: [Insert relevant facts here]\n\n─────────────────────────────────────────\nIII. LEGAL STANDARD\n─────────────────────────────────────────\n\nTo survive a motion to dismiss, a complaint must contain sufficient factual matter, accepted as true, to state a claim to relief that is plausible on its face. Ashcroft v. Iqbal, 556 U.S. 662, 678 (2009).\n\n─────────────────────────────────────────\nIV. ARGUMENT\n─────────────────────────────────────────\n\n[Insert legal argument here]\n\n─────────────────────────────────────────\nV. CONCLUSION\n─────────────────────────────────────────\n\nFor the foregoing reasons, {{clientName}} respectfully requests that this Court dismiss the Complaint with prejudice and award such other relief as the Court deems just and proper.\n\nRespectfully submitted,\n\n_______________________________\nMaggi May Broussard, Esq.\nBroussard Legal Services\nDate: {{filingDate}}',
    ARRAY['{{clientName}}', '{{opposingParty}}', '{{courtName}}', '{{caseNumber}}', '{{caseName}}', '{{filingDate}}'],
    true
  );

  -- Discovery Request (Interrogatories)
  INSERT INTO public.document_templates (template_type, practice_area, name, description, body, variables, is_default)
  VALUES (
    'discovery',
    'litigation',
    'Interrogatories — Litigation',
    'Standard set of interrogatories for litigation matters.',
    E'PLAINTIFF''S FIRST SET OF INTERROGATORIES\n\nCourt: {{courtName}}\nCase No.: {{caseNumber}}\nDate: {{filingDate}}\n\nTO: {{respondingParty}}\n\nPursuant to the applicable rules of civil procedure, {{requestingParty}} requests that {{respondingParty}} answer the following interrogatories under oath within {{responseDeadline}} days of service.\n\n─────────────────────────────────────────\nDEFINITIONS\n─────────────────────────────────────────\n\n"You" and "Your" refer to {{respondingParty}} and all agents, representatives, and persons acting on their behalf.\n\n─────────────────────────────────────────\nINTERROGATORIES\n─────────────────────────────────────────\n\nINTERROGATORY NO. 1:\nIdentify all persons with knowledge of the facts alleged in the Complaint.\n\nINTERROGATORY NO. 2:\nDescribe in detail all communications between You and {{requestingParty}} related to {{caseName}}.\n\nINTERROGATORY NO. 3:\nIdentify all documents that support Your defenses in this action.\n\nINTERROGATORY NO. 4:\n[Insert additional interrogatory]\n\n─────────────────────────────────────────\nCERTIFICATION\n─────────────────────────────────────────\n\n_______________________________\nMaggi May Broussard, Esq.\nBroussard Legal Services\nDate: {{filingDate}}',
    ARRAY['{{clientName}}', '{{courtName}}', '{{caseNumber}}', '{{caseName}}', '{{filingDate}}', '{{requestingParty}}', '{{respondingParty}}', '{{responseDeadline}}'],
    false
  );

  -- Demand Letter
  INSERT INTO public.document_templates (template_type, practice_area, name, description, body, variables, is_default)
  VALUES (
    'contract',
    'litigation',
    'Pre-Litigation Demand Letter',
    'Formal demand letter sent before filing suit to resolve a dispute.',
    E'DEMAND LETTER\n\nDate: {{filingDate}}\n\nVIA CERTIFIED MAIL\n\n{{opposingParty}}\n[Address]\n\nRe: Demand for {{reliefSought}} — {{caseName}}\n\nDear {{opposingParty}},\n\nThis firm represents {{clientName}} in connection with the above-referenced matter. We write to demand that you {{reliefSought}} no later than 30 days from the date of this letter.\n\n─────────────────────────────────────────\nFACTUAL BACKGROUND\n─────────────────────────────────────────\n\n[Insert factual background here]\n\n─────────────────────────────────────────\nLEGAL BASIS\n─────────────────────────────────────────\n\n[Insert legal basis for demand here]\n\n─────────────────────────────────────────\nDEMAND\n─────────────────────────────────────────\n\nAccordingly, we demand that you {{reliefSought}} within 30 days of the date of this letter. Failure to comply will result in our client pursuing all available legal remedies, including filing suit in {{courtName}} without further notice.\n\nPlease govern yourself accordingly.\n\nSincerely,\n\n_______________________________\nMaggi May Broussard, Esq.\nBroussard Legal Services',
    ARRAY['{{clientName}}', '{{opposingParty}}', '{{caseName}}', '{{courtName}}', '{{filingDate}}', '{{reliefSought}}'],
    false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
