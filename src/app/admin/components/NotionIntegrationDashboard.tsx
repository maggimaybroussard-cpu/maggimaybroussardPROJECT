'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotionPage {
  id: string;
  object: 'page' | 'database';
  title: string;
  url: string;
  last_edited_time: string;
  created_time: string;
  icon?: string | null;
  parent_type?: string;
}

interface NotionBlock {
  id: string;
  type: string;
  content: string;
}

interface SyncResult {
  synced: number;
  total: number;
  message?: string;
}

interface CaseOption {
  id: string;
  name: string;
  email: string;
  service: string;
}

type ActiveView = 'search' | 'create' | 'sync';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function NotionLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#000" fillOpacity="0.08" />
      <path d="M6 5h8.5L18 8.5V19H6V5z" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 5v4h4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="9" y1="11" x2="15" y2="11" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="9" y1="14" x2="15" y2="14" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="9" y1="17" x2="12" y2="17" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotionIntegrationDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('search');
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'page' | 'database'>('all');
  const [searchResults, setSearchResults] = useState<NotionPage[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Page viewer state
  const [selectedPage, setSelectedPage] = useState<NotionPage | null>(null);
  const [pageBlocks, setPageBlocks] = useState<NotionBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Create page state
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);

  // Sync state
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [syncQuery, setSyncQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Check API config ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/notion/status')
      .then((r) => r.json())
      .then((d) => setApiConfigured(d.configured ?? false))
      .catch(() => setApiConfigured(false));
  }, []);

  // ── Load cases for sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeView !== 'sync') return;
    fetch('/api/notion/cases')
      .then((r) => r.json())
      .then((d) => setCases(d.cases ?? []))
      .catch(() => {});
  }, [activeView]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    setSelectedPage(null);
    setPageBlocks([]);
    try {
      const params = new URLSearchParams({ query: searchQuery });
      if (filterType !== 'all') params.set('filter', filterType);
      const res = await fetch(`/api/notion/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, filterType]);

  // Auto-search on mount when configured
  useEffect(() => {
    if (activeView === 'search' && apiConfigured === true) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, apiConfigured]);

  // ── Load page blocks ──────────────────────────────────────────────────────
  const handleViewPage = async (page: NotionPage) => {
    setSelectedPage(page);
    setLoadingBlocks(true);
    setPageBlocks([]);
    try {
      const res = await fetch(`/api/notion/page-blocks?pageId=${page.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load page');
      setPageBlocks(data.blocks ?? []);
    } catch {
      setPageBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  // ── Create page ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch('/api/notion/create-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle,
          content: createContent,
          parentPageId: createParentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create page');
      setCreateResult({ success: true, message: 'Page created successfully!', url: data.url });
      setCreateTitle('');
      setCreateContent('');
      setCreateParentId('');
    } catch (err) {
      setCreateResult({ success: false, message: err instanceof Error ? err.message : 'Failed to create page' });
    } finally {
      setCreating(false);
    }
  };

  // ── Sync case notes ───────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!selectedCaseId) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const selectedCase = cases.find((c) => c.id === selectedCaseId);
      const res = await fetch('/api/notion/sync-case-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseId,
          query: syncQuery || selectedCase?.name || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ─── Render block content ─────────────────────────────────────────────────
  function renderBlock(block: NotionBlock) {
    switch (block.type) {
      case 'heading_1':
        return <h2 key={block.id} className="text-lg font-serif font-semibold text-foreground mt-5 mb-2">{block.content}</h2>;
      case 'heading_2':
        return <h3 key={block.id} className="text-base font-semibold text-foreground mt-4 mb-1.5">{block.content}</h3>;
      case 'heading_3':
        return <h4 key={block.id} className="text-sm font-semibold text-foreground mt-3 mb-1">{block.content}</h4>;
      case 'bulleted_list_item':
        return <li key={block.id} className="ml-5 text-sm text-foreground list-disc">{block.content}</li>;
      case 'numbered_list_item':
        return <li key={block.id} className="ml-5 text-sm text-foreground list-decimal">{block.content}</li>;
      case 'to_do':
        return (
          <div key={block.id} className="flex items-start gap-2 my-1">
            <span className="w-4 h-4 mt-0.5 rounded border border-border flex-shrink-0 bg-secondary/30" />
            <span className="text-sm text-foreground">{block.content}</span>
          </div>
        );
      case 'quote':
        return <blockquote key={block.id} className="border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground italic my-2">{block.content}</blockquote>;
      case 'callout':
        return (
          <div key={block.id} className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 my-2">
            <span>📌</span>
            <span className="text-sm text-amber-800">{block.content}</span>
          </div>
        );
      case 'divider':
        return <hr key={block.id} className="border-border my-4" />;
      default:
        return block.content ? (
          <p key={block.id} className="text-sm text-foreground leading-relaxed my-1.5">{block.content}</p>
        ) : null;
    }
  }

  // ─── Not configured state ─────────────────────────────────────────────────
  if (apiConfigured === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary/40 flex items-center justify-center mb-5">
          <NotionLogo size={28} />
        </div>
        <h2 className="font-serif text-xl text-foreground mb-2">Notion API Key Required</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Add your <code className="bg-secondary/60 px-1.5 py-0.5 rounded text-xs font-mono">NOTION_API_KEY</code> to your environment variables to connect your Notion workspace.
        </p>
        <div className="bg-card border border-border rounded-2xl p-5 text-left max-w-md w-full">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Setup Steps</p>
          <ol className="space-y-2.5 text-sm text-foreground">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span>Go to <strong>notion.so/my-integrations</strong> and create a new integration</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <span>Copy the <strong>Internal Integration Token</strong></span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <span>Add <code className="bg-secondary/60 px-1 py-0.5 rounded text-xs font-mono">NOTION_API_KEY=your_token</code> to your <code className="bg-secondary/60 px-1 py-0.5 rounded text-xs font-mono">.env</code> file</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
              <span>Share the pages/databases you want to access with your integration in Notion</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  if (apiConfigured === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/40 flex items-center justify-center">
            <NotionLogo size={20} />
          </div>
          <div>
            <h2 className="font-serif text-lg text-foreground">Notion Workspace</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1">
          {([
            { id: 'search', label: 'Browse', icon: '🔍' },
            { id: 'create', label: 'Create Page', icon: '✏️' },
            { id: 'sync', label: 'Sync to Case', icon: '🔄' },
          ] as { id: ActiveView; label: string; icon: string }[]).map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeView === v.id
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search / Browse View ── */}
      {activeView === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: search panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Search Workspace</p>

              <div className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search pages, databases…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />

                <div className="flex gap-2">
                  {(['all', 'page', 'database'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        filterType === f
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'page' ? 'Pages' : 'Databases'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {searching ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Searching…
                    </>
                  ) : 'Search'}
                </button>
              </div>

              {searchError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{searchError}</div>
              )}
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border/60">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    {searchResults.length} Result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                  {searchResults.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => handleViewPage(page)}
                      className={`w-full text-left px-5 py-3.5 hover:bg-secondary/30 transition-colors ${
                        selectedPage?.id === page.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base mt-0.5 flex-shrink-0">
                          {page.icon || (page.object === 'database' ? '🗄️' : '📄')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{page.title || 'Untitled'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              page.object === 'database' ?'bg-purple-100 text-purple-700' :'bg-blue-100 text-blue-700'
                            }`}>
                              {page.object}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDate(page.last_edited_time)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searching && searchResults.length === 0 && !searchError && (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No results yet. Search your workspace above.</p>
              </div>
            )}
          </div>

          {/* Right: page viewer */}
          <div className="lg:col-span-3">
            {selectedPage ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">{selectedPage.icon || (selectedPage.object === 'database' ? '🗄️' : '📄')}</span>
                    <div className="min-w-0">
                      <h3 className="font-serif text-base text-foreground truncate">{selectedPage.title || 'Untitled'}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Last edited {formatDate(selectedPage.last_edited_time)}</p>
                    </div>
                  </div>
                  <a
                    href={selectedPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Open in Notion
                  </a>
                </div>

                <div className="px-6 py-5 max-h-[520px] overflow-y-auto">
                  {loadingBlocks ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : pageBlocks.length > 0 ? (
                    <div className="space-y-0.5">
                      {pageBlocks.map((block) => renderBlock(block))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">This page appears to be empty.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center h-full min-h-[300px]">
                <div className="w-12 h-12 rounded-xl bg-secondary/40 flex items-center justify-center mb-4">
                  <NotionLogo size={22} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Select a page to preview</p>
                <p className="text-xs text-muted-foreground">Search your workspace and click any result to view its content here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Page View ── */}
      {activeView === 'create' && (
        <div className="max-w-2xl">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Create New Notion Page</p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Page Title *</label>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Case Notes — Smith v. Jones"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                Parent Page ID <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={createParentId}
                onChange={(e) => setCreateParentId(e.target.value)}
                placeholder="Paste Notion page ID to nest under a parent"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to create at workspace root. Find the ID in the page URL after the last dash.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                Initial Content <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                rows={6}
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value)}
                placeholder="Add initial content for the page. Each line will become a paragraph block."
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all resize-none"
              />
            </div>

            {createResult && (
              <div className={`p-4 rounded-xl border text-sm ${
                createResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-700'
              }`}>
                <p className="font-medium">{createResult.message}</p>
                {createResult.url && (
                  <a
                    href={createResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs underline underline-offset-2"
                  >
                    Open in Notion
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !createTitle.trim()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create Page in Notion
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Sync to Case View ── */}
      {activeView === 'sync' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Sync Notion Pages to Case Notes</p>
              <p className="text-sm text-muted-foreground">
                Search your Notion workspace for pages matching a query and sync their content as case notes for a specific client matter.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Select Case *</label>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              >
                <option value="">— Choose a case —</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.service}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Notion Search Query</label>
              <input
                type="text"
                value={syncQuery}
                onChange={(e) => setSyncQuery(e.target.value)}
                placeholder="e.g. client name, matter number, case topic…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the client&apos;s name as the search query.</p>
            </div>

            {syncResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-semibold text-emerald-800">
                  ✓ Synced {syncResult.synced} of {syncResult.total} Notion pages
                </p>
                {syncResult.message && (
                  <p className="text-xs text-emerald-700 mt-1">{syncResult.message}</p>
                )}
              </div>
            )}

            {syncError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{syncError}</div>
            )}

            <button
              onClick={handleSync}
              disabled={syncing || !selectedCaseId}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                  Sync Notion Pages to Case
                </>
              )}
            </button>
          </div>

          {/* Info card */}
          <div className="bg-secondary/20 border border-border/60 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">How Sync Works</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">1.</span>
                Searches your Notion workspace using the provided query
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">2.</span>
                Fetches content from matching pages (up to 10 results)
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">3.</span>
                Saves each page as a case note linked to the selected matter
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">4.</span>
                Client can view synced notes in their portal under &quot;Case Notes&quot;
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
