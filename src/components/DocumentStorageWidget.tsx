'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoredDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  category: 'contract' | 'pleading' | 'correspondence' | 'evidence' | 'invoice' | 'intake' | 'other';
  client: string;
  matter: string;
  tags: string[];
  uploadedAt: string;
  dataUrl?: string;
  lexiAnalysis?: string;
  lexiLinked?: boolean;
  starred?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'bg-blue-100 text-blue-700',
  pleading: 'bg-red-100 text-red-700',
  correspondence: 'bg-green-100 text-green-700',
  evidence: 'bg-amber-100 text-amber-700',
  invoice: 'bg-violet-100 text-violet-700',
  intake: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-600',
};

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/': '🖼️',
  'text/': '📝',
  'application/msword': '📃',
  'application/vnd.openxmlformats-officedocument.wordprocessingml': '📃',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml': '📊',
};

function getFileIcon(type: string): string {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(key)) return icon;
  }
  return '📎';
}

const STORAGE_KEY = 'bls_document_storage';

function loadDocs(): StoredDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDocs(docs: StoredDocument[]) {
  try {
    // Save without dataUrl to keep storage small
    const lite = docs.map(({ dataUrl: _, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lite));
  } catch { /* ignore */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DocumentStorageWidgetProps {
  floating?: boolean;
  lexiMode?: boolean;
  onSendToLexi?: (doc: StoredDocument) => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentStorageWidget({
  floating = false,
  lexiMode = false,
  onSendToLexi,
  className = '',
}: DocumentStorageWidgetProps) {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [view, setView] = useState<'files' | 'upload' | 'search'>('files');
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [selected, setSelected] = useState<StoredDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    client: '',
    matter: '',
    category: 'other' as StoredDocument['category'],
    tags: '',
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    setDocs(loadDocs());
  }, []);

  const updateDocs = useCallback((updated: StoredDocument[]) => {
    setDocs(updated);
    saveDocs(updated);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setView('upload');
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    const newDocs: StoredDocument[] = [];

    for (const file of pendingFiles) {
      let dataUrl: string | undefined;
      try {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch { /* ignore */ }

      newDocs.push({
        id: uid(),
        name: file.name,
        type: file.type,
        size: file.size,
        category: uploadForm.category,
        client: uploadForm.client.trim(),
        matter: uploadForm.matter.trim(),
        tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        uploadedAt: new Date().toISOString(),
        dataUrl,
        lexiLinked: false,
        starred: false,
      });
    }

    updateDocs([...newDocs, ...docs]);
    setPendingFiles([]);
    setUploadForm({ client: '', matter: '', category: 'other', tags: '' });
    setUploading(false);
    setView('files');
  };

  const handleDelete = (id: string) => {
    updateDocs(docs.filter(d => d.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleStar = (id: string) => {
    updateDocs(docs.map(d => d.id === id ? { ...d, starred: !d.starred } : d));
  };

  const handleSendToLexi = (doc: StoredDocument) => {
    updateDocs(docs.map(d => d.id === doc.id ? { ...d, lexiLinked: true } : d));
    onSendToLexi?.(doc);
  };

  const filtered = docs.filter(d => {
    const matchesCat = filterCat === 'all' || d.category === filterCat;
    const matchesSearch = !search || [d.name, d.client, d.matter, ...d.tags].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // ── Floating collapsed ────────────────────────────────────────────────────
  if (floating && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-40 right-4 z-[150] w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
        aria-label="Open document storage"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {docs.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
            {docs.length > 9 ? '9+' : docs.length}
          </span>
        )}
      </button>
    );
  }

  const containerClass = floating
    ? `fixed bottom-40 right-4 z-[150] w-80 bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`
    : `bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${className}`;

  return (
    <div className={containerClass} style={{ maxHeight: floating ? '520px' : undefined }}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">📁</span>
          <div>
            <p className="text-xs font-bold text-foreground">Document Storage</p>
            <p className="text-[10px] text-muted-foreground">{docs.length} document{docs.length !== 1 ? 's' : ''} stored</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {lexiMode && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Lexi</span>
          )}
          {floating && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground"
              aria-label="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(['files', 'upload', 'search'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              view === v ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'upload' ? '+ Upload' : v}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Files view */}
        {view === 'files' && (
          <div className="p-3 space-y-2">
            {/* Category filter */}
            <div className="flex gap-1 flex-wrap">
              {['all', 'contract', 'pleading', 'correspondence', 'evidence', 'invoice', 'intake', 'other'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                    filterCat === cat ? 'bg-blue-500 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300 hover:bg-blue-50/30'
              }`}
            >
              <p className="text-[10px] text-muted-foreground">Drop files here or <span className="text-blue-600 font-semibold">click to upload</span></p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-xs">
                No documents yet. Upload your first file above.
              </div>
            )}

            {filtered.map(doc => (
              <div
                key={doc.id}
                className={`rounded-xl border p-3 cursor-pointer transition-all hover:border-blue-300 ${
                  selected?.id === doc.id ? 'border-blue-400 bg-blue-50' : 'border-border bg-secondary/20'
                }`}
                onClick={() => setSelected(selected?.id === doc.id ? null : doc)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-lg shrink-0">{getFileIcon(doc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[doc.category]}`}>
                          {doc.category}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{fmtSize(doc.size)}</span>
                        {doc.client && <span className="text-[9px] text-muted-foreground truncate">{doc.client}</span>}
                        {doc.lexiLinked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Lexi</span>}
                      </div>
                      {doc.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {doc.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); handleStar(doc.id); }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${doc.starred ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                      title="Star"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={doc.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    {(lexiMode || onSendToLexi) && !doc.lexiLinked && (
                      <button
                        onClick={e => { e.stopPropagation(); handleSendToLexi(doc); }}
                        className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200 flex items-center justify-center transition-colors"
                        title="Send to Lexi"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
                      title="Delete"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?.id === doc.id && (
                  <div className="mt-2 pt-2 border-t border-border space-y-1">
                    {doc.matter && <p className="text-[10px] text-muted-foreground">Matter: <span className="text-foreground">{doc.matter}</span></p>}
                    <p className="text-[10px] text-muted-foreground">
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {doc.lexiAnalysis && (
                      <div className="bg-violet-50 rounded-lg p-2 border border-violet-200">
                        <p className="text-[9px] font-bold text-violet-700 uppercase tracking-widest mb-1">Lexi Analysis</p>
                        <p className="text-[10px] text-violet-800">{doc.lexiAnalysis}</p>
                      </div>
                    )}
                    {doc.dataUrl && doc.type.startsWith('image/') && (
                      <img src={doc.dataUrl} alt={doc.name} className="w-full rounded-lg border border-border mt-1" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload view */}
        {view === 'upload' && (
          <div className="p-4 space-y-3">
            {pendingFiles.length === 0 ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300'
                }`}
              >
                <div className="text-3xl mb-2">📤</div>
                <p className="text-xs font-semibold text-foreground">Drop files or click to browse</p>
                <p className="text-[10px] text-muted-foreground mt-1">PDF, Word, Excel, Images supported</p>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
              </div>
            ) : (
              <>
                <div className="bg-secondary/40 rounded-xl p-3 border border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Files to Upload</p>
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span>{getFileIcon(f.type)}</span>
                      <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={uploadForm.client}
                  onChange={e => setUploadForm(p => ({ ...p, client: e.target.value }))}
                  placeholder="Client name"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <input
                  type="text"
                  value={uploadForm.matter}
                  onChange={e => setUploadForm(p => ({ ...p, matter: e.target.value }))}
                  placeholder="Matter / case reference"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
                  <select
                    value={uploadForm.category}
                    onChange={e => setUploadForm(p => ({ ...p, category: e.target.value as StoredDocument['category'] }))}
                    className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  >
                    {['contract', 'pleading', 'correspondence', 'evidence', 'invoice', 'intake', 'other'].map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={e => setUploadForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="Tags (comma-separated)"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPendingFiles([]); setView('files'); }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search view */}
        {view === 'search' && (
          <div className="p-3 space-y-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, client, matter, tag..."
              autoFocus
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            {search && (
              <p className="text-[10px] text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            )}
            {filtered.map(doc => (
              <div key={doc.id} className="rounded-xl border border-border p-3 bg-secondary/20">
                <div className="flex items-center gap-2">
                  <span>{getFileIcon(doc.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.client} · {doc.matter}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[doc.category]}`}>
                    {doc.category}
                  </span>
                </div>
              </div>
            ))}
            {search && filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">No documents match your search.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
