'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Case {
  id: string;
  name: string;
  service: string;
  booking_stage: string;
  created_at: string;
}

interface CaseDocument {
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
  storage_path: string | null;
  client_visible: boolean;
  version: number;
  created_at: string;
}

interface AuditEntry {
  id: string;
  inquiry_id: string | null;
  document_id: string | null;
  action_type: string;
  actor_name: string;
  actor_role: string;
  file_name: string | null;
  document_type: string | null;
  notes: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'discovery', label: 'Discovery', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'filing', label: 'Pleading / Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'correspondence', label: 'Correspondence', icon: '✉️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'evidence', label: 'Evidence', icon: '🗂️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'contract', label: 'Contract', icon: '📄', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'work_product', label: 'Work Product', icon: '📝', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'other', label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'text/plain': 'TXT',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDocTypeConfig(type: string | null) {
  return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    upload: '⬆️', view: '👁️', download: '⬇️', share: '🔗',
    revoke_share: '🚫', delete: '🗑️', update_visibility: '🔒',
  };
  return icons[action] || '📋';
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CaseFileRepository() {
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [activeView, setActiveView] = useState<'documents' | 'audit'>('documents');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    documentType: 'other',
    category: 'other',
    description: '',
    clientVisible: true,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visibility toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('contact_inquiries')
        .select('id, name, service, booking_stage, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      setCases(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async (caseId: string) => {
    setDocsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('case_documents')
        .select('*')
        .eq('inquiry_id', caseId)
        .order('created_at', { ascending: false });
      setDocuments(data || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async (caseId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('file_repository_audit')
        .select('*')
        .eq('inquiry_id', caseId)
        .order('created_at', { ascending: false })
        .limit(100);
      setAuditLog(data || []);
    } catch {
      setAuditLog([]);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  useEffect(() => {
    if (selectedCase) {
      fetchDocuments(selectedCase.id);
      fetchAuditLog(selectedCase.id);
    }
  }, [selectedCase, fetchDocuments, fetchAuditLog]);

  // ── Upload Logic ─────────────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (!ALLOWED_MIME_TYPES[file.type]) {
      setUploadError('File type not allowed. Please upload PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, or TXT.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File exceeds 10 MB limit.');
      return;
    }
    setUploadError(null);
    setUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedCase) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const ext = uploadFile.name.split('.').pop();
      const storagePath = `${selectedCase.id}/${Date.now()}_${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: storageError } = await supabase.storage
        .from('case-documents')
        .upload(storagePath, uploadFile, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(storagePath);

      const { data: docData, error: dbError } = await supabase
        .from('case_documents')
        .insert({
          inquiry_id: selectedCase.id,
          file_name: uploadFile.name,
          file_url: urlData.publicUrl,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
          uploaded_by: 'Maggi May Broussard',
          uploaded_by_role: 'admin',
          category: uploadForm.category,
          document_type: uploadForm.documentType,
          description: uploadForm.description || null,
          storage_path: storagePath,
          client_visible: uploadForm.clientVisible,
          version: 1,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Log audit event
      await supabase.from('file_repository_audit').insert({
        inquiry_id: selectedCase.id,
        document_id: docData?.id || null,
        action_type: 'upload',
        actor_name: 'Maggi May Broussard',
        actor_role: 'admin',
        file_name: uploadFile.name,
        document_type: uploadForm.documentType,
        notes: uploadForm.clientVisible ? 'Shared with client' : 'Not shared with client',
      });

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ documentType: 'other', category: 'other', description: '', clientVisible: true });
      await fetchDocuments(selectedCase.id);
      await fetchAuditLog(selectedCase.id);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Visibility Toggle ────────────────────────────────────────────────────────

  const toggleClientVisible = async (doc: CaseDocument) => {
    if (!selectedCase) return;
    setTogglingId(doc.id);
    try {
      const supabase = createClient();
      const newVisible = !doc.client_visible;
      await supabase
        .from('case_documents')
        .update({ client_visible: newVisible })
        .eq('id', doc.id);

      await supabase.from('file_repository_audit').insert({
        inquiry_id: selectedCase.id,
        document_id: doc.id,
        action_type: 'update_visibility',
        actor_name: 'Maggi May Broussard',
        actor_role: 'admin',
        file_name: doc.file_name,
        document_type: doc.document_type,
        notes: newVisible ? 'Made visible to client' : 'Hidden from client',
      });

      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, client_visible: newVisible } : d));
      await fetchAuditLog(selectedCase.id);
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  // ── Download with Audit ──────────────────────────────────────────────────────

  const handleAdminDownload = async (doc: CaseDocument) => {
    if (!selectedCase) return;
    try {
      const supabase = createClient();
      // Log download in document_download_history
      await supabase.from('document_download_history').insert({
        document_id: doc.id,
        inquiry_id: selectedCase.id,
        downloaded_by: 'Maggi May Broussard',
        downloaded_by_role: 'admin',
        file_name: doc.file_name,
      });
      // Log in audit
      await supabase.from('file_repository_audit').insert({
        inquiry_id: selectedCase.id,
        document_id: doc.id,
        action_type: 'download',
        actor_name: 'Maggi May Broussard',
        actor_role: 'admin',
        file_name: doc.file_name,
        document_type: doc.document_type,
      });
      window.open(doc.file_url, '_blank');
      await fetchAuditLog(selectedCase.id);
    } catch {
      window.open(doc.file_url, '_blank');
    }
  };

  // ── Filtered Documents ───────────────────────────────────────────────────────

  const filteredDocs = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesSearch = !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalDocs = documents.length;
  const sharedDocs = documents.filter(d => d.client_visible).length;
  const hiddenDocs = documents.filter(d => !d.client_visible).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden bg-background">
      {/* ── Case Sidebar ── */}
      <div className="w-72 shrink-0 border-r border-border/60 flex flex-col bg-muted/20">
        <div className="p-4 border-b border-border/60">
          <h2 className="text-sm font-semibold text-foreground mb-1">Case File Repository</h2>
          <p className="text-xs text-muted-foreground">Select a case to manage documents</p>
        </div>
        <div className="p-3 border-b border-border/60">
          <input
            type="text"
            placeholder="Search cases..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
            onChange={e => {
              // filter cases inline
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {cases.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No cases found</div>
          ) : (
            cases.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCase(c); setActiveView('documents'); setFilterType('all'); setSearchQuery(''); }}
                className={`w-full text-left px-4 py-3 border-b border-border/40 transition-colors hover:bg-muted/40 ${selectedCase?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.service || 'No service'}</p>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  c.booking_stage === 'active_client' || c.booking_stage === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  c.booking_stage === 'billed'? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {c.booking_stage?.replace(/_/g, ' ') || 'pending'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedCase ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Select a Case</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Choose a case from the sidebar to view and manage its file repository — upload discovery docs, pleadings, correspondence, and evidence.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/60 bg-background flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{selectedCase.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedCase.service} · {fmtDate(selectedCase.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* KPI strip */}
                <div className="hidden md:flex items-center gap-3 mr-2">
                  <div className="text-center">
                    <p className="text-base font-bold text-foreground leading-none">{totalDocs}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div className="w-px h-6 bg-border/60" />
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-600 leading-none">{sharedDocs}</p>
                    <p className="text-[10px] text-muted-foreground">Shared</p>
                  </div>
                  <div className="w-px h-6 bg-border/60" />
                  <div className="text-center">
                    <p className="text-base font-bold text-amber-600 leading-none">{hiddenDocs}</p>
                    <p className="text-[10px] text-muted-foreground">Hidden</p>
                  </div>
                  <div className="w-px h-6 bg-border/60" />
                </div>
                <button
                  onClick={() => { setShowUploadModal(true); setUploadError(null); setUploadFile(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Upload Document
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-border/60 bg-background">
              {(['documents', 'audit'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveView(tab)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors capitalize ${activeView === tab ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'documents' ? `Documents (${totalDocs})` : 'Audit Trail'}
                </button>
              ))}
            </div>

            {/* Documents View */}
            {activeView === 'documents' && (
              <div className="flex-1 overflow-y-auto p-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 w-48"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                    >
                      All
                    </button>
                    {DOCUMENT_TYPES.map(dt => (
                      <button
                        key={dt.value}
                        onClick={() => setFilterType(dt.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filterType === dt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                      >
                        {dt.icon} {dt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {docsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No documents found</p>
                    <p className="text-xs text-muted-foreground">Upload documents using the button above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDocs.map(doc => {
                      const typeConfig = getDocTypeConfig(doc.document_type);
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/20 transition-colors group">
                          {/* Type badge */}
                          <div className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-semibold ${typeConfig.color}`}>
                            {typeConfig.icon} {typeConfig.label}
                          </div>

                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{doc.file_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{fmtBytes(doc.file_size)}</span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground">{fmtDate(doc.created_at)}</span>
                              {doc.description && (
                                <>
                                  <span className="text-[10px] text-muted-foreground">·</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{doc.description}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Client visibility toggle */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-medium ${doc.client_visible ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {doc.client_visible ? 'Shared' : 'Hidden'}
                            </span>
                            <button
                              onClick={() => toggleClientVisible(doc)}
                              disabled={togglingId === doc.id}
                              className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${doc.client_visible ? 'bg-emerald-500' : 'bg-gray-300'} ${togglingId === doc.id ? 'opacity-50' : ''}`}
                              title={doc.client_visible ? 'Click to hide from client' : 'Click to share with client'}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${doc.client_visible ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          {/* Download */}
                          <button
                            onClick={() => handleAdminDownload(doc)}
                            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                            title="Download"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail View */}
            {activeView === 'audit' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-foreground">Access Audit Trail</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Complete log of all file access events for this case</p>
                </div>
                {auditLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No audit events yet</p>
                    <p className="text-xs text-muted-foreground">Events will appear here as documents are uploaded, viewed, and downloaded.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card">
                        <span className="text-base shrink-0 mt-0.5">{getActionIcon(entry.action_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-foreground capitalize">{entry.action_type.replace(/_/g, ' ')}</span>
                            {entry.file_name && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {entry.file_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${entry.actor_role === 'admin' ? 'bg-purple-100 text-purple-700' : entry.actor_role === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                              {entry.actor_role}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{entry.actor_name}</span>
                            {entry.notes && (
                              <>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">{entry.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{fmtDateTime(entry.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Upload Modal ── */}
      {showUploadModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg border border-border/60">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Upload Document</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedCase.name}</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={Object.keys(ALLOWED_MIME_TYPES).join(',')}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                {uploadFile ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtBytes(uploadFile.size)}</p>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-muted-foreground">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-xs font-medium text-foreground">Drop file here or click to browse</p>
                    <p className="text-[10px] text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT · Max 10 MB</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
              )}

              {/* Document type */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setUploadForm(f => ({ ...f, documentType: dt.value }))}
                      className={`px-2 py-2 rounded-lg border text-[10px] font-medium text-center transition-colors ${uploadForm.documentType === dt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
                    >
                      <div className="text-base mb-0.5">{dt.icon}</div>
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  value={uploadForm.description}
                  onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this document..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* Client visibility */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                <div>
                  <p className="text-xs font-medium text-foreground">Share with client</p>
                  <p className="text-[10px] text-muted-foreground">Client can view and download this document in their portal</p>
                </div>
                <button
                  onClick={() => setUploadForm(f => ({ ...f, clientVisible: !f.clientVisible }))}
                  className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${uploadForm.clientVisible ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${uploadForm.clientVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
