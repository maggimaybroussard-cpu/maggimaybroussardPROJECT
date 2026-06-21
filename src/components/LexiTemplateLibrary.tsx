'use client';

import React, { useState } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateId = 'retainer_contingency' | 'retainer_hourly' | 'retainer_flat' | 'engagement_letter' | 'disengagement_letter' | 'hipaa_authorization' | 'demand_letter_pi' | 'settlement_agreement' | 'nda' | 'intake_questionnaire';
type TemplateStep = 'select' | 'fill' | 'generating' | 'review';

interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

interface Template {
  id: TemplateId;
  label: string;
  icon: string;
  category: string;
  description: string;
  fields: TemplateField[];
}

const TEMPLATES: Template[] = [
  {
    id: 'retainer_contingency',
    label: 'Retainer Agreement — Contingency',
    icon: '📋',
    category: 'Fee Agreements',
    description: 'Contingency fee retainer for PI, employment, or tort matters',
    fields: [
      { id: 'clientName', label: 'Client Full Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'clientAddress', label: 'Client Address', placeholder: '123 Main St, New Orleans, LA 70112', type: 'text' },
      { id: 'matterDescription', label: 'Matter Description', placeholder: 'Personal injury claim arising from automobile accident on...', type: 'textarea', required: true },
      { id: 'contingencyPct', label: 'Contingency Percentage', placeholder: '33.33', type: 'number', required: true },
      { id: 'contingencyPctTrial', label: 'Contingency % If Trial', placeholder: '40', type: 'number' },
      { id: 'expenseReimbursement', label: 'Expense Reimbursement', placeholder: 'Client responsible for court costs, filing fees, expert fees', type: 'textarea' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'retainer_hourly',
    label: 'Retainer Agreement — Hourly',
    icon: '⏱️',
    category: 'Fee Agreements',
    description: 'Hourly billing retainer with trust account provisions',
    fields: [
      { id: 'clientName', label: 'Client Full Name', placeholder: 'Jane B. Doe', type: 'text', required: true },
      { id: 'clientAddress', label: 'Client Address', placeholder: '456 Oak Ave, Baton Rouge, LA 70801', type: 'text' },
      { id: 'matterDescription', label: 'Matter Description', placeholder: 'Business contract dispute...', type: 'textarea', required: true },
      { id: 'hourlyRate', label: 'Attorney Hourly Rate ($)', placeholder: '350', type: 'number', required: true },
      { id: 'paralegalRate', label: 'Paralegal Rate ($)', placeholder: '125', type: 'number' },
      { id: 'retainerAmount', label: 'Initial Retainer Amount ($)', placeholder: '2500', type: 'number', required: true },
      { id: 'billingCycle', label: 'Billing Cycle', placeholder: '', type: 'select', options: ['Monthly', 'Bi-monthly', 'Upon request'] },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'retainer_flat',
    label: 'Retainer Agreement — Flat Fee',
    icon: '💰',
    category: 'Fee Agreements',
    description: 'Flat fee agreement for defined scope matters',
    fields: [
      { id: 'clientName', label: 'Client Full Name', placeholder: 'Robert C. Johnson', type: 'text', required: true },
      { id: 'matterDescription', label: 'Scope of Services', placeholder: 'Drafting and review of commercial lease agreement...', type: 'textarea', required: true },
      { id: 'flatFeeAmount', label: 'Flat Fee Amount ($)', placeholder: '1500', type: 'number', required: true },
      { id: 'paymentSchedule', label: 'Payment Schedule', placeholder: '50% due upon signing, 50% upon completion', type: 'textarea' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'engagement_letter',
    label: 'Engagement Letter',
    icon: '✉️',
    category: 'Client Letters',
    description: 'Formal engagement letter confirming attorney-client relationship',
    fields: [
      { id: 'clientName', label: 'Client Name', placeholder: 'Smith Family Trust', type: 'text', required: true },
      { id: 'clientAddress', label: 'Client Address', placeholder: '789 Elm St, Shreveport, LA 71101', type: 'text' },
      { id: 'matterDescription', label: 'Matter Description', placeholder: 'Estate planning and trust administration...', type: 'textarea', required: true },
      { id: 'scopeOfServices', label: 'Scope of Services', placeholder: 'Drafting last will and testament, revocable living trust, powers of attorney...', type: 'textarea' },
      { id: 'feeArrangement', label: 'Fee Arrangement', placeholder: 'Flat fee of $2,500 for complete estate plan', type: 'textarea' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'disengagement_letter',
    label: 'Disengagement Letter',
    icon: '📤',
    category: 'Client Letters',
    description: 'Formal letter terminating the attorney-client relationship',
    fields: [
      { id: 'clientName', label: 'Client Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'clientAddress', label: 'Client Address', placeholder: '123 Main St, New Orleans, LA 70112', type: 'text' },
      { id: 'matterDescription', label: 'Matter Description', placeholder: 'Personal injury claim...', type: 'textarea', required: true },
      { id: 'terminationReason', label: 'Reason for Termination', placeholder: 'Completion of services / client request / non-payment / conflict of interest', type: 'select', options: ['Completion of services', 'Client request', 'Non-payment of fees', 'Conflict of interest', 'Irreconcilable differences', 'Other'] },
      { id: 'fileReturnInstructions', label: 'File Return Instructions', placeholder: 'Your file will be available for pickup within 30 days...', type: 'textarea' },
      { id: 'pendingDeadlines', label: 'Pending Deadlines to Note', placeholder: 'Prescription deadline of [DATE] — client must retain new counsel immediately', type: 'textarea' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'hipaa_authorization',
    label: 'HIPAA Medical Records Authorization',
    icon: '🏥',
    category: 'Authorizations',
    description: 'HIPAA-compliant authorization for release of medical records',
    fields: [
      { id: 'patientName', label: 'Patient Full Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'dateOfBirth', label: 'Date of Birth', placeholder: '', type: 'date', required: true },
      { id: 'providerName', label: 'Healthcare Provider / Facility', placeholder: 'Tulane Medical Center', type: 'text', required: true },
      { id: 'providerAddress', label: 'Provider Address', placeholder: '1415 Tulane Ave, New Orleans, LA 70112', type: 'text' },
      { id: 'recordsRequested', label: 'Records Requested', placeholder: 'All medical records, treatment notes, imaging, lab results from [DATE] to present', type: 'textarea', required: true },
      { id: 'purposeOfDisclosure', label: 'Purpose of Disclosure', placeholder: 'Legal representation in personal injury matter', type: 'text' },
      { id: 'expirationDate', label: 'Authorization Expiration Date', placeholder: '', type: 'date' },
    ],
  },
  {
    id: 'demand_letter_pi',
    label: 'Demand Letter — Personal Injury',
    icon: '⚖️',
    category: 'Demand Letters',
    description: 'Pre-litigation demand letter with damages summary',
    fields: [
      { id: 'clientName', label: 'Client / Claimant Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'recipientName', label: 'Recipient / Adjuster Name', placeholder: 'Claims Adjuster, ABC Insurance Co.', type: 'text', required: true },
      { id: 'claimNumber', label: 'Claim Number', placeholder: 'CLM-2024-00123', type: 'text' },
      { id: 'incidentDate', label: 'Date of Incident', placeholder: '', type: 'date', required: true },
      { id: 'incidentDescription', label: 'Incident Description', placeholder: 'On [date], our client was involved in a motor vehicle accident at the intersection of...', type: 'textarea', required: true },
      { id: 'injuries', label: 'Injuries Sustained', placeholder: 'Cervical strain, lumbar herniation, soft tissue injuries...', type: 'textarea', required: true },
      { id: 'medicalExpenses', label: 'Medical Expenses ($)', placeholder: '15000', type: 'number' },
      { id: 'lostWages', label: 'Lost Wages ($)', placeholder: '5000', type: 'number' },
      { id: 'demandAmount', label: 'Total Demand Amount ($)', placeholder: '75000', type: 'number', required: true },
      { id: 'responseDeadline', label: 'Response Deadline', placeholder: '', type: 'date' },
    ],
  },
  {
    id: 'settlement_agreement',
    label: 'Settlement Agreement & Release',
    icon: '🤝',
    category: 'Agreements',
    description: 'Full and final settlement agreement with release of all claims',
    fields: [
      { id: 'claimantName', label: 'Claimant / Plaintiff Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'releasedParty', label: 'Released Party / Defendant', placeholder: 'ABC Corporation', type: 'text', required: true },
      { id: 'matterDescription', label: 'Matter Description', placeholder: 'Claims arising from employment dispute...', type: 'textarea', required: true },
      { id: 'settlementAmount', label: 'Settlement Amount ($)', placeholder: '50000', type: 'number', required: true },
      { id: 'paymentTerms', label: 'Payment Terms', placeholder: 'Lump sum within 30 days of execution', type: 'textarea' },
      { id: 'releasedClaims', label: 'Claims Being Released', placeholder: 'All claims, known and unknown, arising from employment relationship...', type: 'textarea' },
      { id: 'confidentiality', label: 'Confidentiality Provision', placeholder: 'Parties agree to keep terms confidential...', type: 'textarea' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'nda',
    label: 'Non-Disclosure Agreement (NDA)',
    icon: '🔒',
    category: 'Agreements',
    description: 'Mutual or one-way NDA for business or employment contexts',
    fields: [
      { id: 'disclosingParty', label: 'Disclosing Party', placeholder: 'Broussard Enterprises, LLC', type: 'text', required: true },
      { id: 'receivingParty', label: 'Receiving Party', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'ndaType', label: 'NDA Type', placeholder: '', type: 'select', options: ['Mutual (both parties)', 'One-way (disclosing → receiving)'], required: true },
      { id: 'purposeOfDisclosure', label: 'Purpose of Disclosure', placeholder: 'Evaluation of potential business partnership...', type: 'textarea', required: true },
      { id: 'confidentialInfo', label: 'Definition of Confidential Information', placeholder: 'Business plans, financial data, trade secrets, customer lists...', type: 'textarea' },
      { id: 'term', label: 'Term / Duration', placeholder: '2 years from effective date', type: 'text' },
      { id: 'effectiveDate', label: 'Effective Date', placeholder: '', type: 'date', required: true },
    ],
  },
  {
    id: 'intake_questionnaire',
    label: 'Client Intake Questionnaire',
    icon: '📝',
    category: 'Intake',
    description: 'Comprehensive intake form for new client matters',
    fields: [
      { id: 'practiceArea', label: 'Practice Area', placeholder: '', type: 'select', options: ['Personal Injury', 'Business Law', 'Employment Law', 'Real Estate', 'Estate Planning', 'Contract Dispute', 'Other'], required: true },
      { id: 'clientName', label: 'Client Name', placeholder: 'John A. Smith', type: 'text', required: true },
      { id: 'additionalParties', label: 'Other Parties Involved', placeholder: 'Opposing party names, employers, insurance companies...', type: 'textarea' },
      { id: 'matterDescription', label: 'Brief Matter Description', placeholder: 'Describe the situation in your own words...', type: 'textarea', required: true },
      { id: 'dateOfIncident', label: 'Date of Incident / Key Event', placeholder: '', type: 'date' },
      { id: 'priorAttorney', label: 'Prior Attorney (if any)', placeholder: 'Name and firm of any prior attorney on this matter', type: 'text' },
      { id: 'urgency', label: 'Urgency Level', placeholder: '', type: 'select', options: ['Immediate (deadline within 30 days)', 'Urgent (deadline within 90 days)', 'Standard', 'Planning ahead'] },
    ],
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

export default function LexiTemplateLibrary({ prefillClientName }: { prefillClientName?: string }) {
  const [step, setStep] = useState<TemplateStep>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch = !searchTerm || t.label.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    const initial: Record<string, string> = {};
    template.fields.forEach(f => {
      initial[f.id] = f.id === 'clientName' && prefillClientName ? prefillClientName : '';
    });
    setFieldValues(initial);
    setStep('fill');
  };

  const buildPrompt = () => {
    if (!selectedTemplate) return '';
    const fieldSummary = selectedTemplate.fields.map(f => `${f.label}: ${fieldValues[f.id] || '[Not provided]'}`).join('\n');
    return `You are Lexi, a professional legal secretary at Broussard Legal Services. Generate a complete, professional ${selectedTemplate.label} using the following information.

TEMPLATE: ${selectedTemplate.label}
CATEGORY: ${selectedTemplate.category}

PROVIDED INFORMATION:
${fieldSummary}

REQUIREMENTS:
1. Generate a complete, ready-to-use legal document
2. Use formal legal language appropriate for Louisiana practice
3. Include all standard provisions for this document type
4. Insert [PLACEHOLDER] for any missing required information
5. Use proper document structure with numbered sections where appropriate
6. Include signature blocks for all parties
7. Add: "PREPARED BY: Lexi (AI Draft — Attorney Review Required Before Use)"
8. Format for Times New Roman 12pt, Letter size

Generate the complete ${selectedTemplate.label} now:`;
  };

  const generateDocument = async () => {
    const missingRequired = selectedTemplate?.fields.filter(f => f.required && !fieldValues[f.id]?.trim()) || [];
    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }
    setIsGenerating(true);
    setStep('generating');
    try {
      const result = await getChatCompletion([{ role: 'user', content: buildPrompt() }], {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 2500,
      });
      setGeneratedDoc(result || '');
      setStep('review');
    } catch {
      toast.error('Generation failed — please try again');
      setStep('fill');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${selectedTemplate?.label}</title>
    <style>@page{size:8.5in 11in;margin:1in 1.25in}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;line-height:2}pre{white-space:pre-wrap;font-family:'Times New Roman',serif;font-size:12pt;line-height:2}</style>
    </head><body><pre>${generatedDoc}</pre></body></html>`);
    win.document.close();
    win.print();
  };

  const handleDownload = () => {
    const blob = new Blob([generatedDoc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.label.replace(/\s+/g, '_') || 'Document'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📚</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Document Template Library</p>
              <p className="text-[10px] text-muted-foreground">{TEMPLATES.length} professional legal templates — auto-populated from matter data</p>
            </div>
          </div>
          {step !== 'select' && (
            <button onClick={() => { setStep('select'); setSelectedTemplate(null); setGeneratedDoc(''); }} className="text-xs text-primary hover:underline">← Templates</button>
          )}
        </div>
      </div>

      {/* Select Template */}
      {step === 'select' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search templates…"
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex gap-1.5 mt-2 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 space-y-2">
            {filteredTemplates.map(template => (
              <button key={template.id} onClick={() => selectTemplate(template)}
                className="w-full p-3 bg-card border border-border rounded-xl text-left hover:border-primary/40 hover:bg-primary/3 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-foreground">{template.label}</p>
                      <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[9px]">{template.category}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{template.description}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">{template.fields.length} fields · {template.fields.filter(f => f.required).length} required</p>
                  </div>
                  <span className="text-primary text-xs">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Fields */}
      {step === 'fill' && selectedTemplate && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedTemplate.icon}</span>
              <div>
                <p className="text-xs font-semibold text-foreground">{selectedTemplate.label}</p>
                <p className="text-[10px] text-muted-foreground">{selectedTemplate.description}</p>
              </div>
            </div>
          </div>
          {selectedTemplate.fields.map(field => (
            <div key={field.id}>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea value={fieldValues[field.id] || ''} onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder} rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              ) : field.type === 'select' ? (
                <select value={fieldValues[field.id] || ''} onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select…</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input type={field.type} value={fieldValues[field.id] || ''} onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              )}
            </div>
          ))}
          <button onClick={generateDocument}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors mt-2">
            Generate {selectedTemplate.label} →
          </button>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Generating {selectedTemplate?.label}…</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-populating from your matter data</p>
          </div>
        </div>
      )}

      {/* Review */}
      {step === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center gap-2 shrink-0">
            <button onClick={handlePrint} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">🖨️ Print/PDF</button>
            <button onClick={handleDownload} className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-secondary/80">📄 Download</button>
            <button onClick={() => { navigator.clipboard.writeText(generatedDoc); toast.success('Copied!'); }}
              className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-secondary/80">📋 Copy</button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <textarea value={generatedDoc} onChange={e => setGeneratedDoc(e.target.value)}
              className="w-full h-full bg-background border border-border rounded-xl p-4 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt' }} />
          </div>
        </div>
      )}
    </div>
  );
}
