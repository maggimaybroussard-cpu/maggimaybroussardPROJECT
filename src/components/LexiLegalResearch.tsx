'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type ResearchCategory = 'case_law' | 'statutes' | 'precedent' | 'federal' | 'all';

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

// ── All 50 States ─────────────────────────────────────────────────────────────

const ALL_STATES = [
  { code: 'AL', name: 'Alabama', citation: 'Ala. Code' },
  { code: 'AK', name: 'Alaska', citation: 'AS' },
  { code: 'AZ', name: 'Arizona', citation: 'A.R.S.' },
  { code: 'AR', name: 'Arkansas', citation: 'Ark. Code Ann.' },
  { code: 'CA', name: 'California', citation: 'Cal. [Code]' },
  { code: 'CO', name: 'Colorado', citation: 'C.R.S.' },
  { code: 'CT', name: 'Connecticut', citation: 'Conn. Gen. Stat.' },
  { code: 'DE', name: 'Delaware', citation: 'Del. Code Ann.' },
  { code: 'FL', name: 'Florida', citation: 'Fla. Stat.' },
  { code: 'GA', name: 'Georgia', citation: 'O.C.G.A.' },
  { code: 'HI', name: 'Hawaii', citation: 'H.R.S.' },
  { code: 'ID', name: 'Idaho', citation: 'Idaho Code' },
  { code: 'IL', name: 'Illinois', citation: 'ILCS' },
  { code: 'IN', name: 'Indiana', citation: 'Ind. Code' },
  { code: 'IA', name: 'Iowa', citation: 'Iowa Code' },
  { code: 'KS', name: 'Kansas', citation: 'K.S.A.' },
  { code: 'KY', name: 'Kentucky', citation: 'KRS' },
  { code: 'LA', name: 'Louisiana', citation: 'La. R.S.' },
  { code: 'ME', name: 'Maine', citation: 'M.R.S.A.' },
  { code: 'MD', name: 'Maryland', citation: 'Md. Code Ann.' },
  { code: 'MA', name: 'Massachusetts', citation: 'M.G.L.' },
  { code: 'MI', name: 'Michigan', citation: 'MCL' },
  { code: 'MN', name: 'Minnesota', citation: 'Minn. Stat.' },
  { code: 'MS', name: 'Mississippi', citation: 'Miss. Code Ann.' },
  { code: 'MO', name: 'Missouri', citation: 'Mo. Rev. Stat.' },
  { code: 'MT', name: 'Montana', citation: 'MCA' },
  { code: 'NE', name: 'Nebraska', citation: 'Neb. Rev. Stat.' },
  { code: 'NV', name: 'Nevada', citation: 'NRS' },
  { code: 'NH', name: 'New Hampshire', citation: 'RSA' },
  { code: 'NJ', name: 'New Jersey', citation: 'N.J.S.A.' },
  { code: 'NM', name: 'New Mexico', citation: 'NMSA' },
  { code: 'NY', name: 'New York', citation: 'N.Y. [Law]' },
  { code: 'NC', name: 'North Carolina', citation: 'N.C. Gen. Stat.' },
  { code: 'ND', name: 'North Dakota', citation: 'N.D.C.C.' },
  { code: 'OH', name: 'Ohio', citation: 'ORC' },
  { code: 'OK', name: 'Oklahoma', citation: 'Okla. Stat.' },
  { code: 'OR', name: 'Oregon', citation: 'ORS' },
  { code: 'PA', name: 'Pennsylvania', citation: 'Pa. C.S.' },
  { code: 'RI', name: 'Rhode Island', citation: 'R.I. Gen. Laws' },
  { code: 'SC', name: 'South Carolina', citation: 'S.C. Code Ann.' },
  { code: 'SD', name: 'South Dakota', citation: 'SDCL' },
  { code: 'TN', name: 'Tennessee', citation: 'Tenn. Code Ann.' },
  { code: 'TX', name: 'Texas', citation: 'Tex. [Code]' },
  { code: 'UT', name: 'Utah', citation: 'Utah Code' },
  { code: 'VT', name: 'Vermont', citation: 'V.S.A.' },
  { code: 'VA', name: 'Virginia', citation: 'Va. Code Ann.' },
  { code: 'WA', name: 'Washington', citation: 'RCW' },
  { code: 'WV', name: 'West Virginia', citation: 'W. Va. Code' },
  { code: 'WI', name: 'Wisconsin', citation: 'Wis. Stat.' },
  { code: 'WY', name: 'Wyoming', citation: 'Wyo. Stat. Ann.' },
];

const PRACTICE_AREAS = [
  'Personal Injury / Tort',
  'Contract Law',
  'Employment Law',
  'Family Law / Divorce',
  'Criminal Law',
  'Real Estate / Property',
  'Landlord-Tenant',
  'Business / Corporate',
  'Bankruptcy',
  'Immigration',
  'Intellectual Property',
  'Estate Planning / Probate',
  'Workers Compensation',
  'Tax Law',
  'Civil Rights',
  'Environmental Law',
  'Securities Law',
  'Administrative Law',
  'Federal Civil Procedure',
  'Constitutional Law',
];

const CATEGORY_OPTIONS: Array<{ id: ResearchCategory; label: string; icon: string; hint: string }> = [
  { id: 'case_law', label: 'Case Law', icon: '⚖️', hint: 'Search federal and state court decisions' },
  { id: 'statutes', label: 'Statutes & Codes', icon: '📚', hint: 'Search federal and state statutes' },
  { id: 'precedent', label: 'Precedent', icon: '🏛️', hint: 'Find controlling and persuasive authority' },
  { id: 'federal', label: 'Federal Law', icon: '🇺🇸', hint: 'FRCP, FRE, U.S.C., CFR, federal regulations' },
  { id: 'all', label: 'All Sources', icon: '🔍', hint: 'Comprehensive research across all sources' },
];

const QUICK_SEARCHES = [
  'Summary judgment standard Louisiana',
  'Motion to dismiss 12(b)(6) Fifth Circuit',
  'Louisiana contract breach elements',
  'Personal injury damages Louisiana',
  'Employment discrimination burden shifting',
  'Negligence standard of care Louisiana',
  'FRCP Rule 26 discovery obligations',
  'Title VII hostile work environment elements',
  'Chapter 7 bankruptcy discharge requirements',
  'Non-compete enforceability by state',
  'Statute of limitations personal injury all states',
  'Community property vs equitable distribution',
];

function buildResearchPrompt(
  query: string,
  category: ResearchCategory,
  context?: string,
  selectedState?: string,
  practiceArea?: string
): string {
  const categoryInstructions: Record<ResearchCategory, string> = {
    case_law:
      'Focus on relevant federal and state court decisions. Include case names, citations, courts, years, and key holdings. Prioritize Fifth Circuit and Louisiana courts when applicable, but include other relevant jurisdictions.',
    statutes:
      'Focus on relevant federal statutes (U.S.C.), state codes, and regulations (C.F.R.). Include exact code sections and current text. Note any recent amendments.',
    precedent:
      'Identify controlling authority (binding precedent) and persuasive authority. Distinguish between circuit splits, majority/minority positions, and recent trends. Include proper Bluebook citations.',
    federal:
      'Focus on federal law: U.S. Constitution, federal statutes (U.S.C.), federal regulations (C.F.R.), FRCP, FRE, and federal case law. Include circuit court and Supreme Court decisions.',
    all: 'Provide comprehensive legal research including case law, statutes, regulations, and secondary sources. Organize by source type. Include proper Bluebook citations for all authorities.',
  };

  const stateContext = selectedState
    ? `\nPRIMARY JURISDICTION: ${selectedState} — prioritize ${selectedState} statutes, case law, and court rules. Also include relevant federal law.`
    : '';

  const practiceContext = practiceArea ? `\nPRACTICE AREA: ${practiceArea}` : '';

  return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services with comprehensive knowledge of all 50 states' laws and federal law. Conduct thorough legal research on the following query.

RESEARCH QUERY: ${query}
RESEARCH FOCUS: ${categoryInstructions[category]}${stateContext}${practiceContext}
${context ? `MATTER CONTEXT: ${context}` : ''}

Provide a structured legal research response with:

1. **SUMMARY** — 2-3 sentence overview of the legal landscape on this issue

2. **KEY AUTHORITIES** — List the most important cases, statutes, or rules with:
   - Full Bluebook citation
   - Court/jurisdiction
   - Year decided
   - Key holding or relevant provision (1-2 sentences)

3. **CONTROLLING LAW** (if applicable) — Identify the binding authority in the relevant jurisdiction(s)

4. **STATE VARIATIONS** (if multi-state) — Note key differences between states' approaches

5. **RECENT DEVELOPMENTS** — Any notable recent cases or statutory changes (last 5 years)

6. **PRACTICE NOTES** — Practical tips for applying this law

Format citations in proper Bluebook format. Be precise and cite only real, verifiable authorities.`;
}

export default function LexiLegalResearch({ context, onInsertCitation, defaultOpen = false }: LexiLegalResearchProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ResearchCategory>('all');
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState<string>('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showPracticeDropdown, setShowPracticeDropdown] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setShowStateDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStates = ALL_STATES.filter(
    s =>
      s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const doSearch = (q: string, cat: ResearchCategory = category) => {
    if (!q.trim() || isLoading) return;
    const stateName = selectedState
      ? ALL_STATES.find(s => s.code === selectedState)?.name
      : undefined;
    const prompt = buildResearchPrompt(q.trim(), cat, context, stateName, selectedPracticeArea || undefined);
    const systemContent = selectedState
      ? `You are a legal research assistant with deep expertise in ${stateName} law and federal law. Always cite real, verifiable authorities in proper Bluebook format.`
      : 'You are a legal research assistant with comprehensive knowledge of all 50 states and federal law. Always cite real, verifiable authorities in proper Bluebook format.';
    sendMessage(
      [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.2,
        max_tokens: 1500,
        web_search_options: { search_context_size: 'medium' },
      }
    );
  };

  const handleSearch = () => doSearch(query);

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const handleStateQuickSearch = (stateCode: string, topic: string) => {
    setSelectedState(stateCode);
    const stateName = ALL_STATES.find(s => s.code === stateCode)?.name ?? stateCode;
    const q = `${topic} in ${stateName}`;
    setQuery(q);
    doSearch(q);
  };

  const extractCitationsFromText = (text: string): string[] => {
    const patterns = [
      /[A-Z][a-zA-Z\s&,.']+v\.\s[A-Z][a-zA-Z\s&,.']+,\s*\d+\s+[A-Z][a-zA-Z.]+\s+\d+[^,)]*(?:\([^)]+\))?/g,
      /(?:La\.|Fed\.|U\.S\.C\.|F\.R\.C\.P\.|La\.\s*R\.S\.|La\.\s*C\.C\.P\.|Fla\.\s*Stat\.|Tex\.|O\.C\.G\.A\.|N\.Y\.|Cal\.|Ill\.|N\.J\.S\.A\.|MCL|ORC|RCW|K\.S\.A\.|KRS|ORS|NMSA|NRS|RSA|SDCL|MCA|Neb\.\s*Rev\.\s*Stat\.|Wyo\.\s*Stat\.\s*Ann\.)[^\n,;]*/g,
      /\d+\s+U\.S\.C\.\s+§\s*\d+[a-z]*/g,
      /\d+\s+C\.F\.R\.\s+§\s*\d+/g,
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

  const selectedStateObj = ALL_STATES.find(s => s.code === selectedState);

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
            <p className="text-[10px] text-muted-foreground">All 50 states · Federal law · Live search via Perplexity</p>
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
          {/* Jurisdiction + Practice Area filters */}
          <div className="grid grid-cols-2 gap-2">
            {/* State selector */}
            <div className="relative" ref={stateDropdownRef}>
              <button
                onClick={() => { setShowStateDropdown(o => !o); setShowPracticeDropdown(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                  selectedState
                    ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className="truncate">
                  {selectedStateObj ? `${selectedStateObj.code} — ${selectedStateObj.name}` : '🗺️ All States / Federal'}
                </span>
                <span className="ml-1 shrink-0">▾</span>
              </button>
              {showStateDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input
                      autoFocus
                      value={stateSearch}
                      onChange={e => setStateSearch(e.target.value)}
                      placeholder="Search state…"
                      className="w-full px-2 py-1 text-xs bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedState(''); setShowStateDropdown(false); setStateSearch(''); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedState ? 'text-primary font-semibold' : 'text-foreground'}`}
                    >
                      🇺🇸 All States / Federal
                    </button>
                    {filteredStates.map(s => (
                      <button
                        key={s.code}
                        onClick={() => { setSelectedState(s.code); setShowStateDropdown(false); setStateSearch(''); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedState === s.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground mr-2">{s.code}</span>
                        {s.name}
                        <span className="ml-1 text-[9px] text-muted-foreground">({s.citation})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Practice area selector */}
            <div className="relative">
              <button
                onClick={() => { setShowPracticeDropdown(o => !o); setShowStateDropdown(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                  selectedPracticeArea
                    ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className="truncate">{selectedPracticeArea || '⚖️ Practice Area'}</span>
                <span className="ml-1 shrink-0">▾</span>
              </button>
              {showPracticeDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedPracticeArea(''); setShowPracticeDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedPracticeArea ? 'text-primary font-semibold' : 'text-foreground'}`}
                    >
                      All Practice Areas
                    </button>
                    {PRACTICE_AREAS.map(pa => (
                      <button
                        key={pa}
                        onClick={() => { setSelectedPracticeArea(pa); setShowPracticeDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedPracticeArea === pa ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                      >
                        {pa}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active filters display */}
          {(selectedState || selectedPracticeArea) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedState && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-full text-[10px] text-primary font-medium">
                  🗺️ {selectedStateObj?.name}
                  <button onClick={() => setSelectedState('')} className="ml-0.5 hover:text-primary/60">✕</button>
                </span>
              )}
              {selectedPracticeArea && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-full text-[10px] text-primary font-medium">
                  ⚖️ {selectedPracticeArea}
                  <button onClick={() => setSelectedPracticeArea('')} className="ml-0.5 hover:text-primary/60">✕</button>
                </span>
              )}
            </div>
          )}

          {/* Category selector */}
          <div className="grid grid-cols-5 gap-1">
            {CATEGORY_OPTIONS.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                title={cat.hint}
                className={`px-1.5 py-1.5 rounded-lg border text-center transition-all ${
                  category === cat.id
                    ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <div className="text-sm">{cat.icon}</div>
                <div className="text-[8px] font-semibold mt-0.5 leading-tight">{cat.label}</div>
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
              placeholder={
                selectedState
                  ? `Search ${selectedStateObj?.name} law…`
                  : 'Search case law, statutes, regulations…'
              }
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

              {/* State-specific quick research */}
              {selectedState && (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">
                    Quick research for {selectedStateObj?.name}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'statute of limitations personal injury',
                      'contract breach elements',
                      'landlord tenant rights',
                      'employment discrimination',
                      'divorce property division',
                      'workers compensation',
                      'criminal expungement',
                      'small claims court limit',
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleStateQuickSearch(selectedState, topic)}
                        className="px-2.5 py-1 bg-primary/5 border border-primary/20 rounded-full text-[10px] text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Federal law quick searches */}
              {category === 'federal' && (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">Federal law quick searches:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'FRCP Rule 12(b)(6) standard',
                      'Title VII discrimination elements',
                      'ADA reasonable accommodation',
                      'FMLA eligibility requirements',
                      'FLSA overtime exemptions',
                      'Chapter 7 bankruptcy discharge',
                      'HIPAA PHI requirements',
                      'Section 1983 qualified immunity',
                      'Chevron/Loper Bright deference',
                      'TCPA consent requirements',
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleQuickSearch(topic)}
                        className="px-2.5 py-1 bg-blue-500/5 border border-blue-500/20 rounded-full text-[10px] text-blue-600 dark:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/10 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-3 py-4 px-3 bg-primary/5 rounded-xl">
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Searching legal databases…</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedState
                    ? `Querying ${selectedStateObj?.name} statutes, case law, and court rules`
                    : 'Querying all 50 states, federal law, and live legal databases'}
                </p>
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
