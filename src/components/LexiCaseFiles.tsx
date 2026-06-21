'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role: string | null;
  category: string | null;
  description: string | null;
  storage_path: string | null;
  created_at: string;
  version: number | null;
  parent_document_id: string | null;
  document_type: string | null;
  version_notes: string | null;
  requires_client_review: boolean | null;
  inquiry_id: string | null;
}

interface CaseFileTask {
  id: string;
  matter_ref: string;
  client_name: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assigned_to: string | null;
  linked_consultation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ConsultationBooking {
  id: string;
  client_name: string | null;
  client_email: string | null;
  scheduled_at: string | null;
  status: string | null;
  matter_type: string | null;
  notes: string | null;
}

interface Matter {
  ref: string;
  clientName: string;
  documents: CaseDocument[];
  tasks: CaseFileTask[];
  consultations: ConsultationBooking[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract', icon: '📄', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'discovery', label: 'Discovery', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'correspondence', label: 'Correspondence', icon: '✉️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'work_product', label: 'Work Product', icon: '📝', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'evidence', label: 'Evidence', icon: '🗂️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'other', label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: '○' },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700', icon: '◑' },
  completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700', icon: '●' },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-700', icon: '⚠' },
};

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDocTypeConfig(docType: string | null) {
  return DOCUMENT_TYPES.find(t => t.value === (docType ?? 'other')) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function buildVersionChains(documents: CaseDocument[]): Map<string, CaseDocument[]> {
  const chains = new Map<string, CaseDocument[]>();
  const roots = documents.filter(d => !d.parent_document_id);
  for (const root of roots) {
    const chain: CaseDocument[] = [root];
    const children = documents
      .filter(d => d.parent_document_id === root.id)
      .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
    chain.push(...children);
    chains.set(root.id, chain);
  }
  return chains;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LexiCaseFilesProps {
  prefillClientName?: string;
  prefillCaseRef?: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LexiCaseFiles({ prefillClientName, prefillCaseRef }: LexiCaseFilesProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── View state ──────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'matters' | 'documents' | 'tasks' | 'consultations'>('matters');
  const [selectedMatterRef, setSelectedMatterRef] = useState<string>(prefillCaseRef ?? '');
  const [selectedClientName, setSelectedClientName] = useState<string>(prefillClientName ?? '');

  // ── Data ────────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [tasks, setTasks] = useState<CaseFileTask[]>([]);
  const [consultations, setConsultations] = useState<ConsultationBooking[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Upload state ────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: 'other',
    description: '',
    category: 'case_files',
    versionNotes: '',
    parentDocumentId: '',
    requiresReview: false,
    matterRef: prefillCaseRef ?? '',
    clientName: prefillClientName ?? '',
  });
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // ── Task state ──────────────────────────────────────────────────────────────
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as CaseFileTask['priority'],
    assignedTo: '',
    matterRef: prefillCaseRef ?? '',
    clientName: prefillClientName ?? '',
    linkedConsultationId: '',
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [docFilter, setDocFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [expandedVersionChains, setExpandedVersionChains] = useState<Set<string>>(new Set());

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, tasksRes, consultRes] = await Promise.all([
        supabase
          .from('case_documents')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('case_file_tasks')
          .select('*')
          .order('due_date', { ascending: true }),
        supabase
          .from('consultation_bookings')
          .select('id, client_name, client_email, scheduled_at, status, matter_type, notes')
          .order('scheduled_at', { ascending: false })
          .limit(50),
      ]);

      const docs: CaseDocument[] = docsRes.data ?? [];
      const taskData: CaseFileTask[] = (tasksRes.data ?? []).map((t: CaseFileTask) => {
        const days = daysUntil(t.due_date);
        if (t.status !== 'completed' && days < 0) {
          return { ...t, status: 'overdue' as const };
        }
        return t;
      });
      const consultData: ConsultationBooking[] = consultRes.data ?? [];

      setDocuments(docs);
      setTasks(taskData);
      setConsultations(consultData);

      // Build matters list from unique matter refs in docs + tasks
      const matterMap = new Map<string, Matter>();
      for (const doc of docs) {
        const ref = doc.inquiry_id ?? 'unassigned';
        if (!matterMap.has(ref)) {
          matterMap.set(ref, { ref, clientName: doc.uploaded_by ?? 'Unknown', documents: [], tasks: [], consultations: [] });
        }
        matterMap.get(ref)!.documents.push(doc);
      }
      for (const task of taskData) {
        const ref = task.matter_ref;
        if (!matterMap.has(ref)) {
          matterMap.set(ref, { ref, clientName: task.client_name, documents: [], tasks: [], consultations: [] });
        }
        matterMap.get(ref)!.tasks.push(task);
        matterMap.get(ref)!.clientName = task.client_name;
      }
      setMatters(Array.from(matterMap.values()));
    } catch {
      toast.error('Failed to load case files');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Upload handler ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES[file.type]) {
      toast.error('File type not allowed. Use PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, or TXT.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const storagePath = `case-files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(storagePath);

      // Determine version number
      let version = 1;
      if (uploadForm.parentDocumentId) {
        const { data: siblings } = await supabase
          .from('case_documents')
          .select('version')
          .eq('parent_document_id', uploadForm.parentDocumentId)
          .order('version', { ascending: false })
          .limit(1);
        version = ((siblings?.[0]?.version ?? 1) as number) + 1;
      }

      const { error: dbError } = await supabase.from('case_documents').insert({
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: uploadForm.clientName || 'admin',
        uploaded_by_role: 'admin',
        category: uploadForm.category,
        description: uploadForm.description || null,
        storage_path: storagePath,
        document_type: uploadForm.documentType,
        version_notes: uploadForm.versionNotes || null,
        parent_document_id: uploadForm.parentDocumentId || null,
        version,
        requires_client_review: uploadForm.requiresReview,
        inquiry_id: uploadForm.matterRef || null,
      });

      if (dbError) throw dbError;

      toast.success(`${file.name} uploaded (v${version})`);
      setShowUploadPanel(false);
      setUploadForm(f => ({ ...f, description: '', versionNotes: '', parentDocumentId: '', requiresReview: false }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // ── Task handlers ─────────────────────────────────────────────────────────────
  const handleSaveTask = async () => {
    if (!taskForm.title.trim() || !taskForm.dueDate || !taskForm.matterRef.trim()) {
      toast.error('Title, matter reference, and due date are required');
      return;
    }

    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        due_date: taskForm.dueDate,
        priority: taskForm.priority,
        status: 'pending' as const,
        assigned_to: taskForm.assignedTo.trim() || null,
        matter_ref: taskForm.matterRef.trim(),
        client_name: taskForm.clientName.trim() || 'Unknown',
        linked_consultation_id: taskForm.linkedConsultationId || null,
      };

      if (editingTaskId) {
        const { error } = await supabase.from('case_file_tasks').update(payload).eq('id', editingTaskId);
        if (error) throw error;
        toast.success('Task updated');
      } else {
        const { error } = await supabase.from('case_file_tasks').insert(payload);
        if (error) throw error;
        toast.success('Task created');
      }

      setShowTaskForm(false);
      setEditingTaskId(null);
      setTaskForm({ title: '', description: '', dueDate: '', priority: 'medium', assignedTo: '', matterRef: prefillCaseRef ?? '', clientName: prefillClientName ?? '', linkedConsultationId: '' });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save task';
      toast.error(msg);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: CaseFileTask['status']) => {
    try {
      const { error } = await supabase.from('case_file_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      toast.success('Task updated');
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const { error } = await supabase.from('case_file_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const openEditTask = (task: CaseFileTask) => {
    setTaskForm({
      title: task.title,
      description: task.description ?? '',
      dueDate: task.due_date,
      priority: task.priority,
      assignedTo: task.assigned_to ?? '',
      matterRef: task.matter_ref,
      clientName: task.client_name,
      linkedConsultationId: task.linked_consultation_id ?? '',
    });
    setEditingTaskId(task.id);
    setShowTaskForm(true);
  };

  // ── Filtered data ─────────────────────────────────────────────────────────────
  const filteredDocs = documents.filter(d => {
    if (selectedMatterRef && d.inquiry_id !== selectedMatterRef) return false;
    if (docFilter !== 'all' && d.document_type !== docFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (selectedMatterRef && t.matter_ref !== selectedMatterRef) return false;
    if (taskFilter !== 'all' && t.status !== taskFilter) return false;
    return true;
  });

  const filteredConsultations = consultations.filter(c => {
    if (selectedMatterRef && !c.client_name?.toLowerCase().includes(selectedClientName.toLowerCase())) return false;
    return true;
  });

  const versionChains = buildVersionChains(filteredDocs);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/40 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🗂️</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Case Files</p>
              <p className="text-[10px] text-muted-foreground">Documents · Versions · Consultations · Deadlines</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowUploadPanel(true); setShowTaskForm(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload
            </button>
            <button
              onClick={() => { setShowTaskForm(true); setShowUploadPanel(false); setEditingTaskId(null); setTaskForm({ title: '', description: '', dueDate: '', priority: 'medium', assignedTo: '', matterRef: selectedMatterRef, clientName: selectedClientName, linkedConsultationId: '' }); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Task
            </button>
            <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
        </div>

        {/* Matter filter */}
        {selectedMatterRef && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Filtered by matter:</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold">{selectedMatterRef}</span>
            <button onClick={() => { setSelectedMatterRef(''); setSelectedClientName(''); }} className="text-[10px] text-muted-foreground hover:text-foreground underline">Clear</button>
          </div>
        )}
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className="border-b border-border bg-card p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground">Upload Document</p>
            <button onClick={() => setShowUploadPanel(false)} className="text-muted-foreground hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Matter Ref</label>
              <input
                type="text"
                value={uploadForm.matterRef}
                onChange={e => setUploadForm(f => ({ ...f, matterRef: e.target.value }))}
                placeholder="e.g. BLS-2026-001"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Client Name</label>
              <input
                type="text"
                value={uploadForm.clientName}
                onChange={e => setUploadForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Client name"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Document Type</label>
              <select
                value={uploadForm.documentType}
                onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Version of (optional)</label>
              <select
                value={uploadForm.parentDocumentId}
                onChange={e => setUploadForm(f => ({ ...f, parentDocumentId: e.target.value }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">New document</option>
                {documents.filter(d => !d.parent_document_id).map(d => (
                  <option key={d.id} value={d.id}>{d.file_name} (v{d.version ?? 1})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-[10px] text-muted-foreground mb-1">Description</label>
            <input
              type="text"
              value={uploadForm.description}
              onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…"
              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          {uploadForm.parentDocumentId && (
            <div className="mb-2">
              <label className="block text-[10px] text-muted-foreground mb-1">Version Notes</label>
              <input
                type="text"
                value={uploadForm.versionNotes}
                onChange={e => setUploadForm(f => ({ ...f, versionNotes: e.target.value }))}
                placeholder="What changed in this version?"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="requiresReview"
              checked={uploadForm.requiresReview}
              onChange={e => setUploadForm(f => ({ ...f, requiresReview: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="requiresReview" className="text-[10px] text-muted-foreground">Requires client review</label>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Uploading…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Click to select file (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT · max 10 MB)
              </>
            )}
          </button>
        </div>
      )}

      {/* Task Form Panel */}
      {showTaskForm && (
        <div className="border-b border-border bg-card p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground">{editingTaskId ? 'Edit Task' : 'New Task Deadline'}</p>
            <button onClick={() => { setShowTaskForm(false); setEditingTaskId(null); }} className="text-muted-foreground hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Matter Ref *</label>
              <input
                type="text"
                value={taskForm.matterRef}
                onChange={e => setTaskForm(f => ({ ...f, matterRef: e.target.value }))}
                placeholder="e.g. BLS-2026-001"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Client Name</label>
              <input
                type="text"
                value={taskForm.clientName}
                onChange={e => setTaskForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Client name"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-[10px] text-muted-foreground mb-1">Task Title *</label>
            <input
              type="text"
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. File motion to dismiss"
              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="mb-2">
            <label className="block text-[10px] text-muted-foreground mb-1">Description</label>
            <textarea
              value={taskForm.description}
              onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Additional details…"
              rows={2}
              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Due Date *</label>
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Priority</label>
              <select
                value={taskForm.priority}
                onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as CaseFileTask['priority'] }))}
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">Assigned To</label>
              <input
                type="text"
                value={taskForm.assignedTo}
                onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                placeholder="Name"
                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] text-muted-foreground mb-1">Link to Consultation</label>
            <select
              value={taskForm.linkedConsultationId}
              onChange={e => setTaskForm(f => ({ ...f, linkedConsultationId: e.target.value }))}
              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">None</option>
              {consultations.map(c => (
                <option key={c.id} value={c.id}>
                  {c.client_name ?? 'Unknown'} — {c.scheduled_at ? formatDate(c.scheduled_at) : 'No date'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveTask}
              className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {editingTaskId ? 'Update Task' : 'Create Task'}
            </button>
            <button
              onClick={() => { setShowTaskForm(false); setEditingTaskId(null); }}
              className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-semibold hover:bg-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex border-b border-border shrink-0 bg-secondary/20">
        {([
          { id: 'matters', label: 'Matters', count: matters.length },
          { id: 'documents', label: 'Documents', count: documents.length },
          { id: 'tasks', label: 'Tasks', count: tasks.filter(t => t.status !== 'completed').length },
          { id: 'consultations', label: 'Consultations', count: consultations.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex-1 py-2 px-2 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${activeView === tab.id ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold ${activeView === tab.id ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin text-primary" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        ) : (
          <>
            {/* Matters View */}
            {activeView === 'matters' && (
              <div className="p-3 space-y-2">
                {matters.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="text-3xl mb-2">🗂️</div>
                    <p className="text-xs font-semibold">No matters yet</p>
                    <p className="text-[10px] mt-1">Upload a document or create a task to start a matter file</p>
                  </div>
                ) : (
                  matters.map(matter => {
                    const overdueTasks = matter.tasks.filter(t => t.status === 'overdue').length;
                    const urgentTasks = matter.tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
                    return (
                      <div
                        key={matter.ref}
                        className="bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => { setSelectedMatterRef(matter.ref); setSelectedClientName(matter.clientName); setActiveView('documents'); }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground truncate">{matter.clientName}</span>
                              {overdueTasks > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[9px] font-bold shrink-0">
                                  {overdueTasks} overdue
                                </span>
                              )}
                              {urgentTasks > 0 && !overdueTasks && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-bold shrink-0">
                                  {urgentTasks} urgent
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono">{matter.ref}</p>
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-1"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {matter.documents.length} docs
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {matter.tasks.filter(t => t.status !== 'completed').length} open tasks
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Documents View */}
            {activeView === 'documents' && (
              <div className="p-3">
                {/* Filter bar */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {[{ value: 'all', label: 'All' }, ...DOCUMENT_TYPES].map(t => (
                    <button
                      key={t.value}
                      onClick={() => setDocFilter(t.value)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0 ${docFilter === t.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                    >
                      {'icon' in t ? `${t.icon} ` : ''}{t.label}
                    </button>
                  ))}
                </div>

                {filteredDocs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="text-3xl mb-2">📄</div>
                    <p className="text-xs font-semibold">No documents</p>
                    <p className="text-[10px] mt-1">Upload a document to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(versionChains.entries()).map(([rootId, chain]) => {
                      const root = chain[0];
                      const hasVersions = chain.length > 1;
                      const isExpanded = expandedVersionChains.has(rootId);
                      const docType = getDocTypeConfig(root.document_type);
                      return (
                        <div key={rootId} className="bg-card border border-border rounded-xl overflow-hidden">
                          {/* Root document row */}
                          <div className="flex items-start gap-2 p-3">
                            <span className="text-base shrink-0 mt-0.5">{docType.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">{root.file_name}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${docType.color}`}>{docType.label}</span>
                                <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-full text-[9px] font-semibold">v{root.version ?? 1}</span>
                                {root.requires_client_review && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-semibold">Review needed</span>
                                )}
                              </div>
                              {root.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{root.description}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-muted-foreground">{formatDate(root.created_at)}</span>
                                {root.file_size && <span className="text-[9px] text-muted-foreground">{formatFileSize(root.file_size)}</span>}
                                {root.uploaded_by && <span className="text-[9px] text-muted-foreground">by {root.uploaded_by}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {hasVersions && (
                                <button
                                  onClick={() => setExpandedVersionChains(prev => {
                                    const next = new Set(prev);
                                    if (next.has(rootId)) next.delete(rootId); else next.add(rootId);
                                    return next;
                                  })}
                                  className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-lg text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  {chain.length - 1}v
                                </button>
                              )}
                              <a
                                href={root.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-secondary hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
                                title="Download"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </a>
                            </div>
                          </div>

                          {/* Version history */}
                          {hasVersions && isExpanded && (
                            <div className="border-t border-border bg-secondary/30 px-3 py-2 space-y-1.5">
                              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Version History</p>
                              {chain.slice(1).map(ver => (
                                <div key={ver.id} className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono text-muted-foreground w-6 shrink-0">v{ver.version ?? 1}</span>
                                  <span className="text-[10px] text-foreground truncate flex-1">{ver.file_name}</span>
                                  {ver.version_notes && <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{ver.version_notes}</span>}
                                  <span className="text-[9px] text-muted-foreground shrink-0">{formatDate(ver.created_at)}</span>
                                  <a
                                    href={ver.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tasks View */}
            {activeView === 'tasks' && (
              <div className="p-3">
                {/* Filter bar */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {(['all', 'pending', 'in_progress', 'overdue', 'completed'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setTaskFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0 ${taskFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                    >
                      {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-xs font-semibold">No tasks</p>
                    <p className="text-[10px] mt-1">Create a task deadline to track matter work</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map(task => {
                      const days = daysUntil(task.due_date);
                      const priority = PRIORITY_CONFIG[task.priority];
                      const status = STATUS_CONFIG[task.status];
                      const linkedConsult = task.linked_consultation_id
                        ? consultations.find(c => c.id === task.linked_consultation_id)
                        : null;
                      return (
                        <div key={task.id} className={`bg-card border rounded-xl p-3 ${task.status === 'overdue' ? 'border-red-200' : 'border-border'}`}>
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                              className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-border hover:border-primary'}`}
                            >
                              {task.status === 'completed' && (
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className={`text-xs font-semibold ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${priority.color}`}>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${priority.dot} mr-1`} />
                                  {priority.label}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${status.color}`}>{status.label}</span>
                              </div>
                              {task.description && <p className="text-[10px] text-muted-foreground mb-1 truncate">{task.description}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-mono text-muted-foreground">{task.matter_ref}</span>
                                <span className={`text-[9px] font-semibold ${days < 0 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`} · {formatDate(task.due_date)}
                                </span>
                                {task.assigned_to && <span className="text-[9px] text-muted-foreground">→ {task.assigned_to}</span>}
                              </div>
                              {linkedConsult && (
                                <div className="mt-1 flex items-center gap-1">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  <span className="text-[9px] text-muted-foreground">Linked: {linkedConsult.client_name} — {linkedConsult.scheduled_at ? formatDate(linkedConsult.scheduled_at) : 'No date'}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {task.status !== 'completed' && (
                                <select
                                  value={task.status}
                                  onChange={e => handleUpdateTaskStatus(task.id, e.target.value as CaseFileTask['status'])}
                                  className="px-1.5 py-1 bg-secondary border border-border rounded-lg text-[9px] text-foreground focus:outline-none"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                </select>
                              )}
                              <button onClick={() => openEditTask(task)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Consultations View */}
            {activeView === 'consultations' && (
              <div className="p-3 space-y-2">
                {filteredConsultations.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-xs font-semibold">No consultations</p>
                    <p className="text-[10px] mt-1">Consultations booked through the portal will appear here</p>
                  </div>
                ) : (
                  filteredConsultations.map(c => {
                    const linkedTasks = tasks.filter(t => t.linked_consultation_id === c.id);
                    return (
                      <div key={c.id} className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground">{c.client_name ?? 'Unknown Client'}</span>
                              {c.status && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${c.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                  {c.status}
                                </span>
                              )}
                            </div>
                            {c.client_email && <p className="text-[10px] text-muted-foreground">{c.client_email}</p>}
                            {c.scheduled_at && <p className="text-[10px] text-muted-foreground mt-0.5">📅 {formatDate(c.scheduled_at)}</p>}
                            {c.matter_type && <p className="text-[10px] text-muted-foreground mt-0.5">⚖️ {c.matter_type}</p>}
                            {c.notes && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{c.notes}</p>}
                            {linkedTasks.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {linkedTasks.map(t => (
                                  <span key={t.id} className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_CONFIG[t.status].color}`}>
                                    {t.title}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setTaskForm(f => ({ ...f, linkedConsultationId: c.id, clientName: c.client_name ?? '' }));
                              setShowTaskForm(true);
                              setEditingTaskId(null);
                            }}
                            className="shrink-0 px-2 py-1 bg-secondary rounded-lg text-[9px] text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                            title="Add task linked to this consultation"
                          >
                            + Task
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
