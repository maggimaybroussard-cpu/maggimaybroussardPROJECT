'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type ResearchCategory = 'case_law' | 'statutes' | 'precedent' | 'all';

interface SearchResult {
  query: string;
  content: string;
  citations: string[];
  searchResults: Array<{ url: string; title: string; snippet?: string }>;
  timestamp: number;
}

interface LexiLegalResearchProps {
  context?: string;
  onInsertCitation?: (citation: string) => void;
  defaultOpen?: boolean;
}

const CATEGORY_OPTIONS: Array<{ id: ResearchCategory; label: string; icon: string; hint: string }> = [
  { id: 'case_law', label: 'Case Law', icon: '⚖️', hint: 'Search federal and state court decisions' },
  { id: 'statutes', label: 'Statutes & Codes', icon: '📚', hint: 'Search federal and Louisiana statutes' },
  { id: 'precedent', label: 'Legal Precedent', icon: '🏛️', hint: 'Find controlling and persuasive authority' },
  { id: 'all', label: 'All Sources', icon: '🔍', hint: 'Comprehensive legal research across all sources' },
];

const QUICK_SEARCHES = [
  'Summary judgment standard Louisiana',
  'Motion to dismiss 12(b)(6) Fifth Circuit',
  'Louisiana contract breach elements',
  'Personal injury damages Louisiana',
  'Employment discrimination burden shifting',
  'Negligence standard of care Louisiana',
];

function buildResearchPrompt(query: string, category: ResearchCategory, context?: string): string {
  const categoryInstructions: Record<ResearchCategory, string> = {
    case_law: 'Focus on relevant federal and state court decisions. Include case names, citations, courts, years, and key holdings. Prioritize Fifth Circuit and Louisiana courts when applicable.',
    statutes: 'Focus on relevant federal statutes (U.S.C.), Louisiana Revised Statutes (La. R.S.), Louisiana Code of Civil Procedure (La. C.C.P.), and Louisiana Civil Code (La. C.C.). Include exact code sections and current text.',
    precedent: 'Identify controlling authority (binding precedent) and persuasive authority. Distinguish between circuit splits, majority/minority positions, and recent trends. Include proper Bluebook citations.',
    all: 'Provide comprehensive legal research including case law, statutes, regulations, and secondary sources. Organize by source type. Include proper Bluebook citations for all authorities.',
  };

  return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services. Conduct thorough legal research on the following query.

RESEARCH QUERY: ${query}
RESEARCH FOCUS: ${categoryInstructions[category]}
${context ? `MATTER CONTEXT: ${context}` : ''}

Provide a structured legal research response with:

1. **SUMMARY** — 2-3 sentence overview of the legal landscape on this issue

2. **KEY AUTHORITIES** — List the most important cases, statutes, or rules with:
   - Full Bluebook citation
   - Court/jurisdiction
   - Year decided
   - Key holding or relevant provision (1-2 sentences)

3. **CONTROLLING LAW** (if applicable) — Identify the binding authority in Louisiana state courts and/or the Fifth Circuit

4. **RECENT DEVELOPMENTS** — Any notable recent cases or statutory changes (last 5 years)

5. **PRACTICE NOTES** — Practical tips for applying this law in Louisiana/Fifth Circuit practice

Format citations in proper Bluebook format. Be precise and cite only real, verifiable authorities.`;
}

export default function LexiLegalResearch({ context, onInsertCitation, defaultOpen = false }: LexiLegalResearchProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ResearchCategory>('all');
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { response, fullResponse, isLoading, error, sendMessage } = useChat(
    'PERPLEXITY',
    'perplexity/sonar-pro',
    false
  );

  useEffect(() => {
    if (error) toast.error('Legal research failed — ' + error.message);
  }, [error]);

  useEffect(() => {
    if (response && !isLoading && fullResponse) {
      const citations: string[] = (fullResponse as { citations?: string[] }).citations ?? [];
      const searchResults: Array<{ url: string; title: string; snippet?: string }> =
        (fullResponse as { search_results?: Array<{ url: string; title: string; snippet?: string }> }).search_results ?? [];

      const result: SearchResult = {
        query: query,
        content: response,
        citations,
        searchResults,
        timestamp: Date.now(),
      };
      setActiveResult(result);
      setHistory(prev => [result, ...prev.slice(0, 9)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading]);

  const handleSearch = () => {
    if (!query.trim() || isLoading) return;
    const prompt = buildResearchPrompt(query.trim(), category, context);
    sendMessage(
      [
        {
          role: 'system',
          content: 'You are a legal research assistant specializing in Louisiana law and Fifth Circuit federal practice. Always cite real, verifiable authorities in proper Bluebook format.',
        },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.2,
        max_tokens: 1500,
        web_search_options: { search_context_size: 'medium' },
      }
    );
  };

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    const prompt = buildResearchPrompt(q, category, context);
    sendMessage(
      [
        {
          role: 'system',
          content: 'You are a legal research assistant specializing in Louisiana law and Fifth Circuit federal practice. Always cite real, verifiable authorities in proper Bluebook format.',
        },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.2,
        max_tokens: 1500,
        web_search_options: { search_context_size: 'medium' },
      }
    );
  };

  const extractCitationsFromText = (text: string): string[] => {
    // Match common citation patterns: case names, statutes, rules
    const patterns = [
      /[A-Z][a-zA-Z\s&,.']+v\.\s[A-Z][a-zA-Z\s&,.']+,\s*\d+\s+[A-Z][a-zA-Z.]+\s+\d+[^,)]*(?:\([^)]+\))?/g,
      /(?:La\.|Fed\.|U\.S\.C\.|F\.R\.C\.P\.|La\.\s*R\.S\.|La\.\s*C\.C\.P\.)[^\n,;]*/g,
      /\d+\s+U\.S\.C\.\s+§\s*\d+[a-z]*/g,
    ];
    const found = new Set<string>();
    patterns.forEach(p => {
      const matches = text.match(p) || [];
      matches.forEach(m => found.add(m.trim()));
    });
    return Array.from(found).slice(0, 10);
  };

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <div className="text-left">
            <p className="text-xs font-semibold text-foreground">Lexi Legal Research</p>
            <p className="text-[10px] text-muted-foreground">Live case law, statutes & precedent via Perplexity</p>
          </div>
          {isLoading && (
            <span className="ml-2 flex items-center gap-1 text-[10px] text-primary font-medium">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Searching…
            </span>
          )}
        </div>
        <span className={`text-muted-foreground text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* Category selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORY_OPTIONS.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                title={cat.hint}
                className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                  category === cat.id
                    ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <div className="text-sm">{cat.icon}</div>
                <div className="text-[9px] font-semibold mt-0.5 leading-tight">{cat.label}</div>
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search case law, statutes, legal precedent…"
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
            >
              {isLoading ? '…' : 'Search'}
            </button>
          </div>

          {/* Quick searches */}
          {!activeResult && !isLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SEARCHES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuickSearch(q)}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-3 py-4 px-3 bg-primary/5 rounded-xl">
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Searching legal databases…</p>
                <p className="text-[10px] text-muted-foreground">Lexi is querying case law, statutes, and precedent via Perplexity</p>
              </div>
            </div>
          )}

          {/* Results */}
          {activeResult && !isLoading && (
            <div className="space-y-3">
              {/* Result header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Results for: <span className="text-primary">{activeResult.query}</span></p>
                  {activeResult.searchResults.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">{activeResult.searchResults.length} sources found</p>
                  )}
                </div>
                <button
                  onClick={() => { setActiveResult(null); setQuery(''); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear ✕
                </button>
              </div>

              {/* Research content */}
              <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-64 overflow-y-auto">
                <div
                  className="text-xs text-foreground leading-relaxed prose prose-xs max-w-none"
                  dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + formatContent(activeResult.content) + '</p>' }}
                />
              </div>

              {/* Extracted citations with insert button */}
              {(() => {
                const extracted = extractCitationsFromText(activeResult.content);
                return extracted.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-foreground mb-1.5">Detected Citations:</p>
                    <div className="space-y-1">
                      {extracted.map((cit, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                          <span className="text-[10px] text-foreground font-mono flex-1 truncate">{cit}</span>
                          {onInsertCitation && (
                            <button
                              onClick={() => { onInsertCitation(cit); toast.success('Citation added to TOA'); }}
                              className="shrink-0 px-2 py-0.5 bg-primary text-primary-foreground rounded text-[9px] font-semibold hover:bg-primary/90 transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Source links */}
              {activeResult.searchResults.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-foreground mb-1.5">Sources:</p>
                  <div className="space-y-1">
                    {activeResult.searchResults.slice(0, 5).map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 bg-background border border-border rounded-lg hover:border-primary/40 transition-colors group"
                      >
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">[{i + 1}]</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-primary group-hover:underline truncate">{src.title || src.url}</p>
                          {src.snippet && <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{src.snippet}</p>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search history */}
          {history.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Recent searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(1, 6).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveResult(h)}
                    className="px-2 py-0.5 bg-secondary/40 border border-border rounded-full text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors truncate max-w-[140px]"
                    title={h.query}
                  >
                    {h.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
