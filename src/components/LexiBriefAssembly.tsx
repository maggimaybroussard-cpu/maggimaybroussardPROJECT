'use client';

import React, { useState, useRef } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import LexiLegalResearch from '@/components/LexiLegalResearch';

// ── Types ─────────────────────────────────────────────────────────────────────

type BriefType = 'motion_to_compel' | 'motion_to_dismiss' | 'motion_summary_judgment' | 'appellate_brief' | 'memorandum_law' | 'trial_brief' | 'opposition_brief' | 'reply_brief';
type CourtType = 'louisiana_district' | 'louisiana_appellate' | 'louisiana_supreme' | 'federal_district' | 'fifth_circuit' | 'us_supreme';
type BriefStep = 'configure' | 'generating' | 'review';

interface BriefSection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

interface Citation {
  id: string;
  type: 'case' | 'statute' | 'regulation' | 'secondary';
  citation: string;
  description: string;
}

interface BriefForm {
  briefType: BriefType;
  courtType: CourtType;
  caseCaption: string;
  caseNumber: string;
  clientName: string;
  opposingParty: string;
  statementOfFacts: string;
  legalArguments: string;
  relief: string;
  customInstructions: string;
}

const BRIEF_TYPES: Array<{ id: BriefType; label: string; icon: string; sections: string[] }> = [
  { id: 'motion_to_compel', label: 'Motion to Compel', icon: '⚖️', sections: ['Caption', 'Introduction', 'Statement of Facts', 'Legal Standard', 'Argument', 'Conclusion', 'Prayer for Relief'] },
  { id: 'motion_to_dismiss', label: 'Motion to Dismiss', icon: '🚫', sections: ['Caption', 'Introduction', 'Statement of Facts', 'Legal Standard', 'Argument', 'Conclusion', 'Prayer for Relief'] },
  { id: 'motion_summary_judgment', label: 'Motion for Summary Judgment', icon: '📋', sections: ['Caption', 'Introduction', 'Statement of Undisputed Facts', 'Legal Standard', 'Argument', 'Conclusion', 'Prayer for Relief'] },
  { id: 'appellate_brief', label: 'Appellate Brief', icon: '📜', sections: ['Cover Page', 'Table of Contents', 'Table of Authorities', 'Jurisdictional Statement', 'Statement of Issues', 'Statement of Facts', 'Summary of Argument', 'Argument', 'Conclusion'] },
  { id: 'memorandum_law', label: 'Memorandum of Law', icon: '📄', sections: ['Caption', 'Introduction', 'Statement of Facts', 'Legal Analysis', 'Conclusion'] },
  { id: 'trial_brief', label: 'Trial Brief', icon: '🏛️', sections: ['Caption', 'Introduction', 'Statement of Facts', 'Legal Issues', 'Argument', 'Anticipated Defenses', 'Conclusion'] },
  { id: 'opposition_brief', label: 'Opposition Brief', icon: '🔄', sections: ['Caption', 'Introduction', 'Counter-Statement of Facts', 'Legal Standard', 'Argument', 'Conclusion'] },
  { id: 'reply_brief', label: 'Reply Brief', icon: '↩️', sections: ['Caption', 'Introduction', 'Reply Argument', 'Conclusion'] },
];

const COURT_TYPES: Array<{ id: CourtType; label: string }> = [
  { id: 'louisiana_district', label: 'Louisiana District Court' },
  { id: 'louisiana_appellate', label: 'Louisiana Court of Appeal' },
  { id: 'louisiana_supreme', label: 'Louisiana Supreme Court' },
  { id: 'federal_district', label: 'U.S. District Court (E.D. La.)' },
  { id: 'fifth_circuit', label: 'U.S. Court of Appeals (5th Cir.)' },
  { id: 'us_supreme', label: 'U.S. Supreme Court' },
];

const COMMON_CITATIONS: Citation[] = [
  { id: '1', type: 'case', citation: 'Celotex Corp. v. Catrett, 477 U.S. 317 (1986)', description: 'Summary judgment standard' },
  { id: '2', type: 'case', citation: 'Anderson v. Liberty Lobby, Inc., 477 U.S. 242 (1986)', description: 'Genuine dispute of material fact' },
  { id: '3', type: 'case', citation: 'Bell Atl. Corp. v. Twombly, 550 U.S. 544 (2007)', description: 'Plausibility pleading standard' },
  { id: '4', type: 'case', citation: 'Ashcroft v. Iqbal, 556 U.S. 662 (2009)', description: 'Pleading sufficiency' },
  { id: '5', type: 'statute', citation: 'La. Code Civ. Proc. art. 966', description: 'Louisiana summary judgment' },
  { id: '6', type: 'statute', citation: 'Fed. R. Civ. P. 56', description: 'Federal summary judgment rule' },
  { id: '7', type: 'statute', citation: 'Fed. R. Civ. P. 12(b)(6)', description: 'Motion to dismiss for failure to state a claim' },
  { id: '8', type: 'case', citation: 'McDonnell Douglas Corp. v. Green, 411 U.S. 792 (1973)', description: 'Employment discrimination burden-shifting' },
];

export default function LexiBriefAssembly({ prefillClientName, prefillCaseRef }: { prefillClientName?: string; prefillCaseRef?: string }) {
  const [step, setStep] = useState<BriefStep>('configure');
  const [form, setForm] = useState<BriefForm>({
    briefType: 'motion_to_compel',
    courtType: 'louisiana_district',
    caseCaption: '',
    caseNumber: '',
    clientName: prefillClientName || '',
    opposingParty: '',
    statementOfFacts: '',
    legalArguments: '',
    relief: '',
    customInstructions: '',
  });
  const [sections, setSections] = useState<BriefSection[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [newCitation, setNewCitation] = useState('');
  const [generatedBrief, setGeneratedBrief] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCitationPanel, setShowCitationPanel] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const selectedBriefType = BRIEF_TYPES.find(b => b.id === form.briefType)!;

  const addCitation = (cit: Citation) => {
    if (!citations.find(c => c.citation === cit.citation)) {
      setCitations(prev => [...prev, cit]);
      toast.success('Citation added to TOA');
    }
  };

  const addCustomCitation = () => {
    if (!newCitation.trim()) return;
    const cit: Citation = {
      id: Date.now().toString(),
      type: 'case',
      citation: newCitation.trim(),
      description: 'Custom citation',
    };
    setCitations(prev => [...prev, cit]);
    setNewCitation('');
    toast.success('Citation added');
  };

  const removeCitation = (id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id));
  };

  const buildBriefPrompt = () => {
    const briefLabel = selectedBriefType.label;
    const courtLabel = COURT_TYPES.find(c => c.id === form.courtType)?.label || form.courtType;
    const citationList = citations.map(c => `- ${c.citation} (${c.description})`).join('\n');

    return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Draft a complete, professional ${briefLabel} for filing in ${courtLabel}.

MATTER DETAILS:
- Document: ${briefLabel}
- Court: ${courtLabel}
- Case Caption: ${form.caseCaption || '[CASE CAPTION]'}
- Case Number: ${form.caseNumber || '[CASE NUMBER]'}
- Client/Movant: ${form.clientName || '[CLIENT NAME]'}
- Opposing Party: ${form.opposingParty || '[OPPOSING PARTY]'}

REQUIRED SECTIONS FOR THIS DOCUMENT:
${selectedBriefType.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

STATEMENT OF FACTS:
${form.statementOfFacts || '[Facts to be provided]'}

LEGAL ARGUMENTS TO DEVELOP:
${form.legalArguments || '[Arguments to be developed]'}

RELIEF REQUESTED:
${form.relief || '[Relief to be specified]'}

${citations.length > 0 ? `AUTHORITIES TO CITE (include in Table of Authorities):\n${citationList}` : ''}

${form.customInstructions ? `SPECIAL INSTRUCTIONS:\n${form.customInstructions}` : ''}

DRAFTING REQUIREMENTS:
1. Generate ALL required sections listed above in order
2. Use proper legal document structure with bold section headings in ALL CAPS
3. Include a TABLE OF CONTENTS at the beginning listing all sections with page references as [p. __]
4. Include a TABLE OF AUTHORITIES listing all cases, statutes, and secondary sources cited
5. Use formal legal language appropriate for ${courtLabel}
6. Insert [PLACEHOLDER] for specific dates, amounts, or details needing attorney input
7. Double-space body text; single-space block quotes and citations
8. Use proper Bluebook citation format for all authorities
9. End with: "Respectfully submitted, [ATTORNEY NAME], Broussard Legal Services"
10. Add: "PREPARED BY: Lexi (AI Draft — Attorney Review Required Before Filing)"

Begin the complete ${briefLabel} now:`;
  };

  const generateBrief = async () => {
    if (!form.statementOfFacts.trim()) {
      toast.error('Please provide a statement of facts');
      return;
    }
    setIsGenerating(true);
    setStep('generating');
    try {
      const prompt = buildBriefPrompt();
      const result = await getChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 3000,
      });
      setGeneratedBrief(result || '');
      setStep('review');

      // Save to Supabase
      const supabase = createClient();
      await supabase.from('lexi_document_drafts').insert({
        document_type: form.briefType,
        title: `${selectedBriefType.label} — ${form.clientName || 'Unknown Client'}`,
        client_name: form.clientName,
        case_ref: form.caseNumber,
        draft_content: result,
        status: 'draft',
      }).select().single();
    } catch {
      toast.error('Generation failed — please try again');
      setStep('configure');
    } finally {
      setIsGenerating(false);
    }
  };

  const insertSymbol = (symbol: string) => {
    if (!draftRef.current) return;
    const el = draftRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = generatedBrief.substring(0, start) + symbol + generatedBrief.substring(end);
    setGeneratedBrief(newVal);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + symbol.length;
      el.focus();
    }, 0);
  };

  const handlePrint = () => {
    const courtLabel = COURT_TYPES.find(c => c.id === form.courtType)?.label || '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${selectedBriefType.label}</title>
    <style>
      @page { size: 8.5in 11in; margin: 1in 1.25in; }
      body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; line-height: 2; }
      h1 { font-size: 14pt; text-align: center; text-transform: uppercase; }
      h2 { font-size: 12pt; text-transform: uppercase; font-weight: bold; }
      .caption { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10pt; margin-bottom: 20pt; }
      .court { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 10pt; }
      pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; }
    </style></head><body>
    <div class="court">${courtLabel}</div>
    <div class="caption">${form.caseCaption || '[CASE CAPTION]'}<br/>Case No. ${form.caseNumber || '[CASE NUMBER]'}</div>
    <pre>${generatedBrief}</pre>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const handleDownload = () => {
    const blob = new Blob([generatedBrief], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedBriefType.label.replace(/\s+/g, '_')}_${form.clientName || 'Draft'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Brief & Motion Assembly</p>
              <p className="text-[10px] text-muted-foreground">Structured legal documents with TOC & Table of Authorities</p>
            </div>
          </div>
          {step !== 'configure' && (
            <button onClick={() => { setStep('configure'); setGeneratedBrief(''); }} className="text-xs text-primary hover:underline">← New Brief</button>
          )}
        </div>
      </div>

      {/* Step: Configure */}
      {step === 'configure' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Brief Type */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              {BRIEF_TYPES.map(bt => (
                <button
                  key={bt.id}
                  onClick={() => setForm(f => ({ ...f, briefType: bt.id }))}
                  className={`p-2.5 rounded-xl border text-left transition-all ${form.briefType === bt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{bt.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{bt.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{bt.sections.length} sections</p>
                </button>
              ))}
            </div>
          </div>

          {/* Court */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Court / Jurisdiction</label>
            <select
              value={form.courtType}
              onChange={e => setForm(f => ({ ...f, courtType: e.target.value as CourtType }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {COURT_TYPES.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.label}</option>
              ))}
            </select>
          </div>

          {/* Case Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Client / Movant</label>
              <input
                value={form.clientName}
                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Client name"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Opposing Party</label>
              <input
                value={form.opposingParty}
                onChange={e => setForm(f => ({ ...f, opposingParty: e.target.value }))}
                placeholder="Opposing party"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Case Caption</label>
              <input
                value={form.caseCaption}
                onChange={e => setForm(f => ({ ...f, caseCaption: e.target.value }))}
                placeholder="Smith v. Jones"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Case Number</label>
              <input
                value={form.caseNumber}
                onChange={e => setForm(f => ({ ...f, caseNumber: e.target.value }))}
                placeholder="2024-CV-00123"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Statement of Facts */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Statement of Facts <span className="text-red-500">*</span></label>
            <textarea
              value={form.statementOfFacts}
              onChange={e => setForm(f => ({ ...f, statementOfFacts: e.target.value }))}
              placeholder="Describe the key facts of the matter — dates, parties, events, and relevant background..."
              rows={5}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Legal Arguments */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Legal Arguments to Develop</label>
            <textarea
              value={form.legalArguments}
              onChange={e => setForm(f => ({ ...f, legalArguments: e.target.value }))}
              placeholder="List the legal arguments, theories, and points of law you want Lexi to develop..."
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Relief */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Relief Requested</label>
            <input
              value={form.relief}
              onChange={e => setForm(f => ({ ...f, relief: e.target.value }))}
              placeholder="e.g., Dismiss with prejudice, compel production of documents, grant summary judgment..."
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Citations / TOA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">Table of Authorities ({citations.length})</label>
              <button onClick={() => setShowCitationPanel(!showCitationPanel)} className="text-xs text-primary hover:underline">
                {showCitationPanel ? 'Hide' : 'Add Citations'}
              </button>
            </div>
            {showCitationPanel && (
              <div className="bg-secondary/30 rounded-xl p-3 space-y-3">
                <p className="text-[10px] text-muted-foreground">Quick-add common authorities:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {COMMON_CITATIONS.map(cit => (
                    <button
                      key={cit.id}
                      onClick={() => addCitation(cit)}
                      disabled={!!citations.find(c => c.citation === cit.citation)}
                      className="flex items-center justify-between p-2 bg-background border border-border rounded-lg text-left hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <div>
                        <p className="text-[10px] font-medium text-foreground">{cit.citation}</p>
                        <p className="text-[9px] text-muted-foreground">{cit.description}</p>
                      </div>
                      <span className="text-[10px] text-primary ml-2">+ Add</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newCitation}
                    onChange={e => setNewCitation(e.target.value)}
                    placeholder="Custom citation (e.g., Smith v. Jones, 123 F.3d 456 (5th Cir. 2020))"
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    onKeyDown={e => e.key === 'Enter' && addCustomCitation()}
                  />
                  <button onClick={addCustomCitation} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">Add</button>
                </div>
              </div>
            )}
            {citations.length > 0 && (
              <div className="mt-2 space-y-1">
                {citations.map(cit => (
                  <div key={cit.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-lg">
                    <span className="text-[10px] text-foreground">{cit.citation}</span>
                    <button onClick={() => removeCitation(cit.id)} className="text-[10px] text-red-500 hover:text-red-700 ml-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legal Research Panel */}
          <LexiLegalResearch
            context={form.clientName ? `Client: ${form.clientName}${form.caseNumber ? `, Case: ${form.caseNumber}` : ''}${form.courtType ? `, Court: ${form.courtType}` : ''}` : undefined}
            onInsertCitation={(citation) => {
              const cit = {
                id: Date.now().toString(),
                type: 'case' as const,
                citation,
                description: 'From Lexi Legal Research',
              };
              if (!citations.find(c => c.citation === citation)) {
                setCitations(prev => [...prev, cit]);
              }
            }}
          />

          {/* Custom Instructions */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Special Instructions (optional)</label>
            <textarea
              value={form.customInstructions}
              onChange={e => setForm(f => ({ ...f, customInstructions: e.target.value }))}
              placeholder="Any specific formatting, tone, or content requirements..."
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Sections preview */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-primary mb-2">Document will include:</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedBriefType.sections.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-medium">{s}</span>
              ))}
            </div>
          </div>

          <button
            onClick={generateBrief}
            disabled={!form.statementOfFacts.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Generate {selectedBriefType.label} →
          </button>
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Assembling {selectedBriefType.label}…</p>
            <p className="text-xs text-muted-foreground mt-1">Generating all sections with TOC and Table of Authorities</p>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-xs font-semibold text-foreground mr-1">Export:</span>
            <button onClick={handlePrint} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">🖨️ Print/PDF</button>
            <button onClick={handleDownload} className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-secondary/80">📄 Download .txt</button>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[10px] text-muted-foreground">Insert:</span>
              {['§', '¶', 'et al.', 'id.', 'supra'].map(sym => (
                <button key={sym} onClick={() => insertSymbol(sym)} className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono hover:bg-secondary transition-colors">{sym}</button>
              ))}
            </div>
          </div>
          {/* Draft textarea */}
          <div className="flex-1 overflow-hidden p-4">
            <textarea
              ref={draftRef}
              value={generatedBrief}
              onChange={e => setGeneratedBrief(e.target.value)}
              className="w-full h-full bg-background border border-border rounded-xl p-4 text-xs text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
              style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
