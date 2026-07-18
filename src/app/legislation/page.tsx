'use client';

import React, { useState, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const PARALEGAL_DISCLAIMER = `PARALEGAL DISCLAIMER: The information provided on this page is for general informational and educational purposes only. It is not legal advice and does not create an attorney-client relationship. Broussard Legal Services employs trained paralegals who assist under the supervision of a licensed attorney. All legal research, document preparation, and case analysis is reviewed and supervised by a licensed attorney. For legal advice specific to your situation, please consult with a licensed attorney.`;

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

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: '📋' },
  { id: 'business', label: 'Business & Commerce', icon: '🏢' },
  { id: 'employment', label: 'Employment & Labor', icon: '👷' },
  { id: 'real-estate', label: 'Real Estate & Property', icon: '🏠' },
  { id: 'family', label: 'Family & Domestic', icon: '👨‍👩‍👧' },
  { id: 'criminal', label: 'Criminal Justice', icon: '⚖️' },
  { id: 'civil-rights', label: 'Civil Rights', icon: '🗽' },
  { id: 'healthcare', label: 'Healthcare & Insurance', icon: '🏥' },
  { id: 'immigration', label: 'Immigration', icon: '🌎' },
  { id: 'tax', label: 'Tax & Finance', icon: '💰' },
  { id: 'environment', label: 'Environment', icon: '🌿' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'technology', label: 'Technology & Privacy', icon: '💻' },
  { id: 'veterans', label: 'Veterans & Military', icon: '🎖️' },
  { id: 'consumer', label: 'Consumer Protection', icon: '🛡️' },
];

interface SearchResult {
  congress: number;
  type: string;
  number: string;
  title: string;
  sponsor: string;
  status: string;
  latestAction: string;
  url: string;
  introducedDate: string;
  policyArea?: string;
}

interface ConflictResult {
  federalLaw: string;
  stateLaw: string;
  conflictType: string;
  description: string;
  resolution: string;
}

export default function LegislationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedState, setSelectedState] = useState('');
  const [searchType, setSearchType] = useState<'federal' | 'state' | 'conflict'>('federal');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [conflictResults, setConflictResults] = useState<ConflictResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [lexiQuery, setLexiQuery] = useState('');
  const [lexiResponse, setLexiResponse] = useState('');
  const [lexiLoading, setLexiLoading] = useState(false);

  const buildCongressUrl = useCallback(() => {
    const base = 'https://api.congress.gov/v3';
    const params = new URLSearchParams();
    params.set('format', 'json');
    params.set('limit', '20');
    if (searchQuery) params.set('query', searchQuery);
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string> = {
        business: 'Commerce',
        employment: 'Labor and Employment',
        'real-estate': 'Real Property',
        family: 'Families',
        criminal: 'Crime and Law Enforcement',
        'civil-rights': 'Civil Rights and Liberties, Minority Issues',
        healthcare: 'Health',
        immigration: 'Immigration',
        tax: 'Taxation',
        environment: 'Environmental Protection',
        education: 'Education',
        technology: 'Science, Technology, Communications',
        veterans: 'Armed Forces and National Security',
        consumer: 'Consumer Affairs',
      };
      if (categoryMap[selectedCategory]) params.set('policyArea', categoryMap[selectedCategory]);
    }
    return `${base}/bill?${params.toString()}`;
  }, [searchQuery, selectedCategory]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && selectedCategory === 'all' && !selectedState) {
      setError('Please enter a search term, select a category, or choose a state.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      if (searchType === 'conflict') {
        // Simulate conflict detection using AI
        const conflictQuery = `Identify federal vs state law conflicts for ${selectedState || 'all states'} regarding ${searchQuery || selectedCategory}. List specific conflicts with federal law, state law, conflict type, and resolution.`;
        const response = await fetch('/api/ai/chat-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'PERPLEXITY',
            model: 'perplexity/llama-3.1-sonar-small-128k-online',
            messages: [
              {
                role: 'system',
                content: 'You are a legal research assistant specializing in federal-state law conflicts. Return a JSON array of conflict objects with fields: federalLaw, stateLaw, conflictType (preemption/supremacy/concurrent), description, resolution. Be specific and cite actual laws.'
              },
              { role: 'user', content: conflictQuery }
            ],
            max_tokens: 1500,
          }),
        });
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || data?.content || '';
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            setConflictResults(JSON.parse(jsonMatch[0]));
          } else {
            setConflictResults([{
              federalLaw: 'Federal Analysis',
              stateLaw: selectedState || 'State Law',
              conflictType: 'Research Result',
              description: content,
              resolution: 'Consult with a licensed attorney for specific guidance.',
            }]);
          }
        } catch {
          setConflictResults([{
            federalLaw: 'Federal Analysis',
            stateLaw: selectedState || 'State Law',
            conflictType: 'Research Result',
            description: content,
            resolution: 'Consult with a licensed attorney for specific guidance.',
          }]);
        }
      } else {
        // Congress.gov API search
        const congressUrl = buildCongressUrl();
        const proxyResponse = await fetch('/api/lexi/auto-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Search Congress.gov for legislation: ${searchQuery} ${selectedCategory !== 'all' ? `category: ${selectedCategory}` : ''} ${selectedState ? `related to ${selectedState}` : ''}. Return recent bills with title, sponsor, status, and congress.gov URL. Format as JSON array with fields: congress, type, number, title, sponsor, status, latestAction, url, introducedDate.`,
            congressUrl,
            state: selectedState,
            category: selectedCategory,
          }),
        });
        const data = await proxyResponse.json();
        const content = data?.result || data?.content || data?.message || '';
        try {
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            setResults(JSON.parse(jsonMatch[0]));
          } else {
            // Fallback: show AI summary as single result
            setResults([{
              congress: 119,
              type: 'Research',
              number: '—',
              title: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
              sponsor: 'AI Research Summary',
              status: 'See full result',
              latestAction: content,
              url: `https://www.congress.gov/search?q=${encodeURIComponent(searchQuery)}`,
              introducedDate: new Date().toISOString().split('T')[0],
            }]);
          }
        } catch {
          setResults([]);
        }
      }
    } catch (err) {
      setError('Search failed. Please try again or visit congress.gov directly.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedState, searchType, buildCongressUrl]);

  const handleLexiResearch = useCallback(async () => {
    if (!lexiQuery.trim()) return;
    setLexiLoading(true);
    setLexiResponse('');
    try {
      const response = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'PERPLEXITY',
          model: 'perplexity/llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: `You are Lexi, a legal research assistant at Broussard Legal Services. You specialize in federal and state legislation research using Congress.gov data. Provide thorough, accurate legal research with citations. Always note that this is general information and not legal advice. Focus on Louisiana law when state-specific guidance is needed, but cover all 50 states when asked.`
            },
            { role: 'user', content: lexiQuery }
          ],
          max_tokens: 2000,
        }),
      });
      const data = await response.json();
      setLexiResponse(data?.choices?.[0]?.message?.content || data?.content || 'No response received.');
    } catch {
      setLexiResponse('Research failed. Please try again.');
    } finally {
      setLexiLoading(false);
    }
  }, [lexiQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-20">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-5 md:px-10 mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1B2A4A]/10 text-[#1B2A4A] text-xs font-semibold uppercase tracking-widest mb-4">
              <span>⚖️</span> Federal & State Legislation Research
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-[#1B2A4A] mb-4">
              Congress.gov Legislation Access
            </h1>
            <p className="text-[#4A6B58] text-lg max-w-2xl mx-auto">
              Search all 50 states and federal legislation by category, identify federal-state conflicts, and get AI-powered research from Lexi.
            </p>
          </div>

          {/* Paralegal Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg shrink-0 mt-0.5">⚠️</span>
              <p className="text-amber-800 text-xs leading-relaxed">{PARALEGAL_DISCLAIMER}</p>
            </div>
          </div>

          {/* Search Panel */}
          <div className="bg-white rounded-3xl shadow-lg border border-border p-6 md:p-8">
            {/* Search Type Toggle */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {[
                { id: 'federal', label: '🏛️ Federal Bills', desc: 'Congress.gov' },
                { id: 'state', label: '🗺️ State Legislation', desc: 'By State' },
                { id: 'conflict', label: '⚡ Conflict Detection', desc: 'Fed vs State' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSearchType(type.id as 'federal' | 'state' | 'conflict')}
                  className={`flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-sm font-semibold transition-all border ${
                    searchType === type.id
                      ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                      : 'bg-secondary/40 text-foreground border-border hover:border-[#1B2A4A]/40'
                  }`}
                >
                  <div>{type.label}</div>
                  <div className={`text-xs font-normal mt-0.5 ${searchType === type.id ? 'text-white/70' : 'text-muted-foreground'}`}>{type.desc}</div>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex gap-3 mb-5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search legislation, bill number, topic, or keyword..."
                className="flex-1 px-4 py-3 rounded-2xl border border-border bg-secondary/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-3 bg-[#1B2A4A] text-white rounded-2xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? '⏳ Searching...' : '🔍 Search'}
              </button>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">State (Optional)</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                >
                  <option value="">All States (Federal)</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Category Chips */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.slice(1, 8).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedCategory === cat.id
                      ? 'bg-[#B76E79] text-white border-[#B76E79]'
                      : 'bg-secondary/40 text-muted-foreground border-border hover:border-[#B76E79]/40 hover:text-[#B76E79]'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}
          </div>
        </section>

        {/* Results */}
        {searched && (
          <section className="max-w-7xl mx-auto px-5 md:px-10 mb-12">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">Searching legislation database...</p>
                </div>
              </div>
            ) : searchType === 'conflict' ? (
              <div>
                <h2 className="font-serif text-2xl text-[#1B2A4A] mb-6">
                  ⚡ Federal-State Conflict Analysis
                  {selectedState && <span className="text-[#B76E79] ml-2">— {selectedState}</span>}
                </h2>
                {conflictResults.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground">
                    No conflicts found. Try a different search term or state.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conflictResults.map((conflict, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-border p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h3 className="font-semibold text-[#1B2A4A] text-base">{conflict.federalLaw}</h3>
                          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                            conflict.conflictType === 'preemption' ? 'bg-red-100 text-red-700' :
                            conflict.conflictType === 'supremacy'? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {conflict.conflictType}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2"><span className="font-medium text-foreground">State Law:</span> {conflict.stateLaw}</p>
                        <p className="text-sm text-foreground mb-3">{conflict.description}</p>
                        <div className="bg-[#4A6B58]/10 rounded-xl p-3">
                          <p className="text-xs font-semibold text-[#4A6B58] mb-1">Resolution</p>
                          <p className="text-sm text-[#4A6B58]">{conflict.resolution}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="font-serif text-2xl text-[#1B2A4A] mb-6">
                  🏛️ Legislation Results
                  {selectedState && <span className="text-[#B76E79] ml-2">— {selectedState}</span>}
                  <span className="text-muted-foreground text-base font-normal ml-2">({results.length} found)</span>
                </h2>
                {results.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-border p-8 text-center">
                    <p className="text-muted-foreground mb-4">No results found. Try broadening your search.</p>
                    <a
                      href={`https://www.congress.gov/search?q=${encodeURIComponent(searchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B2A4A] text-white rounded-full text-sm font-semibold hover:bg-[#1B2A4A]/90 transition-all"
                    >
                      Search Congress.gov Directly →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {results.map((bill, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-border p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-lg text-xs font-semibold">
                              {bill.congress}th Congress
                            </span>
                            <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-lg text-xs">
                              {bill.type} {bill.number}
                            </span>
                          </div>
                          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                            bill.status?.toLowerCase().includes('signed') || bill.status?.toLowerCase().includes('enacted')
                              ? 'bg-green-100 text-green-700' : bill.status?.toLowerCase().includes('passed')
                              ? 'bg-blue-100 text-blue-700' :'bg-gray-100 text-gray-600'
                          }`}>
                            {bill.status || 'Introduced'}
                          </span>
                        </div>
                        <h3 className="font-semibold text-[#1B2A4A] text-base mb-2 leading-snug">{bill.title}</h3>
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium text-foreground">Sponsor:</span> {bill.sponsor}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          <span className="font-medium text-foreground">Latest Action:</span> {bill.latestAction}
                        </p>
                        <div className="flex items-center gap-3">
                          <a
                            href={bill.url || `https://www.congress.gov/search?q=${encodeURIComponent(bill.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] text-white rounded-full text-xs font-semibold hover:bg-[#1B2A4A]/90 transition-all"
                          >
                            View on Congress.gov →
                          </a>
                          <button
                            onClick={() => setLexiQuery(`Analyze this legislation: ${bill.title}. What does it mean for clients in ${selectedState || 'Louisiana'}?`)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs font-semibold hover:bg-[#B76E79]/20 transition-all border border-[#B76E79]/30"
                          >
                            🤖 Ask Lexi
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-center pt-4">
                      <a
                        href={`https://www.congress.gov/search?q=${encodeURIComponent(searchQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 border border-[#1B2A4A]/30 text-[#1B2A4A] rounded-full text-sm font-semibold hover:bg-[#1B2A4A]/5 transition-all"
                      >
                        View All Results on Congress.gov →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Lexi AI Research Panel */}
        <section className="max-w-7xl mx-auto px-5 md:px-10 mb-12">
          <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A6B] rounded-3xl p-6 md:p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#B76E79] flex items-center justify-center text-lg">🤖</div>
              <div>
                <h2 className="font-serif text-xl font-semibold">Ask Lexi — AI Legal Research</h2>
                <p className="text-white/60 text-xs">Powered by Perplexity · Real-time legislative data</p>
              </div>
            </div>
            <div className="flex gap-3 mb-4">
              <textarea
                value={lexiQuery}
                onChange={(e) => setLexiQuery(e.target.value)}
                placeholder="Ask Lexi about any legislation, federal-state conflicts, or legal research... e.g. 'What are the current employment law conflicts between federal and Louisiana state law?'"
                rows={3}
                className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#B76E79]/50 text-sm resize-none"
              />
              <button
                onClick={handleLexiResearch}
                disabled={lexiLoading || !lexiQuery.trim()}
                className="px-5 py-3 bg-[#B76E79] text-white rounded-2xl font-semibold text-sm hover:bg-[#B76E79]/90 transition-all disabled:opacity-60 self-end whitespace-nowrap"
              >
                {lexiLoading ? '⏳...' : '🔍 Research'}
              </button>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                'Federal vs Louisiana employment law conflicts',
                'Recent business legislation 119th Congress',
                'Real estate law changes affecting Louisiana',
                'Consumer protection federal preemption',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setLexiQuery(prompt)}
                  className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs hover:bg-white/20 transition-all border border-white/10"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {lexiLoading && (
              <div className="flex items-center gap-3 py-4">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/70 text-sm">Lexi is researching...</span>
              </div>
            )}

            {lexiResponse && (
              <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#B76E79] font-semibold text-sm">Lexi's Research</span>
                  <span className="text-white/40 text-xs">· General information only, not legal advice</span>
                </div>
                <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{lexiResponse}</div>
                <div className="mt-4 pt-3 border-t border-white/10">
                  <p className="text-white/50 text-xs italic">⚠️ This is general legal information provided by an AI assistant under paralegal supervision. It is not legal advice. Please consult with Attorney Broussard for advice specific to your situation.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Direct Links */}
        <section className="max-w-7xl mx-auto px-5 md:px-10 mb-12">
          <h2 className="font-serif text-2xl text-[#1B2A4A] mb-6">📚 Direct Legislative Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Congress.gov', desc: 'Official U.S. federal legislation database', url: 'https://www.congress.gov', icon: '🏛️', color: '#1B2A4A' },
              { title: 'Louisiana Legislature', desc: 'Louisiana state laws and statutes', url: 'https://www.legis.la.gov', icon: '⚖️', color: '#355E3B' },
              { title: 'GovTrack', desc: 'Track bills and congressional activity', url: 'https://www.govtrack.us', icon: '📊', color: '#B76E79' },
              { title: 'Justia', desc: 'Free legal research and case law', url: 'https://www.justia.com', icon: '📖', color: '#4A6B58' },
              { title: 'Cornell LII', desc: 'Legal Information Institute — U.S. Code', url: 'https://www.law.cornell.edu', icon: '🎓', color: '#8B3A45' },
              { title: 'PACER', desc: 'Federal court records and filings', url: 'https://pacer.uscourts.gov', icon: '🏛️', color: '#6B4A10' },
            ].map((resource) => (
              <a
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{resource.icon}</span>
                  <h3 className="font-semibold text-[#1B2A4A] group-hover:text-[#B76E79] transition-colors">{resource.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{resource.desc}</p>
                <span className="inline-block mt-3 text-xs font-semibold text-[#B76E79]">Visit →</span>
              </a>
            ))}
          </div>
        </section>

        {/* Bottom Disclaimer */}
        <section className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="bg-[#1B2A4A]/5 border border-[#1B2A4A]/10 rounded-2xl p-6">
            <h3 className="font-semibold text-[#1B2A4A] mb-2 flex items-center gap-2">
              <span>⚖️</span> Legal Disclaimer
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {PARALEGAL_DISCLAIMER} For personalized legal guidance,{' '}
              <Link href="/contact" className="text-[#B76E79] hover:underline font-medium">contact Broussard Legal Services</Link>{' '}
              or{' '}
              <Link href="/book-consultation" className="text-[#B76E79] hover:underline font-medium">book a consultation</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
