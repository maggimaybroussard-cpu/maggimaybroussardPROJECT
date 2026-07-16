'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';

interface LexiDepoPrepProps {
  clientName?: string;
  caseRef?: string;
}

const PREP_TYPES = [
  { id: 'deposition', label: 'Deposition Prep', icon: '🎙️', description: 'Prepare witness for deposition testimony' },
  { id: 'hearing', label: 'Hearing Prep', icon: '⚖️', description: 'Prepare for court hearing or motion argument' },
  { id: 'trial', label: 'Trial Prep', icon: '🏛️', description: 'Prepare for trial testimony or opening/closing' },
  { id: 'mediation', label: 'Mediation Prep', icon: '🤝', description: 'Prepare for mediation session' },
];

export default function LexiDepoPrep({ clientName, caseRef }: LexiDepoPrepProps) {
  const [prepType, setPrepType] = useState<string>('deposition');
  const [form, setForm] = useState({
    witnessName: '',
    witnessRole: 'plaintiff',
    caseDescription: '',
    keyFacts: '',
    opposingCounsel: '',
    anticipatedIssues: '',
  });
  const [prepSheet, setPrepSheet] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', false);

  React.useEffect(() => {
    if (response && !isLoading && hasRun) {
      setPrepSheet(response);
    }
  }, [response, isLoading, hasRun]);

  const handleGenerate = () => {
    if (!form.caseDescription) return;
    setHasRun(true);
    setPrepSheet(null);

    const typeConfig = PREP_TYPES.find(t => t.id === prepType);

    const prompt = `You are Lexi, a legal assistant at Broussard Legal Services. Generate a structured ${typeConfig?.label} sheet.

PREP TYPE: ${typeConfig?.label}
WITNESS/PARTY: ${form.witnessName || clientName || 'Not specified'}
ROLE: ${form.witnessRole}
CASE/MATTER: ${caseRef || 'Not specified'}
CASE DESCRIPTION: ${form.caseDescription}
KEY FACTS: ${form.keyFacts || 'Not provided'}
OPPOSING COUNSEL KNOWN TACTICS: ${form.opposingCounsel || 'Not provided'}
ANTICIPATED ISSUES: ${form.anticipatedIssues || 'Not provided'}

Generate a comprehensive ${typeConfig?.label} sheet including:

## 1. OVERVIEW & OBJECTIVES
Brief summary of what to accomplish

## 2. KEY FACTS TO ESTABLISH
Bullet list of critical facts to confirm or establish

## 3. ANTICIPATED QUESTIONS
${prepType === 'deposition' ? '10-15 likely deposition questions with suggested response guidance' : '8-10 likely questions or arguments with preparation notes'}

## 4. DOCUMENTS TO REVIEW
List of documents the witness/party should review before the ${prepType}

## 5. AREAS TO AVOID / CAUTIONS
Topics or questions that require careful handling

## 6. PREPARATION CHECKLIST
Step-by-step checklist for the day before and day of

## 7. KEY MESSAGES
3-5 core messages to communicate clearly

Format as a professional prep sheet. Be specific and practical.`;

    sendMessage([
      { role: 'system', content: 'You are Lexi, a legal assistant specializing in Louisiana law and litigation support. Generate detailed, practical preparation sheets for legal proceedings.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, max_tokens: 2000 });
  };

  const handleCopy = () => {
    if (prepSheet) navigator.clipboard.writeText(prepSheet);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/20 shrink-0">
        <h3 className="font-semibold text-foreground text-sm">Deposition & Hearing Prep Sheets</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Generate structured prep documents from case facts and discovery responses</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Prep type selector */}
        <div className="grid grid-cols-2 gap-2">
          {PREP_TYPES.map(t => (
            <button key={t.id} onClick={() => setPrepType(t.id)} className={`p-3 rounded-xl border text-left transition-all ${prepType === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
              <span className="text-base">{t.icon}</span>
              <p className="text-xs font-semibold text-foreground mt-1">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Witness / Party Name</label>
              <input value={form.witnessName} onChange={e => setForm(p => ({ ...p, witnessName: e.target.value }))} placeholder={clientName || 'Full name'} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Role</label>
              <select value={form.witnessRole} onChange={e => setForm(p => ({ ...p, witnessRole: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="plaintiff">Plaintiff</option>
                <option value="defendant">Defendant</option>
                <option value="witness">Fact Witness</option>
                <option value="expert">Expert Witness</option>
                <option value="corporate_rep">Corporate Rep</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Case Description *</label>
            <textarea value={form.caseDescription} onChange={e => setForm(p => ({ ...p, caseDescription: e.target.value }))} rows={3} placeholder="Describe the case, key allegations, and legal theories…" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Key Facts & Evidence</label>
            <textarea value={form.keyFacts} onChange={e => setForm(p => ({ ...p, keyFacts: e.target.value }))} rows={2} placeholder="Key documents, dates, witnesses, and evidence…" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Anticipated Issues / Opposing Arguments</label>
            <input value={form.anticipatedIssues} onChange={e => setForm(p => ({ ...p, anticipatedIssues: e.target.value }))} placeholder="Known weaknesses, anticipated attacks, or difficult questions…" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={handleGenerate} disabled={isLoading || !form.caseDescription} className="w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: '#355E3B', color: '#fff' }}>
            {isLoading ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Prep Sheet…</>
            ) : `📋 Generate ${PREP_TYPES.find(t => t.id === prepType)?.label} Sheet`}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error.message}</div>}

        {/* Result */}
        {(prepSheet || (isLoading && hasRun)) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
              <p className="text-xs font-semibold text-foreground">Prep Sheet</p>
              {prepSheet && (
                <button onClick={handleCopy} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
              )}
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Generating prep sheet…
                </div>
              ) : (
                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{prepSheet}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
