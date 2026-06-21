'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ResearchEntry {
  id: string;
  query: string;
  category: string;
  summary: string;
  matter_ref: string | null;
  matter_name: string | null;
  tags: string[];
  created_at: string;
  is_pinned: boolean;
}

interface LexiResearchHistoryProps {
  currentQuery?: string;
  currentSummary?: string;
  currentCategory?: string;
  onLoadEntry?: (entry: ResearchEntry) => void;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LexiResearchHistory({ currentQuery, currentSummary, currentCategory, onLoadEntry }: LexiResearchHistoryProps) {
  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState({ matterRef: '', matterName: '', tags: '' });
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [search, setSearch] = useState('');
  const [matterFilter, setMatterFilter] = useState('all');
  const [savedId, setSavedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('lexi_research_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setEntries(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSave = async () => {
    if (!currentQuery || !currentSummary) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const tags = saveForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const { data, error } = await supabase.from('lexi_research_history').insert({
        query: currentQuery,
        category: currentCategory || 'all',
        summary: currentSummary,
        matter_ref: saveForm.matterRef || null,
        matter_name: saveForm.matterName || null,
        tags,
        is_pinned: false,
      }).select().single();
      if (error) throw error;
      setSavedId(data.id);
      setShowSaveForm(false);
      setSaveForm({ matterRef: '', matterName: '', tags: '' });
      fetchEntries();
      setTimeout(() => setSavedId(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePin = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from('lexi_research_history').update({ is_pinned: !current }).eq('id', id);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('lexi_research_history').delete().eq('id', id);
    fetchEntries();
  };

  const matters = [...new Set(entries.map(e => e.matter_name).filter(Boolean))];

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.query.toLowerCase().includes(search.toLowerCase()) || e.summary.toLowerCase().includes(search.toLowerCase()) || e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchMatter = matterFilter === 'all' || e.matter_name === matterFilter;
    return matchSearch && matchMatter;
  });

  const pinned = filtered.filter(e => e.is_pinned);
  const unpinned = filtered.filter(e => !e.is_pinned);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/20 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Legal Research History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Save, tag, and organize research sessions by matter</p>
          </div>
          {currentQuery && currentSummary && (
            <button onClick={() => setShowSaveForm(!showSaveForm)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${savedId ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
              {savedId ? '✓ Saved' : '+ Save Current'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Save form */}
        {showSaveForm && (
          <div className="p-4 border-b border-border bg-secondary/10">
            <p className="text-xs font-semibold text-foreground mb-3">Save: &ldquo;{currentQuery?.slice(0, 60)}…&rdquo;</p>
            <div className="space-y-2">
              <input value={saveForm.matterName} onChange={e => setSaveForm(p => ({ ...p, matterName: e.target.value }))} placeholder="Matter name (e.g. Smith v. Jones)" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={saveForm.matterRef} onChange={e => setSaveForm(p => ({ ...p, matterRef: e.target.value }))} placeholder="Matter ref / case number (optional)" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={saveForm.tags} onChange={e => setSaveForm(p => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated, e.g. employment, discrimination)" className="w-full px-3 py-2 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="flex gap-2">
                <button onClick={() => setShowSaveForm(false)} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#355E3B', color: '#fff' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & filter */}
        <div className="p-3 border-b border-border flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search research…" className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {matters.length > 0 && (
            <select value={matterFilter} onChange={e => setMatterFilter(e.target.value)} className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs text-foreground focus:outline-none">
              <option value="all">All Matters</option>
              {matters.map(m => <option key={m!} value={m!}>{m}</option>)}
            </select>
          )}
        </div>

        {/* Entries */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {entries.length === 0 ? 'No saved research yet. Run a search and click "Save Current" to save it here.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {[...pinned, ...unpinned].map(entry => (
              <div key={entry.id} className={`p-3 hover:bg-secondary/20 transition-all ${entry.is_pinned ? 'bg-amber-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {entry.is_pinned && <span className="text-amber-500 text-xs">📌</span>}
                      <p className="text-xs font-semibold text-foreground truncate">{entry.query}</p>
                    </div>
                    {entry.matter_name && (
                      <p className="text-[10px] text-primary font-medium mb-1">{entry.matter_name}{entry.matter_ref ? ` · ${entry.matter_ref}` : ''}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{entry.summary.slice(0, 120)}…</p>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full border border-border">{tag}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{fmtDate(entry.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {onLoadEntry && (
                      <button onClick={() => onLoadEntry(entry)} className="text-[10px] text-primary hover:underline">Load</button>
                    )}
                    <button onClick={() => handlePin(entry.id, entry.is_pinned)} className="text-[10px] text-muted-foreground hover:text-amber-500 transition-colors">{entry.is_pinned ? 'Unpin' : 'Pin'}</button>
                    <button onClick={() => handleDelete(entry.id)} className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
