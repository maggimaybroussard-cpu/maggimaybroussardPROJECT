'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ESignatureDocument {
  id: string;
  title: string;
  document_type: string;
  status: 'draft' | 'pending_signature' | 'signed' | 'expired' | 'declined';
  signer_name: string;
  signer_email: string;
  inquiry_id: string | null;
  token: string;
  signed_at: string | null;
  expires_at: string | null;
  signature_data: string | null;
  ip_address: string | null;
  created_at: string;
  file_url: string | null;
}

interface SignatureStats {
  total: number;
  pending: number;
  signed: number;
  expired: number;
}

const DOC_TYPES = [
  'Engagement Letter',
  'Retainer Agreement',
  'Non-Disclosure Agreement',
  'Settlement Agreement',
  'Authorization Form',
  'Fee Agreement',
  'Consent Form',
  'Other',
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  pending_signature: 'bg-amber-100 text-amber-700 border-amber-200',
  signed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expired: 'bg-red-100 text-red-600 border-red-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_signature: 'Pending',
  signed: 'Signed',
  expired: 'Expired',
  declined: 'Declined',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignaturePreview({ data }: { data: string }) {
  if (!data) return null;
  if (data.startsWith('data:image')) {
    return <img src={data} alt="Signature" className="max-h-16 object-contain" />;
  }
  return (
    <span className="font-serif text-2xl italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
      {data}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentESignatureManager() {
  const [documents, setDocuments] = useState<ESignatureDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SignatureStats>({ total: 0, pending: 0, signed: 0, expired: 0 });
  const [filter, setFilter] = useState<'all' | 'pending_signature' | 'signed' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ESignatureDocument | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    title: '',
    document_type: 'Engagement Letter',
    signer_name: '',
    signer_email: '',
    inquiry_id: '',
    expires_days: '30',
  });
  const [creating, setCreating] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('engagement_letters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const mapped: ESignatureDocument[] = data.map((d: Record<string, unknown>) => ({
          id: String(d.id ?? ''),
          title: String(d.title ?? d.document_type ?? 'Document'),
          document_type: String(d.document_type ?? 'Engagement Letter'),
          status: (d.status as ESignatureDocument['status']) ?? 'draft',
          signer_name: String(d.client_name ?? d.signer_name ?? ''),
          signer_email: String(d.client_email ?? d.signer_email ?? ''),
          inquiry_id: d.inquiry_id ? String(d.inquiry_id) : null,
          token: String(d.token ?? ''),
          signed_at: d.signed_at ? String(d.signed_at) : null,
          expires_at: d.expires_at ? String(d.expires_at) : null,
          signature_data: d.signature_data ? String(d.signature_data) : null,
          ip_address: d.ip_address ? String(d.ip_address) : null,
          created_at: String(d.created_at ?? new Date().toISOString()),
          file_url: d.file_url ? String(d.file_url) : null,
        }));
        setDocuments(mapped);
        setStats({
          total: mapped.length,
          pending: mapped.filter((d) => d.status === 'pending_signature').length,
          signed: mapped.filter((d) => d.status === 'signed').length,
          expired: mapped.filter((d) => d.status === 'expired').length,
        });
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    if (!form.title || !form.signer_name || !form.signer_email) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(form.expires_days || '30'));

      await supabase.from('engagement_letters').insert({
        title: form.title,
        document_type: form.document_type,
        client_name: form.signer_name,
        client_email: form.signer_email,
        inquiry_id: form.inquiry_id || null,
        token,
        status: 'pending_signature',
        expires_at: expiresAt.toISOString(),
        retainer_amount: 0,
        scope_of_work: form.document_type,
      });

      toast.success('Document created and ready for signature');
      setShowCreate(false);
      setForm({ title: '', document_type: 'Engagement Letter', signer_name: '', signer_email: '', inquiry_id: '', expires_days: '30' });
      fetchDocuments();
    } catch {
      toast.error('Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const copySigningLink = async (token: string, docId: string) => {
    const link = `${window.location.origin}/engagement-letter/${token}`;
    await navigator.clipboard.writeText(link);
    setCopySuccess(docId);
    toast.success('Signing link copied!');
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const sendReminder = async (doc: ESignatureDocument) => {
    setSendingReminder(doc.id);
    try {
      await fetch('/api/engagement-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: doc.signer_email,
          clientName: doc.signer_name,
          token: doc.token,
          isReminder: true,
        }),
      });
      toast.success(`Reminder sent to ${doc.signer_email}`);
    } catch {
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const filtered = documents.filter((d) => {
    const matchesFilter = filter === 'all' || d.status === filter;
    const matchesSearch = !search || d.signer_name.toLowerCase().includes(search.toLowerCase()) || d.signer_email.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: stats.total, icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          ), color: 'text-foreground', bg: 'bg-secondary/40' },
          { label: 'Pending Signature', value: stats.pending, icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          ), color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Signed', value: stats.signed, icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
            </svg>
          ), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Expired', value: stats.expired, icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          ), color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-2xl p-5`}>
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1">
            {(['all', 'pending_signature', 'signed', 'expired'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all w-48"
            />
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Document
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-foreground">Create Signature Request</h3>
              <p className="text-xs text-muted-foreground">Send a document for digital signature</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Document Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Retainer Agreement — Smith & Associates"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Document Type</label>
              <select
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Expires In (Days)</label>
              <input
                type="number"
                value={form.expires_days}
                onChange={(e) => setForm({ ...form, expires_days: e.target.value })}
                min="1"
                max="365"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Signer Name *</label>
              <input
                type="text"
                value={form.signer_name}
                onChange={(e) => setForm({ ...form, signer_name: e.target.value })}
                placeholder="Full name"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Signer Email *</label>
              <input
                type="email"
                value={form.signer_email}
                onChange={(e) => setForm({ ...form, signer_email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              {creating ? 'Creating…' : 'Create & Send Link'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-serif text-lg text-foreground">Signature Documents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage all documents pending or completed signature</p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">No documents found</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-xs text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
            >
              Create your first document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Document</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Signer</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Signed / Expires</th>
                  <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr
                    key={doc.id}
                    className={`border-b border-border last:border-0 transition-colors hover:bg-secondary/20 cursor-pointer ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
                    onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{doc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.document_type}</p>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <p className="text-foreground/80">{doc.signer_name}</p>
                      <p className="text-xs text-muted-foreground">{doc.signer_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[doc.status]}`}>
                        {doc.status === 'signed' && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {STATUS_LABELS[doc.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-muted-foreground text-xs">
                      {doc.signed_at ? (
                        <span className="text-emerald-600">Signed {fmtDate(doc.signed_at)}</span>
                      ) : doc.expires_at ? (
                        <span>Expires {fmtDate(doc.expires_at)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {doc.status === 'pending_signature' && (
                          <>
                            <button
                              onClick={() => copySigningLink(doc.token, doc.id)}
                              className={`p-1.5 rounded-lg border transition-all text-xs ${copySuccess === doc.id ? 'border-emerald-300 text-emerald-600 bg-emerald-50' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}
                              title="Copy signing link"
                            >
                              {copySuccess === doc.id ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => sendReminder(doc)}
                              disabled={sendingReminder === doc.id}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
                              title="Send reminder"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                            </button>
                          </>
                        )}
                        {doc.status === 'signed' && doc.signature_data && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span className="text-xs text-emerald-700 font-medium">Verified</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedDoc && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-serif text-xl text-foreground">{selectedDoc.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedDoc.document_type}</p>
            </div>
            <button
              onClick={() => setSelectedDoc(null)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Signer</p>
                <p className="text-sm font-medium text-foreground">{selectedDoc.signer_name}</p>
                <p className="text-xs text-muted-foreground">{selectedDoc.signer_email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[selectedDoc.status]}`}>
                  {STATUS_LABELS[selectedDoc.status]}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Created</p>
                <p className="text-sm text-foreground">{fmtDate(selectedDoc.created_at)}</p>
              </div>
              {selectedDoc.signed_at && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Signed At</p>
                  <p className="text-sm text-emerald-600 font-medium">{fmtDate(selectedDoc.signed_at)}</p>
                </div>
              )}
              {selectedDoc.ip_address && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">IP Address</p>
                  <p className="text-sm text-muted-foreground font-mono">{selectedDoc.ip_address}</p>
                </div>
              )}
            </div>

            {selectedDoc.signature_data && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Digital Signature</p>
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center min-h-[80px]">
                  <SignaturePreview data={selectedDoc.signature_data} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Legally binding electronic signature
                </p>
              </div>
            )}
          </div>

          {selectedDoc.status === 'pending_signature' && (
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Signing Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-foreground font-mono truncate">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/engagement-letter/${selectedDoc.token}`}
                </code>
                <button
                  onClick={() => copySigningLink(selectedDoc.token, selectedDoc.id)}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
