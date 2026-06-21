'use client';

import React, { useState } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import LexiLegalResearch from '@/components/LexiLegalResearch';

import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewStep = 'upload' | 'analyzing' | 'results';
type ReviewMode = 'contract' | 'deposition' | 'discovery' | 'filing' | 'comparable';

interface RiskyClause {
  clause: string;
  risk: 'high' | 'medium' | 'low';
  explanation: string;
  recommendation: string;
}

interface ReviewResult {
  mode: ReviewMode;
  summary: string;
  riskyClauses: RiskyClause[];
  keyFacts: string[];
  missingProvisions: string[];
  recommendations: string[];
  rawAnalysis: string;
}

const REVIEW_MODES: Array<{ id: ReviewMode; label: string; icon: string; description: string; placeholder: string }> = [
  {
    id: 'contract',
    label: 'Contract Review',
    icon: '📋',
    description: 'Flag risky clauses, missing provisions, and discrepancies',
    placeholder: 'Paste the contract text here for Lexi to review...',
  },
  {
    id: 'deposition',
    label: 'Deposition Summary',
    icon: '🎙️',
    description: 'Summarize key testimony and extract facts for your matter',
    placeholder: 'Paste the deposition transcript here...',
  },
  {
    id: 'discovery',
    label: 'Discovery Response Review',
    icon: '🔍',
    description: 'Summarize discovery responses and flag incomplete answers',
    placeholder: 'Paste the discovery responses here...',
  },
  {
    id: 'filing',
    label: "Opposing Counsel's Filing",
    icon: '⚖️',
    description: 'Analyze opposing filing for weaknesses and key arguments',
    placeholder: "Paste opposing counsel's motion or brief here...",
  },
  {
    id: 'comparable',
    label: 'Comparable Case Analysis',
    icon: '📊',
    description: 'Pull comparable cases from matter history for settlement estimates',
    placeholder: 'Describe the matter facts for comparable case analysis...',
  },
];

function buildReviewPrompt(mode: ReviewMode, content: string, context: string): string {
  const modeLabel = REVIEW_MODES.find(m => m.id === mode)?.label || mode;

  if (mode === 'contract') {
    return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Perform a thorough contract review of the following document.

${context ? `MATTER CONTEXT: ${context}\n` : ''}
CONTRACT TEXT:
${content}

Provide a structured analysis in the following JSON format:
{
  "summary": "2-3 sentence executive summary of the document",
  "riskyClauses": [
    {"clause": "exact clause or section", "risk": "high|medium|low", "explanation": "why this is risky", "recommendation": "what to do"}
  ],
  "missingProvisions": ["list of standard provisions that are absent"],
  "keyFacts": ["key terms, parties, dates, amounts"],
  "recommendations": ["actionable recommendations for the attorney"]
}

Focus on: indemnification, limitation of liability, termination rights, dispute resolution, governing law, payment terms, IP ownership, confidentiality, non-compete/non-solicitation, and any unusual or one-sided provisions.`;
  }

  if (mode === 'deposition') {
    return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Summarize the following deposition transcript.

${context ? `MATTER CONTEXT: ${context}\n` : ''}
DEPOSITION TRANSCRIPT:
${content}

Provide a structured analysis in the following JSON format:
{
  "summary": "2-3 sentence overview of the deposition",
  "keyFacts": ["key admissions, facts, and testimony points in order of importance"],
  "riskyClauses": [],
  "missingProvisions": [],
  "recommendations": ["follow-up questions, areas for further discovery, inconsistencies to exploit or address"]
}`;
  }

  if (mode === 'discovery') {
    return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Review the following discovery responses.

${context ? `MATTER CONTEXT: ${context}\n` : ''}
DISCOVERY RESPONSES:
${content}

Provide a structured analysis in the following JSON format:
{
  "summary": "Overview of the discovery responses",
  "keyFacts": ["key information disclosed"],
  "riskyClauses": [{"clause": "evasive or incomplete response", "risk": "high|medium|low", "explanation": "why this is problematic", "recommendation": "how to address"}],
  "missingProvisions": ["information that was requested but not provided"],
  "recommendations": ["motions to compel, follow-up requests, areas to investigate"]
}`;
  }

  if (mode === 'filing') {
    return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Analyze the following filing from opposing counsel.

${context ? `MATTER CONTEXT: ${context}\n` : ''}
OPPOSING FILING:
${content}

Provide a structured analysis in the following JSON format:
{
  "summary": "Summary of opposing counsel's arguments and relief sought",
  "keyFacts": ["their strongest arguments", "key cases they cite", "factual assertions"],
  "riskyClauses": [{"clause": "their argument or assertion", "risk": "high|medium|low", "explanation": "why this is a threat", "recommendation": "how to counter"}],
  "missingProvisions": ["weaknesses in their argument", "cases they failed to cite", "facts they ignored"],
  "recommendations": ["response strategy", "counter-arguments", "additional research needed"]
}`;
  }

  return `You are Lexi, a highly experienced legal secretary at Broussard Legal Services. Analyze the following matter for comparable cases and settlement estimates.

${context ? `MATTER CONTEXT: ${context}\n` : ''}
MATTER DESCRIPTION:
${content}

Provide a structured analysis in the following JSON format:
{
  "summary": "Overview of the matter type and comparable value range",
  "keyFacts": ["relevant comparable cases with citations and settlement/verdict amounts", "factors that increase value", "factors that decrease value"],
  "riskyClauses": [],
  "missingProvisions": ["additional information needed for accurate valuation"],
  "recommendations": ["settlement range estimate", "litigation strategy considerations", "key liability factors"]
}

Use legitimate, properly cited case law and settlement data where available.`;
}

export default function LexiDocumentReview({ prefillClientName, prefillCaseRef }: { prefillClientName?: string; prefillCaseRef?: string }) {
  const [step, setStep] = useState<ReviewStep>('upload');
  const [mode, setMode] = useState<ReviewMode>('contract');
  const [content, setContent] = useState('');
  const [context, setContext] = useState(prefillClientName ? `Client: ${prefillClientName}${prefillCaseRef ? `, Case: ${prefillCaseRef}` : ''}` : '');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'risks' | 'missing' | 'recommendations'>('summary');

  const selectedMode = REVIEW_MODES.find(m => m.id === mode)!;

  const analyze = async () => {
    if (!content.trim()) { toast.error('Please paste document content to analyze'); return; }
    setIsAnalyzing(true);
    setStep('analyzing');
    try {
      const prompt = buildReviewPrompt(mode, content, context);
      const raw = await getChatCompletion([{ role: 'user', content: prompt }], {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 2000,
      });

      // Parse JSON from response
      let parsed: Partial<ReviewResult> = {};
      try {
        const jsonMatch = raw?.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = { summary: raw || '', keyFacts: [], riskyClauses: [], missingProvisions: [], recommendations: [] };
      }

      setResult({
        mode,
        summary: parsed.summary || '',
        riskyClauses: parsed.riskyClauses || [],
        keyFacts: parsed.keyFacts || [],
        missingProvisions: parsed.missingProvisions || [],
        recommendations: parsed.recommendations || [],
        rawAnalysis: raw || '',
      });
      setStep('results');
    } catch {
      toast.error('Analysis failed — please try again');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const riskColor = (risk: string) => {
    if (risk === 'high') return 'bg-red-50 border-red-200 text-red-800';
    if (risk === 'medium') return 'bg-orange-50 border-orange-200 text-orange-800';
    return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  };

  const riskBadge = (risk: string) => {
    if (risk === 'high') return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold uppercase">HIGH</span>;
    if (risk === 'medium') return <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-bold uppercase">MED</span>;
    return <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px] font-bold uppercase">LOW</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔎</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Document Review & Analysis</p>
              <p className="text-[10px] text-muted-foreground">Flag risky clauses, summarize depositions, analyze filings</p>
            </div>
          </div>
          {step !== 'upload' && (
            <button onClick={() => { setStep('upload'); setResult(null); setContent(''); }} className="text-xs text-primary hover:underline">← New Review</button>
          )}
        </div>
      </div>

      {/* Upload / Configure */}
      {step === 'upload' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode selector */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">Review Type</label>
            <div className="grid grid-cols-1 gap-2">
              {REVIEW_MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{m.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">{m.description}</p>
                    </div>
                    {mode === m.id && <span className="ml-auto text-primary text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Matter Context (optional)</label>
            <input value={context} onChange={e => setContext(e.target.value)} placeholder="Client name, case ref, relevant background..."
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Document content */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Document Content <span className="text-red-500">*</span></label>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={selectedMode.placeholder} rows={10}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString()} characters</p>
          </div>

          <button onClick={analyze} disabled={!content.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors">
            Analyze with Lexi →
          </button>

          {/* Legal Research Panel */}
          <LexiLegalResearch
            context={context || undefined}
          />
        </div>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Analyzing document…</p>
            <p className="text-xs text-muted-foreground mt-1">Lexi is reviewing for risks, key facts, and recommendations</p>
          </div>
        </div>
      )}

      {/* Results */}
      {step === 'results' && result && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Result tabs */}
          <div className="flex border-b border-border shrink-0">
            {([
              { id: 'summary', label: 'Summary' },
              { id: 'risks', label: `Risks (${result.riskyClauses.length})` },
              { id: 'missing', label: `Missing (${result.missingProvisions.length})` },
              { id: 'recommendations', label: `Actions (${result.recommendations.length})` },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-[10px] font-semibold transition-colors ${activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'summary' && (
              <div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3">
                  <p className="text-xs font-semibold text-primary mb-1">{selectedMode.icon} {selectedMode.label} — Summary</p>
                  <p className="text-xs text-foreground leading-relaxed">{result.summary}</p>
                </div>
                {result.keyFacts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Key Facts & Points</p>
                    <div className="space-y-1.5">
                      {result.keyFacts.map((fact, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-secondary/30 rounded-lg">
                          <span className="text-primary text-xs mt-0.5 shrink-0">•</span>
                          <p className="text-xs text-foreground">{fact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Legal Research Panel in results */}
                <div className="mt-4">
                  <LexiLegalResearch context={context || undefined} />
                </div>
              </div>
            )}

            {activeTab === 'risks' && (
              <div className="space-y-2">
                {result.riskyClauses.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-2xl">✅</span>
                    <p className="text-sm text-foreground mt-2">No significant risks identified</p>
                  </div>
                ) : (
                  result.riskyClauses.map((clause, i) => (
                    <div key={i} className={`border rounded-xl p-3 ${riskColor(clause.risk)}`}>
                      <div className="flex items-start gap-2 mb-1.5">
                        {riskBadge(clause.risk)}
                        <p className="text-xs font-semibold flex-1">{clause.clause}</p>
                      </div>
                      <p className="text-[10px] mb-1.5 leading-relaxed">{clause.explanation}</p>
                      <div className="bg-white/60 rounded-lg p-2">
                        <p className="text-[10px] font-semibold mb-0.5">Recommendation:</p>
                        <p className="text-[10px] leading-relaxed">{clause.recommendation}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'missing' && (
              <div className="space-y-2">
                {result.missingProvisions.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-2xl">✅</span>
                    <p className="text-sm text-foreground mt-2">No missing provisions identified</p>
                  </div>
                ) : (
                  result.missingProvisions.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <span className="text-orange-500 text-sm shrink-0">⚠️</span>
                      <p className="text-xs text-orange-800">{item}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-blue-500 text-sm shrink-0 font-bold">{i + 1}</span>
                    <p className="text-xs text-blue-800">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
