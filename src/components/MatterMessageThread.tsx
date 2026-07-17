'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatterMessage {
  id: string;
  inquiry_id: string;
  sender_role: 'client' | 'admin';
  sender_name: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_type?: string | null;
}

interface MatterMessageThreadProps {
  /** The matter / inquiry ID to scope the thread */
  matterId: string;
  /** Role of the current user sending messages */
  senderRole: 'client' | 'admin';
  /** Display name of the current sender (shown in bubbles) */
  senderName?: string;
  /** Compact mode — used when embedded inline in the overview tab */
  compact?: boolean;
  /** Optional matter/case name used in push notification titles */
  caseName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`;
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

// ── Date separator helper ─────────────────────────────────────────────────────

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isToday) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatterMessageThread({
  matterId,
  senderRole,
  senderName,
  compact = false,
  caseName,
}: MatterMessageThreadProps) {
  const [messages, setMessages] = useState<MatterMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, []);

  // ── Fetch initial messages ────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('portal_messages')
        .select('*')
        .eq('inquiry_id', matterId)
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      setMessages(data || []);
    } catch (err: unknown) {
      console.error('MatterMessageThread fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => {
    if (matterId) fetchMessages();
  }, [matterId, fetchMessages]);

  // ── Supabase real-time subscription ──────────────────────────────────────

  useEffect(() => {
    if (!matterId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`matter_messages_${matterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_messages',
          filter: `inquiry_id=eq.${matterId}`,
        },
        (payload) => {
          const newMsg = payload.new as MatterMessage;
          setMessages((prev) => {
            // Deduplicate by id
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Track unread if not from self and not at bottom
          if (newMsg.sender_role !== senderRole && !isAtBottomRef.current) {
            setNewMessageCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'portal_messages',
          filter: `inquiry_id=eq.${matterId}`,
        },
        (payload) => {
          const updated = payload.new as MatterMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [matterId, senderRole]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setNewMessageCount(0);
    isAtBottomRef.current = true;
  }, []);

  useEffect(() => {
    if (!loading) {
      scrollToBottom('instant');
    }
  }, [loading, scrollToBottom]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottomRef.current = atBottom;
    if (atBottom) setNewMessageCount(0);
  };

  // ── Mark messages as read ─────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length === 0) return;
    const unread = messages.filter(
      (m) => m.sender_role !== senderRole && !m.read_at
    );
    if (unread.length === 0) return;

    const markRead = async () => {
      try {
        const supabase = createClient();
        await supabase
          .from('portal_messages')
          .update({ read_at: new Date().toISOString() })
          .in(
            'id',
            unread.map((m) => m.id)
          );
      } catch {
        // silent — non-critical
      }
    };
    markRead();
  }, [messages, senderRole]);

  // ── File handling ─────────────────────────────────────────────────────────

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

  // ── Send message ──────────────────────────────────────────────────────────

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

      if (selectedFile) {
        setUploading(true);
        const ext = selectedFile.name.split('.').pop();
        const storagePath = `case-messages/${matterId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
        inquiry_id: matterId,
        sender_role: senderRole,
        sender_name: senderName ?? null,
        body: body.trim() || (attachmentName ? `Shared a file: ${attachmentName}` : ''),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        attachment_type: attachmentType,
        thread_type: 'matter',
      });
      if (msgErr) throw msgErr;

      // Fire push notification to the opposite party (non-blocking)
      fetch('/api/push/send-message-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          senderRole,
          senderName: senderName ?? null,
          messageBody: body.trim() || (attachmentName ? `Shared a file: ${attachmentName}` : ''),
          caseName: caseName ?? null,
        }),
      }).catch(() => {/* non-critical */});

      setBody('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Real-time will push the new message; scroll to bottom
      const scrollTimer = setTimeout(() => scrollToBottom('smooth'), 100);
      // Store on ref so it can be cleared if component unmounts before it fires
      scrollTimerRef.current = scrollTimer;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const isSelf = (role: 'client' | 'admin') => role === senderRole;

  // ── Date separators ───────────────────────────────────────────────────────

  const renderMessages = () => {
    const items: React.ReactNode[] = [];
    let lastDateLabel = '';

    messages.forEach((msg) => {
      const dateLabel = getDateLabel(msg.created_at);
      if (dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel;
        items.push(
          <div key={`sep-${msg.id}`} className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap px-2">
              {dateLabel}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        );
      }

      const self = isSelf(msg.sender_role);
      const initials = msg.sender_name
        ? msg.sender_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        : msg.sender_role === 'admin' ? 'A' : 'C';

      items.push(
        <div key={msg.id} className={`flex gap-2.5 ${self ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
              self ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
            }`}
          >
            {initials}
          </div>

          {/* Bubble group */}
          <div className={`max-w-[72%] flex flex-col gap-1 ${self ? 'items-end' : 'items-start'}`}>
            {/* Sender label */}
            <p className="text-[10px] text-muted-foreground px-1">
              {msg.sender_name ?? (msg.sender_role === 'admin' ? 'Staff' : 'Client')}
            </p>

            {/* Text body */}
            {msg.body && (
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  self
                    ? 'text-white rounded-tr-sm' :'bg-secondary/60 text-foreground rounded-tl-sm'
                }`}
                style={self ? { background: '#355E3B' } : {}}
              >
                {msg.body}
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
              {formatTime(msg.created_at)}
              {self && msg.read_at && (
                <span className="ml-2 text-emerald-600">✓ Read</span>
              )}
            </p>
          </div>
        </div>
      );
    });

    return items;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const containerHeight = compact ? '380px' : '520px';
  const messagesHeight = compact ? '260px' : '380px';

  return (
    <div
      className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col"
      style={{ minHeight: containerHeight }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {senderRole === 'admin' ? 'Client Thread' : 'Message Your Attorney'}
          </h3>
          {/* Live indicator */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isLive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`}
            />
            {isLive ? 'Live' : 'Connecting…'}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Messages list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        style={{ maxHeight: messagesHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">Loading messages…</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70">
              {senderRole === 'admin' ?'Send the first message to your client below' :'Send a message to your attorney below'}
            </p>
          </div>
        ) : (
          renderMessages()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {newMessageCount > 0 && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => scrollToBottom('smooth')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-md transition-all"
            style={{ background: '#355E3B' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {newMessageCount} new message{newMessageCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

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
            placeholder={
              selectedFile
                ? 'Add a message (optional)…'
                : senderRole === 'admin' ?'Type a message to the client… (Enter to send)' :'Type a message to your attorney… (Enter to send)'
            }
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
            {sending || uploading ? (
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
          Messages are end-to-end secured · Attach PDF, Word, Excel, images, or text up to 10 MB
        </p>
      </div>
    </div>
  );
}
