'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { caseFoldersStore, pinnedFilesStore, billingStore, audioStore, searchHistoryStore } from '@/lib/localPersistence';


// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'case' | 'client' | 'document' | 'folder' | 'recording' | 'billing';
  title: string;
  subtitle: string;
  meta?: string;
  badge?: string;
  badgeColor?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark> : part
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'case' | 'client' | 'document' | 'folder' | 'recording' | 'billing'>('all');

  useEffect(() => {
    setSearchHistory(searchHistoryStore.get());
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const allResults: SearchResult[] = [];
    const lower = q.toLowerCase();

    try {
      const supabase = createClient();

      // Search cases/inquiries
      const { data: cases } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status, created_at')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,service.ilike.%${q}%`)
        .limit(10);

      (cases || []).forEach(c => {
        allResults.push({
          id: `case_${c.id}`,
          type: 'case',
          title: c.name,
          subtitle: `${c.service} · ${c.email}`,
          meta: new Date(c.created_at).toLocaleDateString(),
          badge: c.status,
          badgeColor: c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600',
        });
      });

      // Search case documents
      const { data: docs } = await supabase
        .from('case_documents')
        .select('id, file_name, file_type, category, uploaded_by, created_at')
        .ilike('file_name', `%${q}%`)
        .limit(10);

      (docs || []).forEach(d => {
        allResults.push({
          id: `doc_${d.id}`,
          type: 'document',
          title: d.file_name,
          subtitle: `${d.category ?? 'Document'} · ${d.file_type ?? ''}`,
          meta: new Date(d.created_at).toLocaleDateString(),
          badge: d.file_type?.toUpperCase(),
          badgeColor: 'bg-blue-100 text-blue-700',
        });
      });

      // Search engagements
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id, title, matter_number, engagement_type, status, start_date')
        .or(`title.ilike.%${q}%,matter_number.ilike.%${q}%`)
        .limit(10);

      (engagements || []).forEach(e => {
        allResults.push({
          id: `engagement_${e.id}`,
          type: 'case',
          title: e.title,
          subtitle: `${e.engagement_type} · ${e.matter_number ?? 'No matter #'}`,
          meta: e.start_date ? new Date(e.start_date).toLocaleDateString() : '',
          badge: e.status,
          badgeColor: e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600',
        });
      });

    } catch {
      // Supabase search failed — continue with local results
    }

    // Search local folders
    const folders = caseFoldersStore.get().filter(f =>
      f.name.toLowerCase().includes(lower) ||
      f.clientName.toLowerCase().includes(lower) ||
      (f.caseRef && f.caseRef.toLowerCase().includes(lower))
    );
    folders.forEach(f => {
      allResults.push({
        id: `folder_${f.id}`,
        type: 'folder',
        title: f.name,
        subtitle: `${f.clientName}${f.caseRef ? ` · ${f.caseRef}` : ''}`,
        meta: new Date(f.createdAt).toLocaleDateString(),
        badge: f.isPinned ? 'Pinned' : undefined,
        badgeColor: 'bg-amber-100 text-amber-700',
      });
    });

    // Search pinned files
    const pinned = pinnedFilesStore.get().filter(f =>
      f.name.toLowerCase().includes(lower) ||
      (f.clientName && f.clientName.toLowerCase().includes(lower)) ||
      (f.caseRef && f.caseRef.toLowerCase().includes(lower))
    );
    pinned.forEach(f => {
      allResults.push({
        id: `pinned_${f.id}`,
        type: 'document',
        title: f.name,
        subtitle: `${f.clientName ?? ''}${f.caseRef ? ` · ${f.caseRef}` : ''} · Pinned`,
        meta: new Date(f.pinnedAt).toLocaleDateString(),
        badge: '📌',
        badgeColor: 'bg-amber-100 text-amber-700',
      });
    });

    // Search billing entries
    const billing = billingStore.get().filter(e =>
      e.description.toLowerCase().includes(lower) ||
      e.clientName.toLowerCase().includes(lower) ||
      (e.caseRef && e.caseRef.toLowerCase().includes(lower))
    );
    billing.forEach(e => {
      const hours = (e.duration / 3600).toFixed(2);
      const earned = ((e.duration / 3600) * e.rate).toFixed(2);
      allResults.push({
        id: `billing_${e.id}`,
        type: 'billing',
        title: e.description,
        subtitle: `${e.clientName}${e.caseRef ? ` · ${e.caseRef}` : ''} · ${hours}h`,
        meta: new Date(e.startTime).toLocaleDateString(),
        badge: `$${earned}`,
        badgeColor: 'bg-green-100 text-green-700',
      });
    });

    // Search audio recordings
    const audio = audioStore.getMeta().filter(r =>
      r.name.toLowerCase().includes(lower) ||
      (r.clientName && r.clientName.toLowerCase().includes(lower)) ||
      (r.caseRef && r.caseRef.toLowerCase().includes(lower))
    );
    audio.forEach(r => {
      allResults.push({
        id: `audio_${r.id}`,
        type: 'recording',
        title: r.name,
        subtitle: `${r.clientName ?? ''}${r.caseRef ? ` · ${r.caseRef}` : ''}`,
        meta: new Date(r.createdAt).toLocaleDateString(),
        badge: '🎙️',
        badgeColor: 'bg-purple-100 text-purple-700',
      });
    });

    setResults(allResults);
    setIsSearching(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim()) {
      searchHistoryStore.add(q.trim());
      setSearchHistory(searchHistoryStore.get());
    }
  };

  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter(r => r.type === activeFilter);
  }, [results, activeFilter]);

  const TYPE_ICONS: Record<string, string> = {
    case: '⚖️',
    client: '👤',
    document: '📄',
    folder: '📁',
    recording: '🎙️',
    billing: '💰',
  };

  const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'case', label: 'Cases' },
    { id: 'document', label: 'Docs' },
    { id: 'folder', label: 'Folders' },
    { id: 'billing', label: 'Billing' },
    { id: 'recording', label: 'Audio' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🔍</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Search</p>
            <p className="text-[10px] text-muted-foreground">Search across cases, files, folders & more</p>
          </div>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search cases, clients, documents, folders…"
            className="w-full pl-8 pr-8 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Filter tabs */}
        {query && results.length > 0 && (
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {FILTER_OPTIONS.map(f => {
              const count = f.id === 'all' ? results.length : results.filter(r => r.type === f.id).length;
              if (f.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${activeFilter === f.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  {f.label} {count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading */}
        {isSearching && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Searching…
          </div>
        )}

        {/* Results */}
        {!isSearching && query && filteredResults.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-muted-foreground mb-1">{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for "{query}"</p>
            {filteredResults.map(result => (
              <div key={result.id} className="p-3 rounded-xl border border-border bg-background hover:border-primary/30 hover:bg-primary/3 transition-all cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[result.type] ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-foreground">{highlight(result.title, query)}</p>
                      {result.badge && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${result.badgeColor}`}>{result.badge}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{highlight(result.subtitle, query)}</p>
                    {result.meta && <p className="text-[10px] text-muted-foreground mt-0.5">{result.meta}</p>}
                  </div>
                  <span className="text-[9px] text-muted-foreground capitalize shrink-0 bg-secondary px-1.5 py-0.5 rounded">{result.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!isSearching && query && filteredResults.length === 0 && results.length > 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            <p>No {activeFilter} results for "{query}"</p>
            <button onClick={() => setActiveFilter('all')} className="mt-2 text-primary underline text-[10px]">Show all results</button>
          </div>
        )}

        {!isSearching && query && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <p className="text-2xl mb-2">🔍</p>
            <p>No results found for "{query}"</p>
            <p className="mt-1">Try different keywords or check spelling.</p>
          </div>
        )}

        {/* Search history */}
        {!query && searchHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Searches</p>
              <button
                onClick={() => { searchHistoryStore.clear(); setSearchHistory([]); }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(h)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span className="text-xs text-foreground">{h}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!query && searchHistory.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <p className="text-2xl mb-2">🔍</p>
            <p>Search across all your cases, clients,</p>
            <p>documents, folders, billing, and recordings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
