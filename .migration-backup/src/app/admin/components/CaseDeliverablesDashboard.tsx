'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deliverable {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role: string;
  category: string | null;
  description: string | null;
  storage_path: string | null;
  version: number;
  document_type: string | null;
  deliverable_status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  deliverable_type: 'intake_document' | 'legal_research' | 'draft' | 'filing' | 'correspondence' | 'general';
  due_date: string | null;
  client_visible: boolean;
  status_notes: string | null;
  created_at: string;
  contact_inquiries?: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

interface CaseOption {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
}

interface UploadState {
  file: File | null;
  inquiryId: string;
  deliverableType: string;
  category: string;
  description: string;
  dueDate: string;
  deliverableStatus: string;
  clientVisible: boolean;
  statusNotes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:    { label: 'Pending',    color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  in_progress:{ label: 'In Progress',color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-400' },
  completed:  { label: 'Completed',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  approved:   { label: 'Approved',   color: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  rejected:   { label: 'Rejected',   color: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400' },
};

const DELIVERABLE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  intake_document: { label: 'Intake Document', icon: '📋' },
  legal_research:  { label: 'Legal Research',  icon: '🔍' },
  draft:           { label: 'Draft',           icon: '✏️' },
  filing:          { label: 'Filing',          icon: '🏛️' },
  correspondence:  { label: 'Correspondence',  icon: '✉️' },
  general:         { label: 'General',         icon: '📄' },
};

const CATEGORY_OPTIONS = [
  { value: 'intake',       label: 'Intake Documents' },
  { value: 'work_product', label: 'Work Product' },
  { value: 'court_filings',label: 'Court Filings' },
  { value: 'discovery',    label: 'Discovery' },
  { value: 'contracts',    label: 'Contracts' },
  { value: 'correspondence',label: 'Correspondence' },
  { value: 'case_files',   label: 'Case Files' },
  { value: 'other',        label: 'Other' },
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

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDueSoon(due: string | null) {
  if (!due) return false;
  const diff = new Date(due).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'completed' || status === 'approved') return false;
  return new Date(due).getTime() < Date.now();
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CaseDeliverablesDashboard() {
  const supabase = createClient();

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCase, setFilterCase] = useState('all');
  const [search, setSearch] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    inquiryId: '',
    deliverableType: 'general',
    category: 'other',
    description: '',
    dueDate: '',
    deliverableStatus: 'pending',
    clientVisible: true,
    statusNotes: '',
  });

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatusNotes, setEditStatusNotes] = useState('');
  const [editClientVisible, setEditClientVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsResult, caseResult] = await Promise.all([
        supabase
          .from('case_documents')
          .select('*, contact_inquiries(name, email, firm, service)')
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_inquiries')
          .select('id, name, firm, email, service')
          .order('name'),
      ]);

      const docs = docsResult.data;
      const docsErr = docsResult.error;
      const caseData = caseResult.data;

      if (docsErr) throw docsErr;
      setDeliverables((docs ?? []) as Deliverable[]);
      setCases(caseData ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deliverables');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadState.file || !uploadState.inquiryId) {
      setUploadError('Please select a file and a case.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const ext = uploadState.file.name.split('.').pop() ?? 'bin';
      const path = `${uploadState.inquiryId}/${Date.now()}_${uploadState.file.name.replace(/\s+/g, '_')}`;

      const { error: storageErr } = await supabase.storage
        .from('case-documents')
        .upload(path, uploadState.file, { upsert: false });

      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from('case_documents').insert({
        inquiry_id: uploadState.inquiryId,
        file_name: uploadState.file.name,
        file_url: path,
        file_type: ext.toUpperCase(),
        file_size: uploadState.file.size,
        uploaded_by: 'Admin',
        uploaded_by_role: 'admin',
        category: uploadState.category,
        description: uploadState.description || null,
        storage_path: path,
        deliverable_type: uploadState.deliverableType,
        deliverable_status: uploadState.deliverableStatus,
        due_date: uploadState.dueDate || null,
        client_visible: uploadState.clientVisible,
        status_notes: uploadState.statusNotes || null,
      });

      if (dbErr) throw dbErr;

      setShowUpload(false);
      setUploadState({
        file: null, inquiryId: '', deliverableType: 'general', category: 'other',
        description: '', dueDate: '', deliverableStatus: 'pending', clientVisible: true, statusNotes: '',
      });
      await fetchData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Edit Status ──────────────────────────────────────────────────────────────

  const openEdit = (d: Deliverable) => {
    setEditingId(d.id);
    setEditStatus(d.deliverable_status ?? 'pending');
    setEditDueDate(d.due_date ?? '');
    setEditStatusNotes(d.status_notes ?? '');
    setEditClientVisible(d.client_visible ?? true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('case_documents')
        .update({
          deliverable_status: editStatus,
          due_date: editDueDate || null,
          status_notes: editStatusNotes || null,
          client_visible: editClientVisible,
        })
        .eq('id', editingId);
      if (err) throw err;

      // ── Auto-send lifecycle email when deliverable is approved ──
      if (editStatus === 'approved') {
        const deliverable = deliverables.find((d) => d.id === editingId);
        if (deliverable?.contact_inquiries?.email) {
          try {
            await fetch('/api/case-lifecycle/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventType: 'deliverable_approved',
                clientEmail: deliverable.contact_inquiries.email,
                clientName: deliverable.contact_inquiries.name,
                inquiryId: deliverable.inquiry_id,
                details: {
                  fileName: deliverable.file_name,
                  deliverableType: deliverable.deliverable_type ?? 'general',
                  caseName: deliverable.contact_inquiries.name,
                  statusNotes: editStatusNotes || null,
                  approvedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                },
              }),
            });
          } catch (emailErr) {
            console.warn('[CaseDeliverables] Failed to send approval email:', emailErr);
          }
        }
      }

      setEditingId(null);
      await fetchData();
    } catch (err: unknown) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = async (d: Deliverable) => {
    try {
      const { data } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(d.file_url, 300);
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = d.file_name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // ── Filtered List ────────────────────────────────────────────────────────────

  const filtered = deliverables.filter(d => {
    if (filterStatus !== 'all' && d.deliverable_status !== filterStatus) return false;
    if (filterType !== 'all' && d.deliverable_type !== filterType) return false;
    if (filterCase !== 'all' && d.inquiry_id !== filterCase) return false;
    if (showOverdueOnly && !isOverdue(d.due_date, d.deliverable_status)) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        d.file_name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.contact_inquiries?.name.toLowerCase().includes(q) ||
        d.contact_inquiries?.firm.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total: deliverables.length,
    pending: deliverables.filter(d => d.deliverable_status === 'pending').length,
    inProgress: deliverables.filter(d => d.deliverable_status === 'in_progress').length,
    completed: deliverables.filter(d => d.deliverable_status === 'completed').length,
    approved: deliverables.filter(d => d.deliverable_status === 'approved').length,
    overdue: deliverables.filter(d => isOverdue(d.due_date, d.deliverable_status)).length,
    dueSoon: deliverables.filter(d => isDueSoon(d.due_date)).length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600' },
          { label: 'Due Soon', value: stats.dueSoon, color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search deliverables…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-52"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Types</option>
            {Object.entries(DELIVERABLE_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Case filter */}
          <select
            value={filterCase}
            onChange={e => setFilterCase(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[180px]"
          >
            <option value="all">All Cases</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
            ))}
          </select>

          {/* Overdue toggle */}
          <button
            onClick={() => setShowOverdueOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors ${
              showOverdueOnly
                ? 'bg-red-50 border-red-200 text-red-700' :'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Overdue
          </button>
        </div>

        {/* Upload button */}
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm shadow-primary/20 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload Deliverable
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Deliverables Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deliverable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case / Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visible</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                    No deliverables found
                  </td>
                </tr>
              ) : (
                filtered.map(d => {
                  const sc = STATUS_CONFIG[d.deliverable_status] ?? STATUS_CONFIG.pending;
                  const tc = DELIVERABLE_TYPE_CONFIG[d.deliverable_type] ?? DELIVERABLE_TYPE_CONFIG.general;
                  const overdue = isOverdue(d.due_date, d.deliverable_status);
                  const dueSoon = isDueSoon(d.due_date);
                  return (
                    <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                            {(d.file_type ?? 'FILE').slice(0, 3).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[200px]">{d.file_name}</p>
                            {d.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{d.description}</p>
                            )}
                            {d.file_size && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5">{formatFileSize(d.file_size)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.contact_inquiries ? (
                          <div>
                            <p className="font-medium text-foreground">{d.contact_inquiries.name}</p>
                            <p className="text-xs text-muted-foreground">{d.contact_inquiries.service}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{tc.icon}</span>
                          <span>{tc.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.due_date ? (
                          <span className={`text-xs font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-orange-500' : 'text-foreground'}`}>
                            {overdue && '⚠ '}
                            {dueSoon && !overdue && '🔔 '}
                            {formatDate(d.due_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${d.client_visible ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {d.client_visible ? 'Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit status / due date"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDownload(d)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Download"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-secondary/10 text-xs text-muted-foreground">
            Showing {filtered.length} of {deliverables.length} deliverables
          </div>
        )}
      </div>

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg text-foreground">Upload Deliverable</h2>
              <button onClick={() => setShowUpload(false)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{uploadError}</div>
              )}

              {/* File picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">File *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                >
                  {uploadState.file ? (
                    <div>
                      <p className="font-medium text-foreground text-sm">{uploadState.file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatFileSize(uploadState.file.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="mx-auto mb-2 text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <p className="text-sm text-muted-foreground">Click to select file</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={Object.keys(ALLOWED_MIME_TYPES).join(',')}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadState(s => ({ ...s, file: f }));
                  }}
                />
              </div>

              {/* Case */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Case / Client *</label>
                <select
                  value={uploadState.inquiryId}
                  onChange={e => setUploadState(s => ({ ...s, inquiryId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a case…</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.service}</option>
                  ))}
                </select>
              </div>

              {/* Deliverable type + category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deliverable Type</label>
                  <select
                    value={uploadState.deliverableType}
                    onChange={e => setUploadState(s => ({ ...s, deliverableType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {Object.entries(DELIVERABLE_TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={uploadState.category}
                    onChange={e => setUploadState(s => ({ ...s, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {CATEGORY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Initial Status</label>
                  <select
                    value={uploadState.deliverableStatus}
                    onChange={e => setUploadState(s => ({ ...s, deliverableStatus: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Due Date</label>
                  <input
                    type="date"
                    value={uploadState.dueDate}
                    onChange={e => setUploadState(s => ({ ...s, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={uploadState.description}
                  onChange={e => setUploadState(s => ({ ...s, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of this deliverable…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Client visible toggle */}
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">Visible to Client</p>
                  <p className="text-xs text-muted-foreground">Client can see and download this file</p>
                </div>
                <button
                  onClick={() => setUploadState(s => ({ ...s, clientVisible: !s.clientVisible }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${uploadState.clientVisible ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${uploadState.clientVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadState.file || !uploadState.inquiryId}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Status Modal ── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-serif text-lg text-foreground">Update Deliverable</h2>
              <button onClick={() => setEditingId(null)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status Notes</label>
                <textarea
                  value={editStatusNotes}
                  onChange={e => setEditStatusNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes about this status change…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">Visible to Client</p>
                  <p className="text-xs text-muted-foreground">Client can see and download this file</p>
                </div>
                <button
                  onClick={() => setEditClientVisible(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editClientVisible ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editClientVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
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
