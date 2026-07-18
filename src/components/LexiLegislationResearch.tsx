'use client';

import React, { useState, useCallback } from 'react';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming'
];

const QUICK_RESEARCH_PROMPTS = [
  { label: 'LA Employment Law', query: 'Current Louisiana employment law conflicts with federal FLSA and Title VII — what should employers and employees know?' },
  { label: 'Federal Preemption', query: 'Explain federal preemption doctrine and give examples of where federal law overrides Louisiana state law.' },
  { label: 'Business Regulations', query: 'Recent federal business legislation affecting Louisiana small businesses in 2024-2025.' },
  { label: 'Real Estate Law', query: 'Federal vs Louisiana real estate law conflicts — landlord-tenant, fair housing, and property rights.' },
  { label: 'Consumer Protection', query: 'Federal consumer protection laws (FTC, CFPB) vs Louisiana consumer protection statutes — key differences.' },
  { label: 'Civil Rights', query: 'Federal civil rights legislation and how it interacts with Louisiana state civil rights laws.' },
];

interface ResearchResult {
  query: string;
  response: string;
  timestamp: Date;
  state?: string;
}

export default function LexiLegislationResearch() {
  const [query, setQuery] = useState('');
  const [selectedState, setSelectedState] = useState('Louisiana');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflictMode, setConflictMode] = useState(false);

  const handleResearch = useCallback(async (researchQuery?: string) => {
    const q = researchQuery || query;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const systemPrompt = `You are Lexi, a legal research assistant at Broussard Legal Services specializing in federal and state legislation. You have access to Congress.gov data and current legal databases. 

When researching legislation:
1. Cite specific bill numbers, statutes, and code sections
2. Identify federal-state conflicts clearly
3. Note Louisiana-specific implications when relevant
4. Always include: "This is general legal information, not legal advice. Consult with Attorney Broussard for case-specific guidance."
4. Use Bluebook citation format
5. Be comprehensive but concise`;

      const fullQuery = conflictMode
        ? `Analyze federal-state law conflicts for ${selectedState} regarding: ${q}. Identify specific conflicts, which law controls, and practical implications.`
        : `Research legislation for ${selectedState}: ${q}`;

      const response = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'PERPLEXITY',
          model: 'perplexity/llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullQuery }
          ],
          max_tokens: 2000,
        }),
      });
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || data?.content || 'No response received.';
      setResults((prev) => [
        { query: q, response: content, timestamp: new Date(), state: selectedState },
        ...prev,
      ]);
      setQuery('');
    } catch {
      setResults((prev) => [
        { query: q, response: 'Research failed. Please try again.', timestamp: new Date() },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedState, conflictMode]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-lg">⚖️</div>
        <div>
          <h3 className="font-semibold text-foreground">Congress.gov Legislation Research</h3>
          <p className="text-xs text-muted-foreground">Real-time federal & state legislation via Perplexity AI</p>
        </div>
        <a
          href="/legislation"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto px-4 py-2 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-xl text-xs font-semibold hover:bg-[#1B2A4A]/20 transition-all"
        >
          Full Legislation Page →
        </a>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-amber-800 text-xs">⚠️ <strong>Paralegal Disclaimer:</strong> Research provided by Lexi is general legal information under attorney supervision. Not legal advice. All research is reviewed by a licensed attorney before use in client matters.</p>
      </div>

      {/* Search Controls */}
      <div className="bg-secondary/30 rounded-2xl p-4 space-y-3">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setConflictMode(false)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${!conflictMode ? 'bg-[#1B2A4A] text-white' : 'bg-white text-muted-foreground border border-border hover:border-[#1B2A4A]/30'}`}
          >
            🏛️ Legislation Search
          </button>
          <button
            onClick={() => setConflictMode(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${conflictMode ? 'bg-[#B76E79] text-white' : 'bg-white text-muted-foreground border border-border hover:border-[#B76E79]/30'}`}
          >
            ⚡ Conflict Detection
          </button>
        </div>

        {/* State Selector */}
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
        >
          <option value="">All States (Federal)</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Query Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            placeholder={conflictMode ? 'Enter topic to find federal-state conflicts...' : 'Search legislation, bill, or legal topic...'}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={() => handleResearch()}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-[#1B2A4A] text-white rounded-xl text-xs font-semibold hover:bg-[#1B2A4A]/90 transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? '⏳' : '🔍 Search'}
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RESEARCH_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleResearch(p.query)}
              disabled={loading}
              className="px-2.5 py-1 bg-white border border-border rounded-full text-xs text-muted-foreground hover:text-[#1B2A4A] hover:border-[#1B2A4A]/30 transition-all disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-4 px-4 bg-[#1B2A4A]/5 rounded-xl">
          <div className="w-5 h-5 border-2 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Lexi is researching legislation...</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-[#1B2A4A] text-sm">{result.query}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {result.state && <span className="mr-2">📍 {result.state}</span>}
                    {result.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-full text-xs font-semibold">Lexi</span>
              </div>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-t border-border pt-3">
                {result.response}
              </div>
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground italic">⚠️ General legal information only. Not legal advice. Supervised by licensed attorney.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Direct Links */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Congress.gov', url: 'https://www.congress.gov', icon: '🏛️' },
          { label: 'Louisiana Legislature', url: 'https://www.legis.la.gov', icon: '⚖️' },
          { label: 'Cornell LII', url: 'https://www.law.cornell.edu', icon: '📖' },
          { label: 'GovTrack', url: 'https://www.govtrack.us', icon: '📊' },
        ].map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 bg-secondary/40 rounded-xl text-xs font-medium text-foreground hover:bg-secondary transition-all border border-border"
          >
            <span>{link.icon}</span>
            {link.label} →
          </a>
        ))}
      </div>
    </div>
  );
}
