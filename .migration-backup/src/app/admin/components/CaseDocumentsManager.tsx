'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pinnedFilesStore } from '@/lib/localPersistence';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role?: string | null;
  category: string | null;
  description: string | null;
  storage_path: string | null;
  created_at: string;
  // versioning
  version?: number | null;
  parent_document_id?: string | null;
  document_type?: string | null;
  version_notes?: string | null;
  requires_client_review?: boolean;
}

interface DownloadHistoryEntry {
  id: string;
  document_id: string;
  file_name: string;
  downloaded_by: string;
  downloaded_by_role: string;
  downloaded_at: string;
}

interface CaseDocumentsManagerProps {
  caseId: string;
  documents: CaseDocument[];
  onDocumentsChange: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'text/plain': 'TXT',
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.txt'];

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract', icon: '📄', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'discovery', label: 'Discovery', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'correspondence', label: 'Correspondence', icon: '✉️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'work_product', label: 'Work Product', icon: '📝', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'evidence', label: 'Evidence', icon: '🗂️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'other', label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const CATEGORIES = [
  { value: 'work_product', label: 'Work Product' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'case_files', label: 'Case Files' },
  { value: 'court_filings', label: 'Court Filings' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
];

const UPLOADER_ROLES = [
  { value: 'admin', label: 'Admin / Attorney' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'client', label: 'Client' },
];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-slate-100 text-slate-600 border-slate-200',
  paralegal: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  client: 'bg-teal-50 text-teal-700 border-teal-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function getDocType(doc: CaseDocument) {
  return DOCUMENT_TYPES.find((t) => t.value === (doc.document_type ?? 'other')) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function getFileIcon(fileType: string | null): React.ReactNode {
  const type = fileType?.toLowerCase() ?? '';
  if (type.includes('pdf')) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
  if (type.includes('image')) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  if (type.includes('word') || type.includes('doc')) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// Group documents into version chains: root doc → [v1, v2, v3...]
function buildVersionChains(documents: CaseDocument[]): Map<string, CaseDocument[]> {
  const chains = new Map<string, CaseDocument[]>();
  // Root docs (no parent)
  const roots = documents.filter((d) => !d.parent_document_id);
  for (const root of roots) {
    const chain: CaseDocument[] = [root];
    // Find all versions that trace back to this root
    const findChildren = (parentId: string) => {
      const children = documents
        .filter((d) => d.parent_document_id === parentId)
        .sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
      for (const child of children) {
        chain.push(child);
        findChildren(child.id);
      }
    };
    findChildren(root.id);
    chains.set(root.id, chain);
  }
  // Orphaned docs (parent deleted)
  const orphans = documents.filter(
    (d) => d.parent_document_id && !documents.find((r) => r.id === d.parent_document_id)
  );
  for (const orphan of orphans) {
    if (!chains.has(orphan.id)) chains.set(orphan.id, [orphan]);
  }
  return chains;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseDocumentsManager({ caseId, documents, onDocumentsChange }: CaseDocumentsManagerProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Upload form state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadDocType, setUploadDocType] = useState('other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadRole, setUploadRole] = useState('paralegal');
  const [uploadVersionNotes, setUploadVersionNotes] = useState('');
  const [uploadRequiresReview, setUploadRequiresReview] = useState(false);
  // Version-upload: if set, these files are a new version of this doc
  const [versionTargetId, setVersionTargetId] = useState<string | null>(null);
  const [versionTargetName, setVersionTargetName] = useState<string | null>(null);

  // Filter/sort/view state
  const [filterDocType, setFilterDocType] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Expanded version chains
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  // Edit state
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDocType, setEditDocType] = useState('other');
  const [editDescription, setEditDescription] = useState('');
  const [editRequiresReview, setEditRequiresReview] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Rename state
  const [renamingDoc, setRenamingDoc] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Pin state (localStorage)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const pinned = pinnedFilesStore.get();
    setPinnedIds(new Set(pinned.map(f => f.id)));
  }, []);

  // Download history state
  const [showHistory, setShowHistory] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);

  // ── File Validation ──────────────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES[file.type]) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `"${file.name}" is not an allowed file type. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT`;
      }
    }
    if (file.size > 10 * 1024 * 1024) {
      return `"${file.name}" exceeds the 10MB file size limit (${formatFileSize(file.size)})`;
    }
    return null;
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const fileArray = Array.from(files);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const file of fileArray) {
      const err = validateFile(file);
      if (err) errors.push(err);
      else valid.push(file);
    }
    if (errors.length > 0) setUploadError(errors.join('\n'));
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  }, []); // eslint-disable-line

  // ── Start Version Upload ─────────────────────────────────────────────────────

  const startVersionUpload = (doc: CaseDocument) => {
    setVersionTargetId(doc.id);
    setVersionTargetName(doc.file_name);
    setUploadDocType(doc.document_type ?? 'other');
    setUploadCategory(doc.category ?? 'other');
    setUploadRole(doc.uploaded_by_role ?? 'paralegal');
    setPendingFiles([]);
    setUploadVersionNotes('');
    fileInputRef.current?.click();
  };

  const cancelVersionUpload = () => {
    setVersionTargetId(null);
    setVersionTargetName(null);
    setPendingFiles([]);
    setUploadVersionNotes('');
  };

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of pendingFiles) {
      setUploadProgress(`Uploading ${file.name}…`);
      try {
        const ext = file.name.split('.').pop();
        const storagePath = `paralegal/${caseId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const { error: storageErr } = await supabase.storage
          .from('case-documents')
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (storageErr) throw storageErr;

        const { data: urlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(storagePath);

        // Determine version number
        let newVersion = 1;
        if (versionTargetId) {
          // Find the highest version in the chain
          const chain = documents.filter(
            (d) => d.id === versionTargetId || d.parent_document_id === versionTargetId
          );
          const maxVersion = chain.reduce((max, d) => Math.max(max, d.version ?? 1), 1);
          newVersion = maxVersion + 1;
        }

        const { error: dbErr } = await supabase.from('case_documents').insert({
          inquiry_id: caseId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          storage_path: storagePath,
          file_type: ALLOWED_MIME_TYPES[file.type] ?? ext?.toUpperCase() ?? 'FILE',
          file_size: file.size,
          uploaded_by: uploadRole === 'client' ? 'Client' : uploadRole === 'paralegal' ? 'Paralegal' : 'Admin',
          uploaded_by_role: uploadRole,
          category: uploadCategory,
          description: uploadDescription.trim() || null,
          document_type: uploadDocType,
          requires_client_review: uploadRequiresReview,
          version: newVersion,
          parent_document_id: versionTargetId ?? null,
          version_notes: uploadVersionNotes.trim() || null,
        });

        if (dbErr) throw dbErr;
        successCount++;
      } catch (err: unknown) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (errors.length > 0) setUploadError(errors.join('\n'));
    if (successCount > 0) {
      setUploadSuccess(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully.`);
      setPendingFiles([]);
      setUploadDescription('');
      setUploadVersionNotes('');
      setUploadRequiresReview(false);
      setVersionTargetId(null);
      setVersionTargetName(null);
      onDocumentsChange();
      setTimeout(() => setUploadSuccess(null), 3000);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const startEdit = (doc: CaseDocument) => {
    setEditingDoc(doc.id);
    setEditCategory(doc.category ?? 'other');
    setEditDocType(doc.document_type ?? 'other');
    setEditDescription(doc.description ?? '');
    setEditRequiresReview(doc.requires_client_review ?? false);
  };

  const handleSaveEdit = async (docId: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('case_documents').update({
        category: editCategory,
        document_type: editDocType,
        description: editDescription.trim() || null,
        requires_client_review: editRequiresReview,
      }).eq('id', docId);
      if (error) throw error;
      setEditingDoc(null);
      onDocumentsChange();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (doc: CaseDocument) => {
    setDeletingDoc(doc.id);
    try {
      if (doc.storage_path) {
        await supabase.storage.from('case-documents').remove([doc.storage_path]);
      }
      const { error } = await supabase.from('case_documents').delete().eq('id', doc.id);
      if (error) throw error;
      setConfirmDelete(null);
      onDocumentsChange();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setDeletingDoc(null);
    }
  };

  // ── Rename ───────────────────────────────────────────────────────────────────

  const handleRename = async (doc: CaseDocument, newName: string) => {
    if (!newName.trim() || newName === doc.file_name) {
      setRenamingDoc(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('case_documents')
        .update({ file_name: newName.trim() })
        .eq('id', doc.id);
      if (error) throw error;
      setRenamingDoc(null);
      onDocumentsChange();
      toast.success('File renamed');
    } catch {
      toast.error('Rename failed');
    }
  };

  // ── Pin ───────────────────────────────────────────────────────────────────────

  const handleTogglePin = (doc: CaseDocument) => {
    if (pinnedIds.has(doc.id)) {
      pinnedFilesStore.remove(doc.id);
      setPinnedIds(prev => { const s = new Set(prev); s.delete(doc.id); return s; });
      toast.success('File unpinned');
    } else {
      pinnedFilesStore.add({
        id: doc.id,
        name: doc.file_name,
        type: doc.file_type ?? 'FILE',
        pinnedAt: new Date().toISOString(),
        caseRef: caseId,
      });
      setPinnedIds(prev => new Set([...prev, doc.id]));
      toast.success('File pinned');
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = async (doc: CaseDocument) => {
    try {
      await supabase.from('document_download_history').insert({
        document_id: doc.id,
        inquiry_id: caseId,
        downloaded_by: 'Admin',
        downloaded_by_role: 'admin',
        file_name: doc.file_name,
      });
    } catch { /* non-blocking */ }

    if (doc.storage_path) {
      try {
        const { data, error } = await supabase.storage
          .from('case-documents')
          .createSignedUrl(doc.storage_path, 60);
        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch { /* fall through */ }
    }
    window.open(doc.file_url, '_blank');
  };

  // ── Download History ─────────────────────────────────────────────────────────

  const loadDownloadHistory = async (docId?: string) => {
    setLoadingHistory(true);
    setHistoryDocId(docId ?? null);
    try {
      let query = supabase
        .from('document_download_history')
        .select('*')
        .eq('inquiry_id', caseId)
        .order('downloaded_at', { ascending: false })
        .limit(50);
      if (docId) query = query.eq('document_id', docId);
      const { data, error } = await query;
      if (error) throw error;
      setDownloadHistory(data ?? []);
      setShowHistory(true);
    } catch {
      setDownloadHistory([]);
      setShowHistory(true);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Filtering & Grouping ─────────────────────────────────────────────────────

  const filteredDocs = documents.filter((doc) => {
    if (filterDocType !== 'all' && (doc.document_type ?? 'other') !== filterDocType) return false;
    if (filterRole !== 'all' && (doc.uploaded_by_role ?? 'admin') !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        doc.file_name.toLowerCase().includes(q) ||
        (doc.description ?? '').toLowerCase().includes(q) ||
        (doc.document_type ?? '').toLowerCase().includes(q) ||
        (doc.version_notes ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (sortBy === 'name') return a.file_name.localeCompare(b.file_name);
    if (sortBy === 'type') return (a.document_type ?? 'other').localeCompare(b.document_type ?? 'other');
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Grouped by document type
  const groupedByType = DOCUMENT_TYPES.reduce<Record<string, CaseDocument[]>>((acc, dt) => {
    acc[dt.value] = sortedDocs.filter((d) => (d.document_type ?? 'other') === dt.value);
    return acc;
  }, {});

  // Version chains for list view
  const versionChains = buildVersionChains(sortedDocs);

  const docTypeCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    const t = doc.document_type ?? 'other';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  // ── Render Helpers ───────────────────────────────────────────────────────────

  const renderDocRow = (doc: CaseDocument, isVersion = false, isLatest = false) => {
    const docType = getDocType(doc);
    const roleLabel = UPLOADER_ROLES.find((r) => r.value === (doc.uploaded_by_role ?? 'admin'))?.label ?? 'Admin';
    const roleBadge = ROLE_BADGE[doc.uploaded_by_role ?? 'admin'] ?? ROLE_BADGE.admin;

    if (editingDoc === doc.id) {
      return (
        <div key={doc.id} className={`px-5 py-4 ${isVersion ? 'bg-secondary/10 border-l-2 border-border ml-8' : ''}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                {getFileIcon(doc.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                <p className="text-[11px] text-muted-foreground">{formatFileSize(doc.file_size)} · v{doc.version ?? 1}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Document Type</label>
                <select value={editDocType} onChange={(e) => setEditDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                  {DOCUMENT_TYPES.map((dt) => <option key={dt.value} value={dt.value}>{dt.icon} {dt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Category</label>
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                  {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Description</label>
              <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description…"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setEditRequiresReview((v) => !v)}>
                <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${editRequiresReview ? 'bg-amber-500' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editRequiresReview ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-xs font-semibold text-foreground">⚠️ Pending Client Review</span>
                <span className="text-xs text-muted-foreground">(flags this document in the digest email)</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSaveEdit(doc.id)} disabled={savingEdit}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-60 transition-all"
                style={{ background: '#355E3B' }}>
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingDoc(null)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (confirmDelete === doc.id) {
      return (
        <div key={doc.id} className={`flex items-center gap-4 flex-wrap px-5 py-4 ${isVersion ? 'bg-secondary/10 border-l-2 border-border ml-8' : ''}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Delete &ldquo;{doc.file_name}&rdquo;?</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => handleDelete(doc)} disabled={deletingDoc === doc.id}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
              {deletingDoc === doc.id ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={doc.id} className={`flex items-start gap-3 px-5 py-4 hover:bg-secondary/20 transition-colors ${isVersion ? 'bg-secondary/5 border-l-2 border-border/50 ml-8' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 mt-0.5">
          {getFileIcon(doc.file_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            {renamingDoc === doc.id ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(doc, renameValue); if (e.key === 'Escape') setRenamingDoc(null); }}
                  autoFocus
                  className="flex-1 px-2 py-1 bg-background border border-primary/50 rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={() => handleRename(doc, renameValue)} className="px-2 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold">Save</button>
                <button onClick={() => setRenamingDoc(null)} className="px-2 py-1 border border-border rounded-lg text-[10px] text-muted-foreground">✕</button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-foreground truncate max-w-xs">{doc.file_name}</p>
            )}
            {/* Version badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${isLatest && (doc.version ?? 1) > 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-secondary/60 text-muted-foreground border-border'}`}>
              v{doc.version ?? 1}{isLatest && (doc.version ?? 1) > 1 ? ' · Latest' : ''}
            </span>
            {/* Doc type badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${docType.color}`}>
              {docType.icon} {docType.label}
            </span>
            {/* Pending review badge */}
            {doc.requires_client_review && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                ⚠️ Pending Client Review
              </span>
            )}
            {/* Role badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleBadge}`}>
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            {doc.file_type && <span>{doc.file_type}</span>}
            {doc.file_size && <span>· {formatFileSize(doc.file_size)}</span>}
            <span>· {formatDate(doc.created_at)}</span>
          </div>
          {doc.description && <p className="text-xs text-muted-foreground mt-1 italic">{doc.description}</p>}
          {doc.version_notes && (
            <p className="text-xs text-blue-600 mt-1">
              <span className="font-semibold">Version note:</span> {doc.version_notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Upload new version */}
          {!isVersion && (
            <button onClick={() => startVersionUpload(doc)} title="Upload new version"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              New Version
            </button>
          )}
          {/* History */}
          <button onClick={() => loadDownloadHistory(doc.id)} title="View download history"
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          {/* Edit */}
          <button onClick={() => startEdit(doc)} title="Edit"
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {/* Rename */}
          <button onClick={() => { setRenamingDoc(doc.id); setRenameValue(doc.file_name); }} title="Rename file"
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          {/* Pin */}
          <button onClick={() => handleTogglePin(doc)} title={pinnedIds.has(doc.id) ? 'Unpin file' : 'Pin file'}
            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${pinnedIds.has(doc.id) ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-border text-muted-foreground hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={pinnedIds.has(doc.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
          {/* Delete */}
          <button onClick={() => setConfirmDelete(doc.id)} title="Delete"
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
          {/* Download */}
          <button onClick={() => handleDownload(doc)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Upload Zone ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {versionTargetId ? `Upload New Version of "${versionTargetName}"` : 'Upload Documents'}
            </h3>
            {versionTargetId && (
              <p className="text-[11px] text-blue-600 mt-0.5">Uploading as a new version — will be linked to the original document</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {versionTargetId && (
              <button onClick={cancelVersionUpload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancel Version Upload
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">Max 10MB · PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT</span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragging ? 'border-foreground bg-secondary/60 scale-[1.01]' : 'border-border hover:border-foreground/40 hover:bg-secondary/30'
            }`}
          >
            <input ref={fileInputRef} type="file" multiple accept={ALLOWED_EXTENSIONS.join(',')} className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)} />
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">
                {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT</p>
            </div>
          </div>

          {/* Pending Files */}
          {pendingFiles.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Ready to upload ({pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''})
              </p>
              <div className="space-y-1.5">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-secondary/40 border border-border">
                    <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)} · {ALLOWED_MIME_TYPES[file.type] ?? file.type}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setPendingFiles((prev) => prev.filter((_, i) => i !== idx)); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Document Type</label>
                  <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                    {DOCUMENT_TYPES.map((dt) => <option key={dt.value} value={dt.value}>{dt.icon} {dt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Uploaded By</label>
                  <select value={uploadRole} onChange={(e) => setUploadRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                    {UPLOADER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Category</label>
                  <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                    {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Description (optional)</label>
                  <input type="text" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Brief description…"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setUploadRequiresReview((v) => !v)}>
                    <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${uploadRequiresReview ? 'bg-amber-500' : 'bg-border'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${uploadRequiresReview ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs font-semibold text-foreground">⚠️ Requires Client Review</span>
                    <span className="text-xs text-muted-foreground">(client will see a "Pending Your Review" flag in their digest email)</span>
                  </label>
                </div>
                {versionTargetId && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Version Notes</label>
                    <input type="text" value={uploadVersionNotes} onChange={(e) => setUploadVersionNotes(e.target.value)}
                      placeholder="What changed in this version? (e.g. Updated indemnification clause)"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                  </div>
                )}
              </div>

              <button onClick={handleUpload} disabled={uploading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: '#355E3B' }}>
                {uploading ? (uploadProgress ?? 'Uploading…') : `Upload ${pendingFiles.length} File${pendingFiles.length > 1 ? 's' : ''}${versionTargetId ? ' as New Version' : ''}`}
              </button>
            </div>
          )}

          {uploadError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-700 whitespace-pre-line">{uploadError}</p>
            </div>
          )}
          {uploadSuccess && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs text-emerald-700">{uploadSuccess}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Documents List ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header + Filters */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Documents ({filteredDocs.length}{filteredDocs.length !== documents.length ? ` of ${documents.length}` : ''})
            </h3>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-full border border-border overflow-hidden">
                <button onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${viewMode === 'grouped' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                  By Type
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                  Versions
                </button>
              </div>
              <button onClick={() => loadDownloadHistory()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                History
              </button>
            </div>
          </div>

          {/* Document Type Filter Chips */}
          {documents.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFilterDocType('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${filterDocType === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-background border-border text-muted-foreground hover:border-foreground/30'}`}>
                All ({documents.length})
              </button>
              {DOCUMENT_TYPES.filter((dt) => docTypeCounts[dt.value]).map((dt) => (
                <button key={dt.value} onClick={() => setFilterDocType(filterDocType === dt.value ? 'all' : dt.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${filterDocType === dt.value ? 'bg-foreground text-background border-foreground' : `${dt.color} hover:opacity-80`}`}>
                  {dt.icon} {dt.label} ({docTypeCounts[dt.value]})
                </button>
              ))}
            </div>
          )}

          {/* Role Filter + Search + Sort */}
          {documents.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                <option value="all">All Uploaders</option>
                {UPLOADER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div className="relative flex-1 min-w-[160px]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'type')}
                className="px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20">
                <option value="date">Newest First</option>
                <option value="name">Name A–Z</option>
                <option value="type">By Type</option>
              </select>
            </div>
          )}
        </div>

        {/* Document Rows */}
        {filteredDocs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match your filters.'}
            </p>
          </div>
        ) : viewMode === 'grouped' ? (
          /* ── Grouped by Document Type ── */
          <div>
            {DOCUMENT_TYPES.filter((dt) => groupedByType[dt.value]?.length > 0).map((dt) => (
              <div key={dt.value} className="border-b border-border last:border-b-0">
                {/* Type section header */}
                <div className={`px-5 py-3 flex items-center gap-2 ${dt.color.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-secondary/20'}`}>
                  <span className="text-base">{dt.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-widest ${dt.color.split(' ').find((c) => c.startsWith('text-')) ?? 'text-foreground'}`}>
                    {dt.label}
                  </span>
                  <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${dt.color}`}>
                    {groupedByType[dt.value].length} doc{groupedByType[dt.value].length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {groupedByType[dt.value].map((doc) => renderDocRow(doc, false, false))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Version Chain View ── */
          <div className="divide-y divide-border">
            {Array.from(versionChains.entries()).map(([rootId, chain]) => {
              const root = chain[0];
              const versions = chain.slice(1);
              const isExpanded = expandedChains.has(rootId);
              const latestVersion = chain[chain.length - 1];

              return (
                <div key={rootId}>
                  {/* Root / latest doc row */}
                  <div className="relative">
                    {versions.length > 0 && (
                      <button
                        onClick={() => setExpandedChains((prev) => {
                          const next = new Set(prev);
                          if (next.has(rootId)) next.delete(rootId);
                          else next.add(rootId);
                          return next;
                        })}
                        className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title={isExpanded ? 'Collapse versions' : `Show ${versions.length} version${versions.length > 1 ? 's' : ''}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    )}
                    <div className={versions.length > 0 ? 'pl-6' : ''}>
                      {renderDocRow(latestVersion, false, (latestVersion.version ?? 1) > 1)}
                    </div>
                  </div>
                  {/* Version history */}
                  {isExpanded && versions.length > 0 && (
                    <div className="bg-secondary/5">
                      <div className="px-5 py-2 border-b border-border/50">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          Version History ({versions.length} older version{versions.length > 1 ? 's' : ''})
                        </p>
                      </div>
                      <div className="divide-y divide-border/50">
                        {/* Show older versions in reverse order (newest first) */}
                        {[...chain].slice(0, -1).reverse().map((v) => renderDocRow(v, true, false))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Download History Panel ───────────────────────────────────────────── */}
      {showHistory && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Download History</h3>
              {historyDocId && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Filtered to: {documents.find((d) => d.id === historyDocId)?.file_name ?? 'selected document'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {historyDocId && (
                <button onClick={() => loadDownloadHistory()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Show all →
                </button>
              )}
              <button onClick={() => setShowHistory(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          {loadingHistory ? (
            <div className="px-5 py-8 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-border border-t-foreground animate-spin mx-auto" />
            </div>
          ) : downloadHistory.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No downloads recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {downloadHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Downloaded by <span className="font-semibold">{entry.downloaded_by}</span>
                      <span className="mx-1.5">·</span>
                      <span className="capitalize">{entry.downloaded_by_role}</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(entry.downloaded_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
