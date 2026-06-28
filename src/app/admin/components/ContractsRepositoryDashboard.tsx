'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  title: string;
  description: string | null;
  contract_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  inquiry_id: string | null;
  user_id: string | null;
  client_email: string | null;
  client_name: string | null;
  status: string;
  signed_at: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  version: string | null;
  tags: string[] | null;
  is_template: boolean;
  visible_to_client: boolean;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface UploadForm {
  title: string;
  description: string;
  contract_type: string;
  client_email: string;
  client_name: string;
  status: string;
  effective_date: string;
  expiry_date: string;
  version: string;
  notes: string;
  is_template: boolean;
  visible_to_client: boolean;
  tags: string;
}

const DEFAULT_FORM: UploadForm = {
  title: '',
  description: '',
  contract_type: 'general',
  client_email: '',
  client_name: '',
  status: 'active',
  effective_date: '',
  expiry_date: '',
  version: '1.0',
  notes: '',
  is_template: false,
  visible_to_client: true,
  tags: '',
};

const CONTRACT_TYPES = [
  { value: 'general', label: 'Service Agreement' },
  { value: 'retainer', label: 'Retainer Contract' },
  { value: 'nda', label: 'Non-Disclosure Agreement' },
  { value: 'engagement', label: 'Engagement Letter' },
  { value: 'intake', label: 'Intake Form' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'template', label: 'Template' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'signed', label: 'Signed' },
  { value: 'pending_signature', label: 'Awaiting Signature' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'draft', label: 'Draft' },
];

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  signed: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_signature: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  terminated: 'bg-red-50 text-red-600 border-red-200',
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContractsRepositoryDashboard() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [form, setForm] = useState<UploadForm>(DEFAULT_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('contracts_repository')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setContracts(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !form.title) {
      setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !editingContract) {
      setUploadError('Please select a file to upload.');
      return;
    }
    setUploading(true);
    setUploadError(null);

    try {
      const supabase = createClient();
      let fileUrl = editingContract?.file_url ?? '';
      let fileName = editingContract?.file_name ?? '';
      let fileSize = editingContract?.file_size ?? null;
      let fileType = editingContract?.file_type ?? null;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `contracts/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        const { error: storageError } = await supabase.storage
          .from('case-documents')
          .upload(path, selectedFile, { upsert: false });
        if (storageError) throw storageError;
        fileUrl = path;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type || `application/${ext}`;
      }

      // Resolve inquiry_id from client email
      let inquiryId: string | null = null;
      if (form.client_email) {
        const { data: inquiryData } = await supabase
          .from('contact_inquiries')
          .select('id')
          .eq('email', form.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        inquiryId = inquiryData?.id ?? null;
      }

      const payload = {
        title: form.title,
        description: form.description || null,
        contract_type: form.contract_type,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize,
        file_type: fileType,
        inquiry_id: inquiryId,
        client_email: form.client_email || null,
        client_name: form.client_name || null,
        status: form.status,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        version: form.version || '1.0',
        notes: form.notes || null,
        is_template: form.is_template,
        visible_to_client: form.visible_to_client,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
        uploaded_by: 'admin',
      };

      if (editingContract) {
        const { error: updateError } = await supabase
          .from('contracts_repository')
          .update(payload)
          .eq('id', editingContract.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('contracts_repository')
          .insert(payload);
        if (insertError) throw insertError;
      }

      setShowUploadModal(false);
      setEditingContract(null);
      setForm(DEFAULT_FORM);
      setSelectedFile(null);
      fetchContracts();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (contract: Contract) => {
    if (!confirm(`Delete "${contract.title}"? This cannot be undone.`)) return;
    setDeletingId(contract.id);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('contracts_repository')
        .delete()
        .eq('id', contract.id);
      if (deleteError) throw deleteError;
      setContracts((prev) => prev.filter((c) => c.id !== contract.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setForm({
      title: contract.title,
      description: contract.description ?? '',
      contract_type: contract.contract_type,
      client_email: contract.client_email ?? '',
      client_name: contract.client_name ?? '',
      status: contract.status,
      effective_date: contract.effective_date ?? '',
      expiry_date: contract.expiry_date ?? '',
      version: contract.version ?? '1.0',
      notes: contract.notes ?? '',
      is_template: contract.is_template,
      visible_to_client: contract.visible_to_client,
      tags: contract.tags?.join(', ') ?? '',
    });
    setSelectedFile(null);
    setShowUploadModal(true);
  };

  const handleToggleVisibility = async (contract: Contract) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contracts_repository')
        .update({ visible_to_client: !contract.visible_to_client })
        .eq('id', contract.id);
      if (updateError) throw updateError;
      setContracts((prev) =>
        prev.map((c) => c.id === contract.id ? { ...c, visible_to_client: !c.visible_to_client } : c)
      );
    } catch {
      // silent
    }
  };

  const handleDownload = async (contract: Contract) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(contract.file_url, 3600);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        window.open(contract.file_url, '_blank');
      }
    } catch {
      window.open(contract.file_url, '_blank');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = contracts.filter((c) => {
    const matchesType = filterType === 'all' || c.contract_type === filterType;
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.client_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.client_email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const stats = {
    total: contracts.length,
    active: contracts.filter((c) => c.status === 'active' || c.status === 'signed').length,
    pending: contracts.filter((c) => c.status === 'pending_signature').length,
    templates: contracts.filter((c) => c.is_template).length,
    clientVisible: contracts.filter((c) => c.visible_to_client).length,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contract Repository</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Upload, manage, and share contracts with clients securely.</p>
        </div>
        <button
          onClick={() => { setEditingContract(null); setForm(DEFAULT_FORM); setSelectedFile(null); setShowUploadModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Contract
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Active / Signed', value: stats.active },
          { label: 'Awaiting Signature', value: stats.pending },
          { label: 'Templates', value: stats.templates },
          { label: 'Client Visible', value: stats.clientVisible },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by title, client, or file name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Types</option>
          {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all' ? 'No contracts match your filters' : 'No contracts yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all' ?'Try adjusting your search or filters.' :'Upload your first contract to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contract) => {
            const statusPill = STATUS_PILL[contract.status] ?? STATUS_PILL.draft;
            const typeLabel = CONTRACT_TYPES.find((t) => t.value === contract.contract_type)?.label ?? contract.contract_type;
            const isDeleting = deletingId === contract.id;

            return (
              <div key={contract.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{contract.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusPill}`}>
                        {STATUS_OPTIONS.find((s) => s.value === contract.status)?.label ?? contract.status}
                      </span>
                      {contract.is_template && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">Template</span>
                      )}
                      {!contract.visible_to_client && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200">Admin Only</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span>{typeLabel}</span>
                      {contract.version && <span>v{contract.version}</span>}
                      {contract.client_name && <span className="font-medium text-foreground">{contract.client_name}</span>}
                      {contract.client_email && <span>{contract.client_email}</span>}
                      <span>Added {fmtDate(contract.created_at)}</span>
                      {contract.effective_date && <span>Effective {fmtDate(contract.effective_date)}</span>}
                      {contract.signed_at && <span className="text-emerald-600 font-medium">Signed {fmtDate(contract.signed_at)}</span>}
                      {contract.file_size && <span>{fmtFileSize(contract.file_size)}</span>}
                    </div>

                    {contract.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{contract.description}</p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleDownload(contract)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={() => handleEdit(contract)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleVisibility(contract)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          contract.visible_to_client
                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' :'border-border text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {contract.visible_to_client
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          }
                        </svg>
                        {contract.visible_to_client ? 'Visible to Client' : 'Hidden from Client'}
                      </button>
                      <button
                        onClick={() => handleDelete(contract)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {editingContract ? 'Edit Contract' : 'Upload Contract'}
              </h3>
              <button
                onClick={() => { setShowUploadModal(false); setEditingContract(null); setUploadError(null); }}
                className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              {/* File */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  {editingContract ? 'Replace File (optional)' : 'Contract File *'}
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                  required={!editingContract}
                  className="w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors"
                />
                {editingContract && (
                  <p className="text-xs text-muted-foreground mt-1">Current: {editingContract.file_name}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Service Agreement — John Smith"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Type + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Type</label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => setForm((p) => ({ ...p, contract_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Client info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Client Name</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Client Email</label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                    placeholder="client@email.com"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Expiry Date</label>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Version + Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Version</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                    placeholder="1.0"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    placeholder="retainer, 2026"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief description of this contract…"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Internal Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Admin-only notes…"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visible_to_client}
                    onChange={(e) => setForm((p) => ({ ...p, visible_to_client: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-foreground">Visible to client</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_template}
                    onChange={(e) => setForm((p) => ({ ...p, is_template: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-foreground">Mark as template</span>
                </label>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{uploadError}</div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {uploading ? (editingContract ? 'Saving…' : 'Uploading…') : (editingContract ? 'Save Changes' : 'Upload Contract')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setEditingContract(null); setUploadError(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
