'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import {
  ALL_50_STATES_LAW_PROFILES,
  LEGAL_PROVIDERS,
  buildLexisNexusPrompt,
  type StateLawProfile,
} from '@/lib/lexi/legalResearchProviders';

interface LexiStateLawBrowserProps {
  defaultState?: string;
  onInsertCitation?: (citation: string) => void;
}

export default function LexiStateLawBrowser({ defaultState = '', onInsertCitation }: LexiStateLawBrowserProps) {
  const [selectedState, setSelectedState] = useState<string>(defaultState);
  const [selectedLawType, setSelectedLawType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [researchResult, setResearchResult] = useState<string>('');
  const [researchQuery, setResearchQuery] = useState('');
  const [activeProvider, setActiveProvider] = useState<'lexi_ai' | 'justia' | 'westlaw' | 'lexisnexis'>('lexi_ai');

  const { response, isLoading, sendMessage } = useChat(
    'PERPLEXITY',
    'perplexity/sonar-pro',
    false
  );

  const stateProfile: StateLawProfile | undefined = ALL_50_STATES_LAW_PROFILES.find(s => s.abbr === selectedState);

  const filteredStates = ALL_50_STATES_LAW_PROFILES.filter(s =>
    stateFilter === '' ||
    s.state.toLowerCase().includes(stateFilter.toLowerCase()) ||
    s.abbr.toLowerCase().includes(stateFilter.toLowerCase()) ||
    s.circuit.toLowerCase().includes(stateFilter.toLowerCase())
  );

  React.useEffect(() => {
    if (response && !isLoading && response.length > 50) {
      setResearchResult(response);
    }
  }, [response, isLoading]);

  const runLexiResearch = () => {
    if (!searchQuery.trim() || isLoading) return;
    setResearchResult('');
    setResearchQuery(searchQuery.trim());
    const prompt = buildLexisNexusPrompt(
      searchQuery.trim(),
      stateProfile?.state,
      selectedLawType || undefined
    );
    sendMessage(
      [
        {
          role: 'system',
          content: `You are Lexi, an expert AI legal research assistant with comprehensive knowledge of all 50 state legal codes and federal law. You have deep familiarity with LexisNexis and Westlaw research methodologies. Always cite real, verifiable authorities in proper Bluebook format.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.15, max_tokens: 2000, web_search_options: { search_context_size: 'high' } }
    );
  };

  const formatContent = (text: string) => {
    return text
      .replace(/## ([^\n]+)/g, '<h3 class="text-xs font-bold text-foreground mt-3 mb-1 uppercase tracking-wide border-b border-border pb-1">$1</h3>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>')
      .replace(/\n\n/g, '</p><p class="mb-2 text-xs leading-relaxed">')
      .replace(/\n/g, '<br/>');
  };

  const getProviderSearchUrl = (provider: string, query: string, state?: StateLawProfile): string => {
    switch (provider) {
      case 'justia':
        return state
          ? `https://law.justia.com/codes/${state.state.toLowerCase().replace(/\s+/g, '-')}/?q=${encodeURIComponent(query)}`
          : `https://law.justia.com/search/?q=${encodeURIComponent(query)}`;
      case 'westlaw':
        return `https://1.next.westlaw.com/Search/Results.html?query=${encodeURIComponent(query)}&jurisdiction=${state?.westlawDb || 'all'}`;
      case 'lexisnexis':
        return `https://advance.lexis.com/search/?pdmfid=1000516&crid=&pdsearchterms=${encodeURIComponent(query)}&pdstartin=hlct%3A1%3A1&pdtypeofsearch=searchboxclick&pdsearchtype=SearchBox&pdqttype=and&pdpsf=&pdquerytemplateid=&ecomp=1trg&earg=pdsf&prid=`;
      case 'congress':
        return `https://www.congress.gov/search?q=${encodeURIComponent(JSON.stringify({ source: 'legislation', search: query }))}`;
      default:
        return '#';
    }
  };

  return (
    <div className="space-y-4">
      {/* Provider Status Bar */}
      <div className="flex flex-wrap gap-2 p-3 bg-card border border-border rounded-xl">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide self-center mr-1">Research via:</span>
        {LEGAL_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            onClick={() => {
              if (provider.id === 'lexi_ai') {
                setActiveProvider('lexi_ai');
              } else if (provider.available || !provider.requiresKey) {
                setActiveProvider(provider.id as typeof activeProvider);
              }
            }}
            title={provider.description}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
              activeProvider === provider.id
                ? 'border-primary bg-primary/10 text-primary'
                : provider.available
                ? 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                : 'border-border text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            <span>{provider.icon}</span>
            <span>{provider.name}</span>
            {!provider.available && provider.requiresKey && (
              <span className="text-[8px] text-amber-500">🔑</span>
            )}
            {provider.available && (
              <span className="text-[8px] text-green-500">●</span>
            )}
          </button>
        ))}
      </div>

      {/* State Selector + Search */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Filter States
          </label>
          <input
            type="text"
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            placeholder="Search by state name, abbr, or circuit…"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Law Type Filter
          </label>
          <select
            value={selectedLawType}
            onChange={e => setSelectedLawType(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Law Types</option>
            {['Civil', 'Criminal', 'Family', 'Business', 'Tax', 'Probate', 'Property', 'Labor', 'Health', 'Evidence', 'Administrative', 'Corporate', 'Gaming', 'Energy', 'Land', 'Natural Resources', 'Domestic Relations', 'Civil Procedure'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* State Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
        {filteredStates.map(s => (
          <button
            key={s.abbr}
            onClick={() => setSelectedState(selectedState === s.abbr ? '' : s.abbr)}
            title={`${s.state} — ${s.circuit}`}
            className={`px-2 py-1.5 rounded-lg border text-center transition-colors ${
              selectedState === s.abbr
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-foreground hover:border-primary hover:text-primary'
            }`}
          >
            <div className="text-xs font-bold">{s.abbr}</div>
            <div className="text-[8px] opacity-70 truncate">{s.state.split(' ')[0]}</div>
          </button>
        ))}
      </div>

      {/* Selected State Detail */}
      {stateProfile && (
        <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
          {/* State Header */}
          <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">{stateProfile.state}</h3>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                <span>🏛️ {stateProfile.circuit}</span>
                <span>📍 {stateProfile.capital}</span>
                <span>📚 {stateProfile.lawTypes.length} law categories</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={stateProfile.officialCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold hover:bg-primary/90 transition-colors"
              >
                Official Code ↗
              </a>
              <a
                href={stateProfile.justiaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-[10px] font-semibold hover:border-primary transition-colors"
              >
                Justia ↗
              </a>
              <a
                href={stateProfile.courtUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-secondary border border-border text-foreground rounded-lg text-[10px] font-semibold hover:border-primary transition-colors"
              >
                Courts ↗
              </a>
            </div>
          </div>

          {/* Law Types Grid */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Law Categories & Codes</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {stateProfile.lawTypes
                .filter(lt => !selectedLawType || lt.category === selectedLawType)
                .map(lawType => (
                  <div
                    key={lawType.category}
                    className="p-3 bg-background border border-border rounded-lg hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground">{lawType.category}</div>
                        <div className="text-[10px] text-primary font-mono">{lawType.abbreviation}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{lawType.codeName}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lawType.topics.slice(0, 4).map(topic => (
                        <button
                          key={topic}
                          onClick={() => setSearchQuery(`${topic} ${stateProfile.state}`)}
                          className="text-[9px] px-1.5 py-0.5 bg-secondary/50 border border-border rounded-full text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Primary Sources */}
            {stateProfile.primarySources.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Primary Sources</p>
                <div className="flex flex-wrap gap-2">
                  {stateProfile.primarySources.map(src => (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border border-border rounded-lg text-[10px] text-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <span>{src.type === 'statute' ? '📚' : src.type === 'court_rule' ? '⚖️' : src.type === 'constitution' ? '📜' : '📋'}</span>
                      <span>{src.name}</span>
                      <span className="text-muted-foreground">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lexi AI Research Bar */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🤖</span>
          <div>
            <p className="text-xs font-semibold text-foreground">Lexi AI Research</p>
            <p className="text-[10px] text-muted-foreground">
              {stateProfile
                ? `Research ${stateProfile.state} law with AI-powered analysis`
                : 'Search across all 50 states with AI-powered legal research'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runLexiResearch()}
            placeholder={
              stateProfile
                ? `Research ${stateProfile.state} ${selectedLawType || 'law'}…`
                : 'e.g., "non-compete enforceability all 50 states" or "marijuana possession penalties by state"'
            }
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
          {activeProvider !== 'lexi_ai' && searchQuery.trim() ? (
            <a
              href={getProviderSearchUrl(activeProvider, searchQuery, stateProfile)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
            >
              Search ↗
            </a>
          ) : (
            <button
              onClick={runLexiResearch}
              disabled={!searchQuery.trim() || isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
            >
              {isLoading ? '…' : 'Ask Lexi'}
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
            <span>Lexi is researching {stateProfile?.state || 'all 50 states'} law…</span>
          </div>
        )}

        {/* Research Result */}
        {researchResult && !isLoading && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground">
                Research: <span className="text-primary">{researchQuery}</span>
                {stateProfile && <span className="text-muted-foreground"> — {stateProfile.state}</span>}
              </p>
              <button
                onClick={() => { setResearchResult(''); setResearchQuery(''); }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear ✕
              </button>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 max-h-72 overflow-y-auto">
              <div
                className="text-xs text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: '<p class="mb-2 text-xs leading-relaxed">' + formatContent(researchResult) + '</p>',
                }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground italic">
              ⚖️ For research purposes only. Verify all citations through official sources.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
