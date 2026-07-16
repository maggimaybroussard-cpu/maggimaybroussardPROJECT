'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';

interface LexiSettlementEstimatorProps {
  clientName?: string;
  caseRef?: string;
}

interface EstimateResult {
  lowRange: number;
  highRange: number;
  midpoint: number;
  factors: string[];
  risks: string[];
  notes: string;
  rawResponse: string;
}

const MATTER_TYPES = [
  'Personal Injury', 'Employment Discrimination', 'Wrongful Termination', 'Contract Dispute',
  'Business Litigation', 'Real Estate Dispute', 'Medical Malpractice', 'Premises Liability',
  'Wage & Hour', 'Defamation', 'Other',
];

const JURISDICTIONS = ['Louisiana State Court', 'Federal Court (5th Circuit)', 'EEOC / Administrative', 'Arbitration'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function parseEstimate(text: string): EstimateResult {
  const lowMatch = text.match(/low(?:er)?\s*(?:range|end)?[:\s]+\$?([\d,]+)/i);
  const highMatch = text.match(/high(?:er)?\s*(?:range|end)?[:\s]+\$?([\d,]+)/i);
  const rangeMatch = text.match(/\$?([\d,]+)\s*(?:to|-)\s*\$?([\d,]+)/);

  let low = 0, high = 0;
  if (lowMatch) low = parseInt(lowMatch[1].replace(/,/g, ''));
  if (highMatch) high = parseInt(highMatch[1].replace(/,/g, ''));
  if (rangeMatch && (!low || !high)) {
    low = low || parseInt(rangeMatch[1].replace(/,/g, ''));
    high = high || parseInt(rangeMatch[2].replace(/,/g, ''));
  }

  return {
    lowRange: low,
    highRange: high,
    midpoint: low && high ? Math.round((low + high) / 2) : 0,
    factors: [],
    risks: [],
    notes: text,
    rawResponse: text,
  };
}

export default function LexiSettlementEstimator({ clientName, caseRef }: LexiSettlementEstimatorProps) {
  const [form, setForm] = useState({
    matterType: '',
    jurisdiction: 'Louisiana State Court',
    damages: '',
    liability: '50',
    injuryDescription: '',
    priorOffers: '',
    additionalContext: '',
  });
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', false);

  React.useEffect(() => {
    if (response && !isLoading && hasRun) {
      setEstimate(parseEstimate(response));
    }
  }, [response, isLoading, hasRun]);

  const handleEstimate = () => {
    if (!form.matterType || !form.damages) return;
    setHasRun(true);
    setEstimate(null);

    const prompt = `You are Lexi, a legal assistant at Broussard Legal Services. Provide a settlement value estimate for the following matter.

MATTER TYPE: ${form.matterType}
JURISDICTION: ${form.jurisdiction}
CLAIMED DAMAGES: $${form.damages}
LIABILITY ASSESSMENT: ${form.liability}% (attorney's estimate of liability)
CASE DESCRIPTION: ${form.injuryDescription || 'Not provided'}
PRIOR SETTLEMENT OFFERS: ${form.priorOffers || 'None'}
ADDITIONAL CONTEXT: ${form.additionalContext || 'None'}
${clientName ? `CLIENT: ${clientName}` : ''}
${caseRef ? `MATTER REF: ${caseRef}` : ''}

Provide:
1. **Settlement Value Range** — Low range: $X, High range: $X (realistic settlement range based on comparable Louisiana/5th Circuit cases)
2. **Key Value Drivers** — 3-5 factors that increase or decrease value
3. **Risk Factors** — 2-3 risks that could affect settlement
4. **Comparable Cases** — 1-2 comparable Louisiana or 5th Circuit cases with settlement ranges
5. **Recommendation** — Brief strategic note on settlement timing and approach

IMPORTANT: This is an estimate only. Actual settlement values depend on many factors. Always advise client to consult directly with the attorney for final strategy.`;

    sendMessage([
      { role: 'system', content: 'You are Lexi, a legal assistant specializing in Louisiana law and 5th Circuit practice. Provide realistic, data-driven settlement estimates based on comparable cases.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, max_tokens: 1200 });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/20 shrink-0">
        <h3 className="font-semibold text-foreground text-sm">Settlement Value Estimator</h3>
        <p className="text-xs text-muted-foreground mt-0.5">AI-powered case value range based on matter type, jurisdiction, and comparable cases</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Matter Type *</label>
              <select value={form.matterType} onChange={e => setForm(p => ({ ...p, matterType: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select type…</option>
                {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Jurisdiction</label>
              <select value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Claimed Damages ($) *</label>
              <input type="number" value={form.damages} onChange={e => setForm(p => ({ ...p, damages: e.target.value }))} placeholder="e.g. 150000" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Liability % ({form.liability}%)</label>
              <input type="range" min={0} max={100} value={form.liability} onChange={e => setForm(p => ({ ...p, liability: e.target.value }))} className="w-full mt-2 accent-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Case Description</label>
            <textarea value={form.injuryDescription} onChange={e => setForm(p => ({ ...p, injuryDescription: e.target.value }))} rows={2} placeholder="Brief description of facts, injuries, or damages…" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Prior Offers / Negotiations</label>
            <input value={form.priorOffers} onChange={e => setForm(p => ({ ...p, priorOffers: e.target.value }))} placeholder="e.g. Defendant offered $50,000 in mediation" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={handleEstimate} disabled={isLoading || !form.matterType || !form.damages} className="w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: '#355E3B', color: '#fff' }}>
            {isLoading ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Estimating…</>
            ) : '⚖️ Estimate Settlement Value'}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error.message}</div>}

        {/* Result */}
        {(estimate || (isLoading && hasRun)) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Analyzing comparable cases…
              </div>
            ) : estimate && (
              <>
                {estimate.lowRange > 0 && estimate.highRange > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Estimated Settlement Range</p>
                    <p className="text-2xl font-bold text-primary">{fmt(estimate.lowRange)} – {fmt(estimate.highRange)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Midpoint: {fmt(estimate.midpoint)}</p>
                  </div>
                )}
                <div className="prose prose-sm max-w-none">
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{estimate.rawResponse}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">⚠️ This estimate is for informational purposes only. Actual settlement values depend on many factors. Consult directly with the attorney for final strategy.</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
