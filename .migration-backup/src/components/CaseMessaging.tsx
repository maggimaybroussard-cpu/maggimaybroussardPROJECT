'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseMessage {
  id: string;
  sender_role: 'client' | 'admin';
  body: string;
  read_at: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_type?: string | null;
}

interface CaseMessagingProps {
  caseId: string;
  messages: CaseMessage[];
  senderRole: 'client' | 'admin';
  onMessageSent: () => void;
  /** Label shown in the avatar bubble for the "other" party */
  otherPartyLabel?: string;
  /** Label shown in the avatar bubble for the current sender */
  selfLabel?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string | null | undefined) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📕';
  if (type.includes('word')) return '📝';
  if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
  return '📎';
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Component ─────────────────────────────────────────────────────────────────

export default function CaseMessaging({
  caseId,
  messages,
  senderRole,
  onMessageSent,
  otherPartyLabel = senderRole === 'client' ? 'P' : 'C',
  selfLabel = senderRole === 'client' ? 'C' : 'A',
}: CaseMessagingProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) { setSelectedFile(null); return; }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('File type not allowed. Accepted: PDF, Word, Excel, images, text.');
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 10 MB limit.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !selectedFile) return;
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;
      let attachmentType: string | null = null;

      // Upload file if present
      if (selectedFile) {
        setUploading(true);
        const ext = selectedFile.name.split('.').pop();
        const storagePath = `case-messages/${caseId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('case-documents')
          .upload(storagePath, selectedFile, { contentType: selectedFile.type, upsert: false });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        const { data: urlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(storagePath);

        attachmentUrl = urlData?.publicUrl ?? null;
        attachmentName = selectedFile.name;
        attachmentSize = selectedFile.size;
        attachmentType = selectedFile.type;
        setUploading(false);
      }

      const { error: msgErr } = await supabase.from('portal_messages').insert({
        inquiry_id: caseId,
        sender_role: senderRole,
        body: body.trim() || (attachmentName ? `Shared a file: ${attachmentName}` : ''),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        attachment_type: attachmentType,
      });
      if (msgErr) throw msgErr;

      setBody('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onMessageSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const isSelf = (role: 'client' | 'admin') => role === senderRole;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {senderRole === 'admin' ? 'Client Messages' : 'Messages'}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: '420px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70">Send a message or attach a file below</p>
          </div>
        ) : (
          messages.map((msg) => {
            const self = isSelf(msg.sender_role);
            return (
              <div key={msg.id} className={`flex gap-3 ${self ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  self ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
                }`}>
                  {self ? selfLabel : otherPartyLabel}
                </div>

                {/* Bubble */}
                <div className={`max-w-[72%] flex flex-col gap-1.5 ${self ? 'items-end' : 'items-start'}`}>
                  {/* Text body */}
                  {msg.body && (
                    <div className={`px-4 py-3 rounded-2xl text-sm ${
                      self
                        ? 'text-white rounded-tr-sm' :'bg-secondary/60 text-foreground rounded-tl-sm'
                    }`} style={self ? { background: '#355E3B' } : {}}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  )}

                  {/* Attachment */}
                  {msg.attachment_url && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${
                        self
                          ? 'border-foreground/20 bg-foreground/5 text-foreground hover:bg-foreground/10'
                          : 'border-border bg-background text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      <span className="text-base leading-none">{getFileIcon(msg.attachment_type)}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[180px]">{msg.attachment_name ?? 'Attachment'}</p>
                        {msg.attachment_size && (
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(msg.attachment_size)}</p>
                        )}
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  )}

                  {/* Timestamp + read receipt */}
                  <p className="text-[10px] text-muted-foreground px-1">
                    {formatDate(msg.created_at)}
                    {self && msg.read_at && (
                      <span className="ml-2 text-emerald-600">✓ Read</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose area */}
      <div className="border-t border-border p-4 space-y-3">
        {/* File preview */}
        {selectedFile && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-secondary/30">
            <span className="text-base leading-none">{getFileIcon(selectedFile.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/20 transition-colors shrink-0"
              aria-label="Remove file"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {fileError && <p className="text-xs text-red-600">{fileError}</p>}

        <form onSubmit={handleSend} className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Attach file"
          />

          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            title="Attach file (PDF, Word, Excel, images, text — max 10 MB)"
            className="flex-shrink-0 w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-secondary/60 transition-all disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (body.trim() || selectedFile) handleSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder={selectedFile ? 'Add a message (optional)…' : 'Type a message… (Enter to send, Shift+Enter for new line)'}
            rows={2}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={sending || uploading || (!body.trim() && !selectedFile)}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: '#355E3B' }}
          >
            {(sending || uploading) ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="hidden sm:inline">{uploading ? 'Uploading…' : 'Sending…'}</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[10px] text-muted-foreground">
          Attach PDF, Word, Excel, images, or text files up to 10 MB
        </p>
      </div>
    </div>
  );
}
