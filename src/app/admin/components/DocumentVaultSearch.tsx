'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentResult {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role: string;
  category: string | null;
  document_type: string | null;
  description: string | null;
  client_visible: boolean;
  version: number;
  created_at: string;
  contact_inquiries?: {
    name: string;
    email: string;
    service: string;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'filing', label: 'Pleading / Filing' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'contract', label: 'Contract' },
  { value: 'work_product', label: 'Work Product' },
  { value: 'other', label: 'Other' },
];

const TYPE_ICONS: Record<string, string> = {
  discovery: '🔍',
  filing: '⚖️',
  correspondence: '✉️',
  evidence: '🗂️',
  contract: '📄',
  work_product: '📝',
  other: '📁',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// duplicate removed

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentVaultSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [results, setResults] = useState<DocumentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [recentDocs, setRecentDocs] = useState<DocumentResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch recent docs on mount
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('case_documents')
          .select('id, inquiry_id, file_name, file_url, file_type, file_size, uploaded_by, uploaded_by_role, category, document_type, description, client_visible, version, created_at')
          .order('created_at', { ascending: false })
          .limit(6);
        setRecentDocs((data ?? []) as DocumentResult[]);
      } catch {
        // silently fail
      }
    };
    fetchRecent();
  }, []);

  const searchDocuments = useCallback(async (q: string, type: string, role: string, pageNum: number) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let queryBuilder = supabase
        .from('case_documents')
        .select(`
          id, inquiry_id, file_name, file_url, file_type, file_size,
          uploaded_by, uploaded_by_role, category, document_type, description,
          client_visible, version, created_at,
          contact_inquiries!inner(name, email, service)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (q.trim()) {
        queryBuilder = queryBuilder.or(
          `file_name.ilike.%${q}%,description.ilike.%${q}%,uploaded_by.ilike.%${q}%`
        );
      }
      if (type) queryBuilder = queryBuilder.eq('document_type', type);
      if (role) queryBuilder = queryBuilder.eq('uploaded_by_role', role);

      const { data, count, error } = await queryBuilder;
      if (error) throw error;

      const docs = (data ?? []) as DocumentResult[];
      if (pageNum === 0) {
        setResults(docs);
      } else {
        setResults(prev => [...prev, ...docs]);
      }
      setTotalCount(count ?? 0);
      setHasMore(docs.length === PAGE_SIZE);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    searchDocuments(debouncedQuery, filterType, filterRole, 0);
  }, [debouncedQuery, filterType, filterRole, searchDocuments]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchDocuments(debouncedQuery, filterType, filterRole, nextPage);
  };

  const displayResults = debouncedQuery || filterType || filterRole ? results : [];
  const showRecent = !debouncedQuery && !filterType && !filterRole;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-serif text-foreground">Document Vault Search</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Full-text search across all uploaded client documents</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <span className="text-muted-foreground text-sm">🔍</span>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by file name, description, client name…"
          className="w-full pl-10 pr-4 py-3.5 bg-background border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Uploaders</option>
          <option value="admin">Admin</option>
          <option value="client">Client</option>
          <option value="paralegal">Paralegal</option>
        </select>
        {(query || filterType || filterRole) && (
          <button
            onClick={() => { setQuery(''); setFilterType(''); setFilterRole(''); }}
            className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      {(debouncedQuery || filterType || filterRole) && !loading && (
        <p className="text-xs text-muted-foreground">
          {totalCount.toLocaleString()} document{totalCount !== 1 ? 's' : ''} found
          {debouncedQuery ? ` for "${debouncedQuery}"` : ''}
        </p>
      )}

      {/* Loading */}
      {loading && page === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Recent Documents (when no search) */}
      {showRecent && recentDocs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Recently Uploaded</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentDocs.map(doc => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {!showRecent && !loading && displayResults.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-3xl mb-3">📂</p>
          <p className="text-sm font-medium">No documents found</p>
          <p className="text-xs mt-1">Try a different search term or adjust filters</p>
        </div>
      )}

      {!showRecent && displayResults.length > 0 && (
        <div className="space-y-2">
          {displayResults.map(doc => (
            <DocumentRow key={doc.id} doc={doc} query={debouncedQuery} />
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading…' : `Load more (${totalCount - displayResults.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Document Card (grid view) ────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: DocumentResult }) {
  const icon = getFileIcon(doc.file_type, doc.file_name);
  const typeIcon = doc.document_type ? TYPE_ICONS[doc.document_type] ?? '📁' : '📁';

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(doc.created_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {doc.document_type && (
          <span className="px-2 py-0.5 bg-secondary/50 rounded-full text-[10px] text-muted-foreground">
            {typeIcon} {doc.document_type}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{fmtBytes(doc.file_size)}</span>
        <span className="text-[10px] text-muted-foreground capitalize">{doc.uploaded_by_role}</span>
      </div>
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
        >
          View Document
        </a>
      )}
    </div>
  );
}

// ─── Document Row (list view with highlight) ──────────────────────────────────

function DocumentRow({ doc, query }: { doc: DocumentResult; query: string }) {
  const icon = getFileIcon(doc.file_type, doc.file_name);
  const typeIcon = doc.document_type ? TYPE_ICONS[doc.document_type] ?? '📁' : '📁';

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{highlight(doc.file_name)}</p>
              {doc.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{highlight(doc.description)}</p>
              )}
              {doc.contact_inquiries && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: <span className="text-foreground">{highlight(doc.contact_inquiries.name)}</span>
                  {doc.contact_inquiries.service && ` · ${doc.contact_inquiries.service}`}
                </p>
              )}
            </div>
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                View
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {doc.document_type && (
              <span className="text-[10px] text-muted-foreground">{typeIcon} {doc.document_type}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{fmtBytes(doc.file_size)}</span>
            <span className="text-[10px] text-muted-foreground capitalize">by {doc.uploaded_by_role}</span>
            <span className="text-[10px] text-muted-foreground">{fmtDate(doc.created_at)}</span>
            {doc.version > 1 && (
              <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getFileIcon(fileType: string | null, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (fileType?.includes('pdf') || ext === 'pdf') return '📕';
  if (fileType?.includes('word') || ext === 'doc' || ext === 'docx') return '📘';
  if (fileType?.includes('excel') || ext === 'xls' || ext === 'xlsx') return '📗';
  if (fileType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (fileType?.includes('text') || ext === 'txt') return '📄';
  return '📎';
}
