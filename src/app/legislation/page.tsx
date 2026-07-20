'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

const QUICK_SEARCHES = [
  { label: 'LA Employment Law', query: 'Louisiana employment law federal conflicts', category: 'employment' },
  { label: 'Federal Preemption', query: 'federal preemption doctrine state law', category: 'all' },
  { label: 'Consumer Protection', query: 'consumer protection CFPB FTC', category: 'consumer' },
  { label: 'Civil Rights 2024', query: 'civil rights legislation 119th Congress', category: 'civil-rights' },
  { label: 'Small Business', query: 'small business federal legislation 2024 2025', category: 'business' },
  { label: 'Housing Law', query: 'fair housing real estate federal state', category: 'real-estate' },
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
  aiSummary?: string;
  relevanceData?: RelevanceData;
  summaryLoading?: boolean;
}

interface RelevanceData {
  relevanceScore: number;
  practiceAreas: string[];
  caseTypes: string[];
  keyProvisions: string[];
  clientImpact: string;
  urgency: 'high' | 'medium' | 'low';
}

interface ConflictResult {
  federalLaw: string;
  stateLaw: string;
  conflictType: string;
  description: string;
  resolution: string;
}

interface SavedBill {
  id: string;
  title: string;
  bill_type: string;
  bill_number: string;
  congress: number;
  status: string;
  ai_summary: string;
  relevance_score: number;
  urgency: string;
  practice_areas: string[];
  url: string;
  created_at: string;
}

interface ResearchHistory {
  id: string;
  query: string;
  response: string;
  research_type: string;
  state_filter: string;
  created_at: string;
}

export default function LegislationPage() {
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedState, setSelectedState] = useState('Louisiana');
  const [searchType, setSearchType] = useState<'federal' | 'state' | 'conflict'>('federal');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [conflictResults, setConflictResults] = useState<ConflictResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [lexiQuery, setLexiQuery] = useState('');
  const [lexiResponse, setLexiResponse] = useState('');
  const [lexiLoading, setLexiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'history'>('search');
  const [savedBills, setSavedBills] = useState<SavedBill[]>([]);
  const [researchHistory, setResearchHistory] = useState<ResearchHistory[]>([]);
  const [savingBill, setSavingBill] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [caseContext, setCaseContext] = useState('');
  const [showCaseContext, setShowCaseContext] = useState(false);

  // Load saved bills and history
  useEffect(() => {
    loadSavedBills();
    loadResearchHistory();
  }, []);

  const loadSavedBills = async () => {
    const { data } = await supabase
      .from('legislation_saved_bills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setSavedBills(data as SavedBill[]);
      setSavedIds(new Set(data.map((b: SavedBill) => b.bill_id || b.title)));
    }
  };

  const loadResearchHistory = async () => {
    const { data } = await supabase
      .from('lexi_research_history')
      .select('id, query, response, research_type, state_filter, created_at')
      .order('created_at', { ascending: false })
      .limit(15);
    if (data) setResearchHistory(data as ResearchHistory[]);
  };

  const callEdgeFunction = useCallback(async (params: Record<string, string>) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const response = await fetch(`${supabaseUrl}/functions/v1/legislation-research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify(params),
    });
    return response.json();
  }, []);

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
        const data = await callEdgeFunction({
          mode: 'conflict',
          query: searchQuery || selectedCategory,
          state: selectedState,
          category: selectedCategory,
        });
        const content = data?.content || '';
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
        // Use AI to search Congress.gov via edge function
        const data = await callEdgeFunction({
          mode: 'search',
          query: `Search Congress.gov for legislation: ${searchQuery} ${selectedCategory !== 'all' ? `category: ${selectedCategory}` : ''} ${selectedState ? `related to ${selectedState}` : ''}. Return recent bills with title, sponsor, status, and congress.gov URL. Format as JSON array with fields: congress, type, number, title, sponsor, status, latestAction, url, introducedDate, policyArea.`,
          state: selectedState,
          category: selectedCategory,
        });
        const content = data?.content || '';
        try {
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            setResults(JSON.parse(jsonMatch[0]));
          } else {
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
    } catch {
      setError('Search failed. Please try again or visit congress.gov directly.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedState, searchType, callEdgeFunction]);

  const handleGetAISummary = useCallback(async (bill: SearchResult, index: number) => {
    setResults((prev) => prev.map((r, i) => i === index ? { ...r, summaryLoading: true } : r));
    try {
      const data = await callEdgeFunction({
        mode: 'summary',
        billTitle: bill.title,
        state: selectedState,
        caseContext,
      });
      setResults((prev) => prev.map((r, i) => i === index ? { ...r, aiSummary: data?.content, summaryLoading: false } : r));
    } catch {
      setResults((prev) => prev.map((r, i) => i === index ? { ...r, summaryLoading: false } : r));
    }
  }, [selectedState, caseContext, callEdgeFunction]);

  const handleGetRelevance = useCallback(async (bill: SearchResult, index: number) => {
    setResults((prev) => prev.map((r, i) => i === index ? { ...r, summaryLoading: true } : r));
    try {
      const data = await callEdgeFunction({
        mode: 'relevance',
        billTitle: bill.title,
        caseContext,
        state: selectedState,
      });
      setResults((prev) => prev.map((r, i) => i === index ? {
        ...r,
        relevanceData: data?.relevanceData,
        summaryLoading: false,
      } : r));
    } catch {
      setResults((prev) => prev.map((r, i) => i === index ? { ...r, summaryLoading: false } : r));
    }
  }, [caseContext, selectedState, callEdgeFunction]);

  const handleSaveBill = useCallback(async (bill: SearchResult) => {
    const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
    setSavingBill(billKey);
    try {
      await supabase.from('legislation_saved_bills').insert({
        bill_id: billKey,
        congress: bill.congress,
        bill_type: bill.type,
        bill_number: bill.number,
        title: bill.title,
        sponsor: bill.sponsor,
        status: bill.status,
        latest_action: bill.latestAction,
        introduced_date: bill.introducedDate || null,
        policy_area: bill.policyArea || null,
        url: bill.url,
        ai_summary: bill.aiSummary || null,
        relevance_score: bill.relevanceData?.relevanceScore || null,
        practice_areas: bill.relevanceData?.practiceAreas || [],
        case_types: bill.relevanceData?.caseTypes || [],
        key_provisions: bill.relevanceData?.keyProvisions || [],
        client_impact: bill.relevanceData?.clientImpact || null,
        urgency: bill.relevanceData?.urgency || null,
        case_context: caseContext || null,
      });
      setSavedIds((prev) => new Set([...prev, billKey]));
      await loadSavedBills();
    } catch {
      // silently fail
    } finally {
      setSavingBill(null);
    }
  }, [supabase, caseContext]);

  const handleLexiResearch = useCallback(async () => {
    if (!lexiQuery.trim()) return;
    setLexiLoading(true);
    setLexiResponse('');
    try {
      const data = await callEdgeFunction({
        mode: 'research',
        query: lexiQuery,
        state: selectedState,
        category: selectedCategory,
        caseContext,
      });
      setLexiResponse(data?.content || 'No response received.');
      await loadResearchHistory();
    } catch {
      setLexiResponse('Research failed. Please try again.');
    } finally {
      setLexiLoading(false);
    }
  }, [lexiQuery, selectedState, selectedCategory, caseContext, callEdgeFunction]);

  const urgencyColor = (urgency?: string) => {
    if (urgency === 'high') return 'bg-red-100 text-red-700';
    if (urgency === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-20">

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1B2A4A]/10 text-[#1B2A4A] text-xs font-semibold uppercase tracking-widest mb-4">
              <span>⚖️</span> AI-Powered Legislation Research
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-[#1B2A4A] mb-4">
              Congress.gov Research Hub
            </h1>
            <p className="text-[#4A6B58] text-lg max-w-2xl mx-auto">
              Search federal and state legislation, get AI-powered summaries, analyze case relevance, and save bills for client matters.
            </p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Saved Bills', value: savedBills.length.toString(), icon: '📌' },
              { label: 'Research Sessions', value: researchHistory.length.toString(), icon: '🔍' },
              { label: 'AI Summaries', value: savedBills.filter(b => b.ai_summary).length.toString(), icon: '🤖' },
              { label: 'High Priority', value: savedBills.filter(b => b.urgency === 'high').length.toString(), icon: '🔴' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-border p-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-2xl font-bold text-[#1B2A4A]">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Paralegal Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg shrink-0 mt-0.5">⚠️</span>
              <p className="text-amber-800 text-xs leading-relaxed">{PARALEGAL_DISCLAIMER}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-secondary/30 rounded-2xl p-1 mb-6">
            {[
              { key: 'search', label: '🔍 Search & Research' },
              { key: 'saved', label: `📌 Saved Bills (${savedBills.length})` },
              { key: 'history', label: `📋 Research History (${researchHistory.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'search' | 'saved' | 'history')}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === tab.key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <>
            {/* Search Panel */}
            <section className="max-w-7xl mx-auto px-5 md:px-10 mb-8">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">State</label>
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

                {/* Case Context Toggle */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowCaseContext(!showCaseContext)}
                    className="flex items-center gap-2 text-xs font-semibold text-[#B76E79] hover:text-[#B76E79]/80 transition-colors"
                  >
                    <span>{showCaseContext ? '▼' : '▶'}</span>
                    {showCaseContext ? 'Hide' : 'Add'} Case Context (for relevance tagging)
                  </button>
                  {showCaseContext && (
                    <textarea
                      value={caseContext}
                      onChange={(e) => setCaseContext(e.target.value)}
                      placeholder="Describe the case context to get more relevant AI summaries and tagging... e.g. 'Employment discrimination case involving wrongful termination in Louisiana'"
                      rows={2}
                      className="mt-2 w-full px-4 py-3 rounded-2xl border border-[#B76E79]/30 bg-[#B76E79]/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#B76E79]/30 text-sm resize-none"
                    />
                  )}
                </div>

                {/* Quick Search Chips */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_SEARCHES.map((qs) => (
                    <button
                      key={qs.label}
                      onClick={() => { setSearchQuery(qs.query); setSelectedCategory(qs.category); }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/40 text-muted-foreground border border-border hover:border-[#1B2A4A]/40 hover:text-[#1B2A4A] transition-all"
                    >
                      {qs.label}
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
              <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-muted-foreground text-sm">Searching legislation database via AI...</p>
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
                                conflict.conflictType === 'supremacy' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
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
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-serif text-2xl text-[#1B2A4A]">
                        🏛️ Legislation Results
                        {selectedState && <span className="text-[#B76E79] ml-2">— {selectedState}</span>}
                        <span className="text-muted-foreground text-base font-normal ml-2">({results.length} found)</span>
                      </h2>
                    </div>
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
                        {results.map((bill, i) => {
                          const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
                          const isSaved = savedIds.has(billKey);
                          return (
                            <div key={i} className="bg-white rounded-2xl border border-border p-6 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-lg text-xs font-semibold">
                                    {bill.congress}th Congress
                                  </span>
                                  <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-lg text-xs">
                                    {bill.type} {bill.number}
                                  </span>
                                  {bill.policyArea && (
                                    <span className="px-2 py-0.5 bg-[#4A6B58]/10 text-[#4A6B58] rounded-lg text-xs">
                                      {bill.policyArea}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    bill.status?.toLowerCase().includes('signed') || bill.status?.toLowerCase().includes('enacted')
                                      ? 'bg-green-100 text-green-700' : bill.status?.toLowerCase().includes('passed')
                                      ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {bill.status || 'Introduced'}
                                  </span>
                                </div>
                              </div>

                              <h3 className="font-semibold text-[#1B2A4A] text-base mb-2 leading-snug">{bill.title}</h3>
                              <p className="text-sm text-muted-foreground mb-1">
                                <span className="font-medium text-foreground">Sponsor:</span> {bill.sponsor}
                              </p>
                              <p className="text-sm text-muted-foreground mb-4">
                                <span className="font-medium text-foreground">Latest Action:</span> {bill.latestAction}
                              </p>

                              {/* AI Summary */}
                              {bill.aiSummary && (
                                <div className="bg-[#1B2A4A]/5 rounded-xl p-4 mb-4 border border-[#1B2A4A]/10">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider">🤖 AI Summary</span>
                                  </div>
                                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{bill.aiSummary}</p>
                                </div>
                              )}

                              {/* Relevance Data */}
                              {bill.relevanceData && (
                                <div className="bg-[#B76E79]/5 rounded-xl p-4 mb-4 border border-[#B76E79]/10">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-semibold text-[#B76E79] uppercase tracking-wider">📊 Case Relevance Analysis</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Score:</span>
                                      <span className="text-sm font-bold text-[#B76E79]">{bill.relevanceData.relevanceScore}/10</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgencyColor(bill.relevanceData.urgency)}`}>
                                        {bill.relevanceData.urgency} priority
                                      </span>
                                    </div>
                                  </div>
                                  {bill.relevanceData.practiceAreas?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {bill.relevanceData.practiceAreas.map((area) => (
                                        <span key={area} className="px-2 py-0.5 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs">{area}</span>
                                      ))}
                                    </div>
                                  )}
                                  {bill.relevanceData.clientImpact && (
                                    <p className="text-xs text-muted-foreground mt-2">{bill.relevanceData.clientImpact}</p>
                                  )}
                                </div>
                              )}

                              {/* Loading state */}
                              {bill.summaryLoading && (
                                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                                  <div className="w-4 h-4 border-2 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin" />
                                  Lexi is analyzing...
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={bill.url || `https://www.congress.gov/search?q=${encodeURIComponent(bill.title)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] text-white rounded-full text-xs font-semibold hover:bg-[#1B2A4A]/90 transition-all"
                                >
                                  View on Congress.gov →
                                </a>
                                {!bill.aiSummary && !bill.summaryLoading && (
                                  <button
                                    onClick={() => handleGetAISummary(bill, i)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-full text-xs font-semibold hover:bg-[#1B2A4A]/20 transition-all border border-[#1B2A4A]/20"
                                  >
                                    🤖 AI Summary
                                  </button>
                                )}
                                {!bill.relevanceData && !bill.summaryLoading && (
                                  <button
                                    onClick={() => handleGetRelevance(bill, i)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs font-semibold hover:bg-[#B76E79]/20 transition-all border border-[#B76E79]/20"
                                  >
                                    📊 Tag Relevance
                                  </button>
                                )}
                                <button
                                  onClick={() => setLexiQuery(`Analyze this legislation: ${bill.title}. What does it mean for clients in ${selectedState || 'Louisiana'}?`)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-muted-foreground rounded-full text-xs font-semibold hover:text-foreground transition-all border border-border"
                                >
                                  💬 Ask Lexi
                                </button>
                                <button
                                  onClick={() => !isSaved && handleSaveBill(bill)}
                                  disabled={isSaved || savingBill === billKey}
                                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                                    isSaved
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' :'bg-secondary text-muted-foreground border-border hover:text-foreground'
                                  }`}
                                >
                                  {isSaved ? '✓ Saved' : savingBill === billKey ? '⏳ Saving...' : '📌 Save Bill'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
            <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
              <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A6B] rounded-3xl p-6 md:p-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#B76E79] flex items-center justify-center text-lg">🤖</div>
                  <div>
                    <h2 className="font-serif text-xl font-semibold">Ask Lexi — AI Legal Research</h2>
                    <p className="text-white/60 text-xs">Powered by Supabase Edge Functions · Real-time legislative data</p>
                  </div>
                </div>
                <div className="flex gap-3 mb-4">
                  <textarea
                    value={lexiQuery}
                    onChange={(e) => setLexiQuery(e.target.value)}
                    placeholder="Ask Lexi about any legislation, federal-state conflicts, or legal research..."
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
                    <span className="text-white/70 text-sm">Lexi is researching via edge function...</span>
                  </div>
                )}
                {lexiResponse && (
                  <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[#B76E79] font-semibold text-sm">Lexi&apos;s Research</span>
                      <span className="text-white/40 text-xs">· Saved to research history</span>
                    </div>
                    <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{lexiResponse}</div>
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <p className="text-white/50 text-xs italic">⚠️ General legal information only. Not legal advice. Supervised by licensed attorney.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Direct Links */}
            <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
              <h2 className="font-serif text-2xl text-[#1B2A4A] mb-6">📚 Direct Legislative Resources</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'Congress.gov', desc: 'Official U.S. federal legislation database', url: 'https://www.congress.gov', icon: '🏛️' },
                  { title: 'Louisiana Legislature', desc: 'Louisiana state laws and statutes', url: 'https://www.legis.la.gov', icon: '⚖️' },
                  { title: 'GovTrack', desc: 'Track bills and congressional activity', url: 'https://www.govtrack.us', icon: '📊' },
                  { title: 'Justia', desc: 'Free legal research and case law', url: 'https://www.justia.com', icon: '📖' },
                  { title: 'Cornell LII', desc: 'Legal Information Institute — U.S. Code', url: 'https://www.law.cornell.edu', icon: '🎓' },
                  { title: 'PACER', desc: 'Federal court records and filings', url: 'https://pacer.uscourts.gov', icon: '🏛️' },
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
          </>
        )}

        {/* SAVED BILLS TAB */}
        {activeTab === 'saved' && (
          <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-[#1B2A4A]">📌 Saved Bills</h2>
              <span className="text-sm text-muted-foreground">{savedBills.length} bills saved</span>
            </div>
            {savedBills.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border p-12 text-center">
                <div className="text-4xl mb-4">📌</div>
                <p className="text-muted-foreground mb-4">No bills saved yet. Search for legislation and click &quot;Save Bill&quot; to add them here.</p>
                <button onClick={() => setActiveTab('search')} className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-full text-sm font-semibold hover:bg-[#1B2A4A]/90 transition-all">
                  Start Searching →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {savedBills.map((bill) => (
                  <div key={bill.id} className="bg-white rounded-2xl border border-border p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-lg text-xs font-semibold">
                          {bill.congress}th Congress
                        </span>
                        <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-lg text-xs">
                          {bill.bill_type} {bill.bill_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {bill.urgency && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgencyColor(bill.urgency)}`}>
                            {bill.urgency} priority
                          </span>
                        )}
                        {bill.relevance_score && (
                          <span className="px-2 py-0.5 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs font-semibold">
                            Score: {bill.relevance_score}/10
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-[#1B2A4A] text-base mb-2">{bill.title}</h3>
                    {bill.practice_areas?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {bill.practice_areas.map((area) => (
                          <span key={area} className="px-2 py-0.5 bg-[#B76E79]/10 text-[#B76E79] rounded-full text-xs">{area}</span>
                        ))}
                      </div>
                    )}
                    {bill.ai_summary && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{bill.ai_summary}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <a
                        href={bill.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B2A4A] text-white rounded-full text-xs font-semibold hover:bg-[#1B2A4A]/90 transition-all"
                      >
                        View on Congress.gov →
                      </a>
                      <span className="text-xs text-muted-foreground">
                        Saved {new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* RESEARCH HISTORY TAB */}
        {activeTab === 'history' && (
          <section className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-[#1B2A4A]">📋 Research History</h2>
              <span className="text-sm text-muted-foreground">{researchHistory.length} sessions</span>
            </div>
            {researchHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border p-12 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-muted-foreground">No research history yet. Use the search or ask Lexi to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {researchHistory.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-border p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-semibold text-[#1B2A4A] text-sm">{item.query}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.research_type && (
                            <span className="px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-full text-xs">{item.research_type}</span>
                          )}
                          {item.state_filter && (
                            <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-full text-xs">📍 {item.state_filter}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.response}</p>
                    <button
                      onClick={() => { setLexiQuery(item.query); setActiveTab('search'); }}
                      className="mt-3 text-xs font-semibold text-[#B76E79] hover:text-[#B76E79]/80 transition-colors"
                    >
                      Re-run this research →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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
