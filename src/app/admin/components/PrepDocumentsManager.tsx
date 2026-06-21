'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PrepDocument {
  id: string;
  booking_id: string | null;
  inquiry_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  public_url: string | null;
  description: string | null;
  created_at: string;
}

interface PrepDocumentsManagerProps {
  bookingId?: string | null;
  inquiryId?: string | null;
  clientEmail?: string;
  clientName?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null): React.ReactNode {
  if (!mimeType) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (mimeType.includes('pdf')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (mimeType.includes('word') || mimeType.includes('document')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (mimeType.includes('image')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export default function PrepDocumentsManager({
  bookingId,
  inquiryId,
  clientEmail,
  clientName,
}: PrepDocumentsManagerProps) {
  const [docs, setDocs] = useState<PrepDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const query = supabase
        .from('consultation_prep_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingId) {
        query.eq('booking_id', bookingId);
      } else if (inquiryId) {
        query.eq('inquiry_id', inquiryId);
      } else {
        setDocs([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocs((data as PrepDocument[]) ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId, inquiryId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(null);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const ext = file.name.split('.').pop() ?? 'bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `consultation-prep/${bookingId ?? inquiryId ?? 'general'}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl ?? null;

      const { error: dbError } = await supabase
        .from('consultation_prep_documents')
        .insert({
          booking_id: bookingId ?? null,
          inquiry_id: inquiryId ?? null,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || null,
          public_url: publicUrl,
          description: description.trim() || null,
          uploaded_by: 'admin',
        });

      if (dbError) throw dbError;

      setUploadMsg({ type: 'success', text: `"${file.name}" uploaded successfully.` });
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocs();
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: PrepDocument) => {
    setDeletingId(doc.id);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      await supabase.storage.from('case-documents').remove([doc.file_path]);

      const { error } = await supabase
        .from('consultation_prep_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendDocsEmail = async () => {
    if (!clientEmail || docs.length === 0) return;
    setSendingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch('/api/admin/consultations/send-prep-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          clientName: clientName ?? 'Client',
          bookingId: bookingId ?? null,
          inquiryId: inquiryId ?? null,
          documents: docs.map((d) => ({
            fileName: d.file_name,
            publicUrl: d.public_url,
            description: d.description,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setEmailMsg({ type: 'success', text: `Prep documents sent to ${clientEmail}` });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send email' });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="pt-2 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prep Documents</p>
          {docs.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {docs.length}
            </span>
          )}
        </div>
        {docs.length > 0 && clientEmail && (
          <button
            onClick={handleSendDocsEmail}
            disabled={sendingEmail}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border text-foreground hover:border-accent/50 hover:bg-secondary/40 transition-all disabled:opacity-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            {sendingEmail ? 'Sending…' : 'Email to Client'}
          </button>
        )}
      </div>

      {/* Email feedback */}
      {emailMsg && (
        <div className={`mb-2 p-2.5 rounded-xl text-xs font-medium ${emailMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {emailMsg.text}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-2 mb-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-3">No prep documents attached yet. Upload files below to include them in the client&apos;s confirmation email.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:border-accent/30 transition-all group">
              <span className="shrink-0 text-muted-foreground">{getFileIcon(doc.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.description && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{doc.description}</span>
                  )}
                  {doc.file_size && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(doc.file_size)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {doc.public_url && (
                  <a
                    href={doc.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-accent hover:border-accent/50 transition-all"
                    title="View file"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="w-6 h-6 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-red-500 hover:border-red-300 transition-all disabled:opacity-50"
                  title="Remove document"
                >
                  {deletingId === doc.id ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload feedback */}
      {uploadMsg && (
        <div className={`mb-2 p-2.5 rounded-xl text-xs font-medium ${uploadMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {uploadMsg.text}
        </div>
      )}

      {/* Upload area */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Optional description (e.g. Intake checklist)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        />
        <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-xs font-medium ${uploading ? 'border-accent/30 text-muted-foreground cursor-not-allowed' : 'border-border text-muted-foreground hover:border-accent/50 hover:text-foreground hover:bg-secondary/20'}`}>
          {uploading ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload prep document
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
            onChange={handleUpload}
          />
        </label>
        <p className="text-[10px] text-muted-foreground text-center">PDF, Word, Excel, images · max 10 MB</p>
      </div>
    </div>
  );
}
