'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SharedDocument {
  id: string;
  document_id: string;
  file_name: string;
  file_url: string;
  share_token: string;
  expires_at: string;
  created_by: string;
  access_count: number;
  max_access: number | null;
  is_active: boolean;
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string;
  inquiry_id: string | null;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  inquiry_id: string;
  contact_inquiries?: { name: string } | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDaysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const exp = new Date(expiresAt);
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function SecureDocumentSharing() {
  const [sharedDocs, setSharedDocs] = useState<SharedDocument[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ documentId: '', recipientName: '', recipientEmail: '', expiryDays: 7, maxAccess: '' });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [sharedRes, docsRes] = await Promise.all([
        supabase.from('shared_document_links').select('*').order('created_at', { ascending: false }),
        supabase.from('case_documents').select('id, file_name, file_url, inquiry_id, contact_inquiries(name)').order('created_at', { ascending: false }).limit(100),
      ]);
      setSharedDocs(sharedRes.data || []);
      setDocuments(docsRes.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.documentId) return;
    setSaving(true);
    setNewLink(null);
    try {
      const supabase = createClient();
      const doc = documents.find(d => d.id === form.documentId);
      if (!doc) throw new Error('Document not found');

      const token = `sdl_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + form.expiryDays);

      const { error } = await supabase.from('shared_document_links').insert({
        document_id: form.documentId,
        file_name: doc.file_name,
        file_url: doc.file_url,
        share_token: token,
        expires_at: expiresAt.toISOString(),
        created_by: 'admin',
        access_count: 0,
        max_access: form.maxAccess ? Number(form.maxAccess) : null,
        is_active: true,
        recipient_email: form.recipientEmail || null,
        recipient_name: form.recipientName || null,
        inquiry_id: doc.inquiry_id,
      });
      if (error) throw error;

      const link = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/shared-doc/${token}`;
      setNewLink(link);
      setForm({ documentId: '', recipientName: '', recipientEmail: '', expiryDays: 7, maxAccess: '' });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this share link?')) return;
    const supabase = createClient();
    await supabase.from('shared_document_links').update({ is_active: false }).eq('id', id);
    fetchData();
  };

  const copyLink = (token: string, id: string) => {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/shared-doc/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const active = sharedDocs.filter(d => d.is_active && new Date(d.expires_at) > new Date());
  const expired = sharedDocs.filter(d => !d.is_active || new Date(d.expires_at) <= new Date());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Secure Document Sharing</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Share sensitive files with time-limited access links — no login required</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex items-center gap-2" style={{ background: '#355E3B', color: '#fff' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Share Link
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Links', value: active.length, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Total Accesses', value: sharedDocs.reduce((s, d) => s + (d.access_count || 0), 0), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Expired / Revoked', value: expired.length, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Active links */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Active Share Links ({active.length})</h3>
          {active.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">No active share links. Create one above.</div>
          ) : (
            active.map(doc => {
              const daysLeft = getDaysUntilExpiry(doc.expires_at);
              return (
                <div key={doc.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{doc.file_name}</p>
                      {doc.recipient_name && <p className="text-xs text-muted-foreground mt-0.5">For: {doc.recipient_name} {doc.recipient_email ? `(${doc.recipient_email})` : ''}</p>}
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${daysLeft <= 1 ? 'bg-red-100 text-red-700' : daysLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          Expires in {daysLeft}d
                        </span>
                        <span className="text-xs text-muted-foreground">{doc.access_count} access{doc.access_count !== 1 ? 'es' : ''}{doc.max_access ? ` / ${doc.max_access} max` : ''}</span>
                        <span className="text-xs text-muted-foreground">Created {fmtDate(doc.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copyLink(doc.share_token, doc.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copiedId === doc.id ? 'bg-emerald-100 text-emerald-700' : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                        {copiedId === doc.id ? '✓ Copied' : 'Copy Link'}
                      </button>
                      <button onClick={() => handleRevoke(doc.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-all">Revoke</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {expired.length > 0 && (
            <>
              <h3 className="font-semibold text-foreground mt-4">Expired / Revoked ({expired.length})</h3>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="divide-y divide-border">
                  {expired.slice(0, 10).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3 opacity-60">
                      <div>
                        <p className="text-sm text-foreground truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.recipient_name || 'No recipient'} · {doc.access_count} accesses</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{fmtDate(doc.expires_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl text-foreground">Create Share Link</h3>
              <button onClick={() => { setShowModal(false); setNewLink(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {newLink ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-sm font-semibold text-emerald-700 mb-2">✓ Share link created!</p>
                  <p className="text-xs font-mono text-emerald-800 break-all bg-emerald-100 p-2 rounded-lg">{newLink}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(newLink); }} className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all">Copy Link</button>
                <button onClick={() => setNewLink(null)} className="w-full py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>Create Another</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Document *</label>
                  <select value={form.documentId} onChange={e => setForm(p => ({ ...p, documentId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">— Select document —</option>
                    {documents.map(d => <option key={d.id} value={d.id}>{d.file_name} {d.contact_inquiries ? `(${(d.contact_inquiries as { name: string }).name})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Recipient Name</label>
                  <input value={form.recipientName} onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Recipient Email</label>
                  <input type="email" value={form.recipientEmail} onChange={e => setForm(p => ({ ...p, recipientEmail: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Expires In (days)</label>
                    <input type="number" min={1} max={90} value={form.expiryDays} onChange={e => setForm(p => ({ ...p, expiryDays: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Max Accesses</label>
                    <input type="number" min={1} value={form.maxAccess} onChange={e => setForm(p => ({ ...p, maxAccess: e.target.value }))} placeholder="Unlimited" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all">Cancel</button>
                  <button onClick={handleCreate} disabled={saving || !form.documentId} className="flex-1 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#355E3B', color: '#fff' }}>
                    {saving ? 'Creating…' : 'Create Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
