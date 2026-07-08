'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  description: string | null;
  uploaded_by: string;
  created_at: string;
  inquiry_id?: string | null;
  contact_inquiries?: { name: string; email: string; service: string } | null;
}

interface DocStats {
  total: number;
  totalSize: number;
  byCategory: Record<string, number>;
  recentUploads: number;
}

interface QueuedFile {
  id: string;
  file: File;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const CATEGORIES = [
  'All',
  'Contracts',
  'Engagement Letters',
  'Invoices',
  'Case Files',
  'Court Documents',
  'Client Intake',
  'Templates',
  'Reports',
  'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  Contracts: 'bg-blue-100 text-blue-700',
  'Engagement Letters': 'bg-purple-100 text-purple-700',
  Invoices: 'bg-amber-100 text-amber-700',
  'Case Files': 'bg-emerald-100 text-emerald-700',
  'Court Documents': 'bg-red-100 text-red-700',
  'Client Intake': 'bg-cyan-100 text-cyan-700',
  Templates: 'bg-indigo-100 text-indigo-700',
  Reports: 'bg-orange-100 text-orange-700',
  Other: 'bg-gray-100 text-gray-600',
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImage(fileType: string | null, fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return (fileType || '').includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

function isPDF(fileType: string | null, fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return (fileType || '').includes('pdf') || ext === 'pdf';
}

function getFileIcon(fileType: string | null, fileName: string): React.ReactNode {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = fileType || '';

  if (type.includes('pdf') || ext === 'pdf') {
    return (
      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
    );
  }
  if (type.includes('word') || ext === 'doc' || ext === 'docx') {
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
    );
  }
  if (type.includes('excel') || type.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return (
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
        </svg>
      </div>
    );
  }
  if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return (
      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
  );
}

// ─── Upload a single file with simulated progress ─────────────────────────────

async function uploadSingleFile(
  file: File,
  category: string,
  description: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const supabase = createClient();
  const path = `documents/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Simulate progress ticks while the real upload runs
  let simPct = 0;
  const ticker = setInterval(() => {
    simPct = Math.min(simPct + Math.random() * 15, 85);
    onProgress(Math.round(simPct));
  }, 300);

  try {
    const { error: storageError } = await supabase.storage
      .from('case-documents')
      .upload(path, file, { upsert: false });
    clearInterval(ticker);
    if (storageError) throw storageError;

    onProgress(90);
    const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(path);
    const fileUrl = urlData?.publicUrl || '';

    const { error: dbError } = await supabase.from('case_documents').insert({
      file_name: file.name,
      file_url: fileUrl,
      file_type: file.type,
      file_size: file.size,
      category,
      description: description || null,
      uploaded_by: 'admin',
    });
    if (dbError) throw dbError;
    onProgress(100);
  } catch (err) {
    clearInterval(ticker);
    throw err;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentManagementDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocStats>({ total: 0, totalSize: 0, byCategory: {}, recentUploads: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('case_documents')
        .select('id, file_name, file_url, file_type, file_size, category, description, uploaded_by, created_at, inquiry_id, contact_inquiries(name, email, service)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const docs: Document[] = (data || []).map((d: any) => ({
        ...d,
        contact_inquiries: Array.isArray(d.contact_inquiries) ? d.contact_inquiries[0] || null : d.contact_inquiries,
      }));

      setDocuments(docs);

      const byCategory: Record<string, number> = {};
      let totalSize = 0;
      let recentUploads = 0;
      docs.forEach((doc) => {
        const cat = doc.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        totalSize += doc.file_size || 0;
        if (doc.created_at >= weekAgo) recentUploads++;
      });

      setStats({ total: docs.length, totalSize, byCategory, recentUploads });
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.contact_inquiries?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // ── Drag-and-drop handlers ──────────────────────────────────────────────────

  const addFilesToQueue = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter((f) => f.size <= 20 * 1024 * 1024);
    if (valid.length < arr.length) {
      setUploadError(`${arr.length - valid.length} file(s) exceed 20 MB and were skipped.`);
    }
    const newItems: QueuedFile[] = valid.map((f) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file: f,
      progress: 0,
      status: 'pending',
    }));
    setFileQueue((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
      setUploadOpen(true);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = '';
    }
  };

  const removeFromQueue = (id: string) => {
    setFileQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    const pending = fileQueue.filter((f) => f.status === 'pending');
    if (pending.length === 0) { setUploadError('Please add at least one file.'); return; }
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    for (const item of pending) {
      setFileQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'uploading' } : f));
      try {
        await uploadSingleFile(item.file, uploadCategory, uploadDescription, (pct) => {
          setFileQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, progress: pct } : f));
        });
        setFileQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f));
      } catch (err: any) {
        setFileQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: 'error', error: err?.message || 'Upload failed' } : f));
      }
    }

    setUploading(false);
    const allDone = fileQueue.every((f) => f.status === 'done' || f.status === 'error');
    if (allDone) {
      const anyError = fileQueue.some((f) => f.status === 'error');
      if (!anyError) {
        setUploadSuccess('All documents uploaded successfully.');
        await fetchDocuments();
        setTimeout(() => {
          setUploadOpen(false);
          setUploadSuccess('');
          setFileQueue([]);
          setUploadDescription('');
          setUploadCategory('Other');
        }, 1500);
      } else {
        setUploadError('Some files failed to upload. Review errors below.');
        await fetchDocuments();
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('case_documents').update({ category: editCategory, description: editDescription }).eq('id', editDoc.id);
      await fetchDocuments();
      setEditDoc(null);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      const supabase = createClient();
      await supabase.from('case_documents').delete().eq('id', doc.id);
      setSelectedDoc(null);
      await fetchDocuments();
    } catch { /* silent */ }
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadOpen(false);
    setUploadError('');
    setUploadSuccess('');
    setFileQueue([]);
    setUploadDescription('');
    setUploadCategory('Other');
  };

  return (
    <div
      className="space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/10 border-4 border-dashed border-primary rounded-none pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-lg font-bold text-primary">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">PDF, images, Word, Excel · Max 20 MB each</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Document Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Centralized repository for all legal documents, case files, and reports</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground hidden sm:block">Drag &amp; drop anywhere to upload</p>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Document
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: loading ? '—' : String(stats.total), icon: '📄', color: 'bg-blue-50 text-blue-700' },
          { label: 'Total Storage', value: loading ? '—' : fmtSize(stats.totalSize), icon: '💾', color: 'bg-purple-50 text-purple-700' },
          { label: 'Uploaded This Week', value: loading ? '—' : String(stats.recentUploads), icon: '📤', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Categories', value: loading ? '—' : String(Object.keys(stats.byCategory).length), icon: '🗂️', color: 'bg-amber-50 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base mb-2 ${s.color}`}>{s.icon}</div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {!loading && Object.keys(stats.byCategory).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Documents by Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? 'All' : cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-white border-primary'
                    : `${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'} border-transparent hover:border-current`
                }`}
              >
                {cat}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${selectedCategory === cat ? 'bg-white/20' : 'bg-black/10'}`}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search documents, clients, descriptions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Document List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted/60 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted/60 rounded w-1/3" />
                  <div className="h-3 bg-muted/40 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery || selectedCategory !== 'All' ? 'Try adjusting your search or filter.' : 'Upload your first document to get started.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Uploaded</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.file_type, doc.file_name)}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[200px]">{doc.file_name}</p>
                          {doc.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {doc.category ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[doc.category] || 'bg-gray-100 text-gray-600'}`}>
                          {doc.category}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{doc.contact_inquiries?.name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{fmtSize(doc.file_size)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{fmtDate(doc.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Preview"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Download"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </a>
                        <button
                          onClick={() => { setEditDoc(doc); setEditCategory(doc.category || 'Other'); setEditDescription(doc.description || ''); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? 's' : ''} shown</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-sm transition-all group cursor-pointer"
              onClick={() => setSelectedDoc(doc)}
            >
              {/* Thumbnail */}
              {isImage(doc.file_type, doc.file_name) ? (
                <div className="h-32 bg-muted/20 overflow-hidden">
                  <img
                    src={doc.file_url}
                    alt={doc.file_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : isPDF(doc.file_type, doc.file_name) ? (
                <div className="h-32 bg-red-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
              ) : (
                <div className="h-32 bg-muted/10 flex items-center justify-center">
                  {getFileIcon(doc.file_type, doc.file_name)}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground truncate flex-1 pr-2">{doc.file_name}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </a>
                    <button onClick={() => handleDelete(doc)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {doc.category && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[doc.category] || 'bg-gray-100 text-gray-600'}`}>
                    {doc.category}
                  </span>
                )}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fmtSize(doc.file_size)}</span>
                  <span>{fmtDate(doc.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Modal ──────────────────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
              <h3 className="text-base font-bold text-foreground">Upload Documents</h3>
              <button onClick={closeUploadModal} disabled={uploading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.stopPropagation(); setIsDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); if (e.dataTransfer.files.length > 0) addFilesToQueue(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-primary/10' : 'bg-muted/40'}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isDragOver ? 'text-primary' : 'text-muted-foreground'}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isDragOver ? 'Release to add files' : 'Drag & drop files here'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">or <span className="text-primary font-semibold">click to browse</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG, TXT · Max 20 MB each</p>
                </div>
              </div>

              {/* File Queue */}
              {fileQueue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{fileQueue.length} file{fileQueue.length !== 1 ? 's' : ''} queued</p>
                  {fileQueue.map((item) => (
                    <div key={item.id} className="bg-muted/20 border border-border rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(item.file.type, item.file.name)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-foreground truncate">{item.file.name}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-muted-foreground">{fmtSize(item.file.size)}</span>
                              {item.status === 'done' && (
                                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </span>
                              )}
                              {item.status === 'error' && (
                                <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </span>
                              )}
                              {item.status === 'pending' && !uploading && (
                                <button onClick={() => removeFromQueue(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Progress bar */}
                          {(item.status === 'uploading' || item.status === 'done') && (
                            <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${item.status === 'done' ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                          {item.status === 'uploading' && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.progress}% uploaded…</p>
                          )}
                          {item.status === 'error' && item.error && (
                            <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Category + Description */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Category (applies to all files)</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Description (optional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of these documents…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {uploadError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>}
              {uploadSuccess && <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{uploadSuccess}</p>}
            </div>

            <div className="p-5 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={closeUploadModal} disabled={uploading} className="flex-1 px-4 py-2 text-sm font-semibold text-muted-foreground bg-muted/40 rounded-xl hover:bg-muted/60 disabled:opacity-40 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || fileQueue.filter((f) => f.status === 'pending').length === 0}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading
                  ? `Uploading ${fileQueue.filter((f) => f.status === 'done').length}/${fileQueue.length}…`
                  : `Upload ${fileQueue.filter((f) => f.status === 'pending').length || ''} File${fileQueue.filter((f) => f.status === 'pending').length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Preview Modal ────────────────────────────────────────────── */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
              <h3 className="text-base font-bold text-foreground truncate pr-4">{selectedDoc.file_name}</h3>
              <button onClick={() => setSelectedDoc(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* File Preview */}
              {isImage(selectedDoc.file_type, selectedDoc.file_name) && (
                <div className="bg-muted/10 border-b border-border flex items-center justify-center p-4 max-h-72 overflow-hidden">
                  <img
                    src={selectedDoc.file_url}
                    alt={selectedDoc.file_name}
                    className="max-w-full max-h-64 object-contain rounded-xl shadow-sm"
                  />
                </div>
              )}
              {isPDF(selectedDoc.file_type, selectedDoc.file_name) && (
                <div className="border-b border-border" style={{ height: '320px' }}>
                  <iframe
                    src={`${selectedDoc.file_url}#toolbar=0&navpanes=0`}
                    title={selectedDoc.file_name}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                  />
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {getFileIcon(selectedDoc.file_type, selectedDoc.file_name)}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedDoc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{fmtSize(selectedDoc.file_size)} · Uploaded {fmtDate(selectedDoc.created_at)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/20 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                    <p className="font-semibold text-foreground">{selectedDoc.category || '—'}</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Uploaded By</p>
                    <p className="font-semibold text-foreground capitalize">{selectedDoc.uploaded_by}</p>
                  </div>
                  {selectedDoc.contact_inquiries && (
                    <div className="bg-muted/20 rounded-xl p-3 col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Associated Client</p>
                      <p className="font-semibold text-foreground">{selectedDoc.contact_inquiries.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDoc.contact_inquiries.email} · {selectedDoc.contact_inquiries.service}</p>
                    </div>
                  )}
                  {selectedDoc.description && (
                    <div className="bg-muted/20 rounded-xl p-3 col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                      <p className="text-sm text-foreground">{selectedDoc.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex gap-3 flex-shrink-0">
              <a
                href={selectedDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
              <button
                onClick={() => { setEditDoc(selectedDoc); setEditCategory(selectedDoc.category || 'Other'); setEditDescription(selectedDoc.description || ''); setSelectedDoc(null); }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-foreground bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors"
              >
                Edit Details
              </button>
              <button
                onClick={() => handleDelete(selectedDoc)}
                className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Edit Document Details</h3>
              <button onClick={() => setEditDoc(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditDoc(null)} className="flex-1 px-4 py-2 text-sm font-semibold text-muted-foreground bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
