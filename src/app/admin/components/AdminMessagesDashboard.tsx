'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  inquiry_id: string | null;
  sender_id: string;
  sender_role: 'client' | 'admin';
  body: string;
  read_at: string | null;
  reply_to_id: string | null;
  created_at: string;
  reply_to?: Message | null;
}

interface Thread {
  inquiry_id: string;
  client_name: string;
  client_email: string;
  service: string;
  case_status: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  messages: Message[];
}

interface DocumentRequest {
  id: string;
  inquiry_id: string;
  client_id: string;
  document_type: string;
  description: string | null;
  status: 'pending' | 'in_review' | 'fulfilled' | 'declined';
  admin_notes: string | null;
  created_at: string;
  client_name?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminMessagesDashboard() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'doc_requests'>('messages');
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [docRequestsLoading, setDocRequestsLoading] = useState(false);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [docAdminNotes, setDocAdminNotes] = useState<Record<string, string>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch all threads ────────────────────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    const supabase = createClient();

    // Get all messages
    const { data: allMessages } = await supabase
      .from('portal_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!allMessages || allMessages.length === 0) {
      // Still try to get cases with portal access
      const { data: accessRows } = await supabase
        .from('client_portal_access')
        .select('inquiry_id, user_id');

      if (!accessRows || accessRows.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const inquiryIds = accessRows.map((r: { inquiry_id: string }) => r.inquiry_id).filter(Boolean);
      const { data: cases } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .in('id', inquiryIds);

      const emptyThreads: Thread[] = (cases || []).map((c: { id: string; name: string; email: string; service: string; status: string }) => ({
        inquiry_id: c.id,
        client_name: c.name,
        client_email: c.email,
        service: c.service,
        case_status: c.status,
        last_message: 'No messages yet',
        last_message_at: '',
        unread_count: 0,
        messages: [],
      }));

      setThreads(emptyThreads);
      setLoading(false);
      return;
    }

    // Group by inquiry_id
    const byInquiry: Record<string, Message[]> = {};
    (allMessages as Message[]).forEach((m) => {
      const iid = m.inquiry_id ?? 'no_case';
      if (!byInquiry[iid]) byInquiry[iid] = [];
      byInquiry[iid].push(m);
    });

    // Fetch case info for all inquiry_ids
    const inquiryIds = Object.keys(byInquiry).filter((id) => id !== 'no_case');
    const { data: cases } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service, status')
      .in('id', inquiryIds);

    const caseMap: Record<string, { name: string; email: string; service: string; status: string }> = {};
    (cases || []).forEach((c: { id: string; name: string; email: string; service: string; status: string }) => {
      caseMap[c.id] = c;
    });

    const builtThreads: Thread[] = Object.entries(byInquiry).map(([iid, msgs]) => {
      const caseData = caseMap[iid];
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const last = sorted[sorted.length - 1];
      const unread = sorted.filter((m) => m.sender_role === 'client' && !m.read_at).length;

      // Attach reply_to references
      const msgsWithReplies = sorted.map((m) => ({
        ...m,
        reply_to: m.reply_to_id ? sorted.find((x) => x.id === m.reply_to_id) ?? null : null,
      }));

      return {
        inquiry_id: iid,
        client_name: caseData?.name ?? 'Unknown Client',
        client_email: caseData?.email ?? '',
        service: caseData?.service ?? '',
        case_status: caseData?.status ?? '',
        last_message: last?.body ?? '',
        last_message_at: last?.created_at ?? '',
        unread_count: unread,
        messages: msgsWithReplies,
      };
    });

    // Sort threads: unread first, then by last message time
    builtThreads.sort((a, b) => {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setThreads(builtThreads);

    // Update selected thread if open
    if (selectedThread) {
      const updated = builtThreads.find((t) => t.inquiry_id === selectedThread.inquiry_id);
      if (updated) setSelectedThread(updated);
    }

    setLoading(false);
  }, [selectedThread]);

  useEffect(() => {
    fetchThreads();
  }, []);

  // ── Fetch document requests ──────────────────────────────────────────────────
  const fetchDocRequests = useCallback(async () => {
    setDocRequestsLoading(true);
    const supabase = createClient();
    const { data: reqs } = await supabase
      .from('client_document_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reqs || reqs.length === 0) {
      setDocRequests([]);
      setDocRequestsLoading(false);
      return;
    }

    const inquiryIds = [...new Set(reqs.map((r: DocumentRequest) => r.inquiry_id))];
    const { data: cases } = await supabase
      .from('contact_inquiries')
      .select('id, name')
      .in('id', inquiryIds);

    const caseMap: Record<string, string> = {};
    (cases ?? []).forEach((c: { id: string; name: string }) => { caseMap[c.id] = c.name; });

    setDocRequests(reqs.map((r: DocumentRequest) => ({ ...r, client_name: caseMap[r.inquiry_id] ?? 'Unknown' })));
    setDocRequestsLoading(false);
  }, []);

  useEffect(() => { fetchDocRequests(); }, [fetchDocRequests]);

  const handleDocStatusUpdate = async (reqId: string, newStatus: DocumentRequest['status']) => {
    setUpdatingDocId(reqId);
    const supabase = createClient();
    const notes = docAdminNotes[reqId] ?? null;
    await supabase
      .from('client_document_requests')
      .update({
        status: newStatus,
        admin_notes: notes || null,
        fulfilled_at: newStatus === 'fulfilled' ? new Date().toISOString() : null,
      })
      .eq('id', reqId);
    setUpdatingDocId(null);
    fetchDocRequests();
  };

  // ── Scroll to bottom ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages]);

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages' }, () => {
        fetchThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchThreads]);

  // ── Select thread + mark client messages as read ─────────────────────────────
  const handleSelectThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setReplyTo(null);
    setBody('');

    // Mark client messages as read
    const unreadIds = thread.messages
      .filter((m) => m.sender_role === 'client' && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const supabase = createClient();
      await supabase
        .from('portal_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
      fetchThreads();
    }
  };

  // ── Send reply ───────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!body.trim() || !selectedThread) return;
    setSending(true);
    setError(null);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated.'); setSending(false); return; }

    const { error: insertErr } = await supabase.from('portal_messages').insert({
      inquiry_id: selectedThread.inquiry_id,
      sender_id: user.id,
      sender_role: 'admin',
      body: body.trim(),
      reply_to_id: replyTo?.id ?? null,
    });

    if (insertErr) {
      setError('Failed to send message. Please try again.');
    } else {
      // ── Notify client by email ─────────────────────────────────────────────
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
      fetch('/api/notifications/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: selectedThread.client_name,
          recipientEmail: selectedThread.client_email,
          senderName: 'Maggi May Broussard',
          senderRole: 'admin',
          messageBody: body.trim(),
          caseName: selectedThread.service,
          portalUrl: `${siteUrl}/portal/messages`,
        }),
      }).catch(() => { /* fire-and-forget */ });

      setBody('');
      setReplyTo(null);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Filter threads ───────────────────────────────────────────────────────────
  const filteredThreads = threads.filter((t) =>
    !search ||
    t.client_name.toLowerCase().includes(search.toLowerCase()) ||
    t.client_email.toLowerCase().includes(search.toLowerCase()) ||
    t.service.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  // ── Group messages by date ───────────────────────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  (selectedThread?.messages || []).forEach((m) => {
    const d = new Date(m.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === d) last.msgs.push(m);
    else groupedMessages.push({ date: d, msgs: [m] });
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Threads</p>
          <p className="text-3xl font-semibold text-foreground">{threads.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Unread Messages</p>
          <p className="text-3xl font-semibold text-foreground">{totalUnread}</p>
          {totalUnread > 0 && <p className="text-xs text-amber-600 mt-1">Needs attention</p>}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Doc Requests</p>
          <p className="text-3xl font-semibold text-foreground">{docRequests.filter((r) => r.status === 'pending').length}</p>
          {docRequests.filter((r) => r.status === 'pending').length > 0 && <p className="text-xs text-amber-600 mt-1">Pending review</p>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'messages' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Messages
          {totalUnread > 0 && (
            <span className="w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">{totalUnread}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('doc_requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'doc_requests' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" />
          </svg>
          Document Requests
          {docRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{docRequests.filter((r) => r.status === 'pending').length}</span>
          )}
        </button>
      </div>

      {/* Document Requests Panel */}
      {activeTab === 'doc_requests' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client Document Requests</h3>
            <span className="text-[11px] text-muted-foreground">{docRequests.length} total</span>
          </div>
          {docRequestsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : docRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No document requests yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {docRequests.map((req) => {
                const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
                  pending: { label: 'Pending', color: '#C8965A', bg: 'rgba(200,150,90,0.08)' },
                  in_review: { label: 'In Review', color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
                  fulfilled: { label: 'Fulfilled', color: '#355E3B', bg: 'rgba(53,94,59,0.08)' },
                  declined: { label: 'Declined', color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
                };
                const sc = statusCfg[req.status] ?? statusCfg.pending;
                return (
                  <div key={req.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">{req.document_type}</p>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: sc.bg, color: sc.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                            {sc.label}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {req.client_name} · {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{req.description}</p>
                        )}
                      </div>
                    </div>
                    {req.status !== 'fulfilled' && req.status !== 'declined' && (
                      <div className="space-y-2">
                        <textarea
                          value={docAdminNotes[req.id] ?? req.admin_notes ?? ''}
                          onChange={(e) => setDocAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          placeholder="Add a note for the client (optional)…"
                          rows={2}
                          className="w-full resize-none text-xs bg-secondary/40 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDocStatusUpdate(req.id, 'in_review')}
                            disabled={updatingDocId === req.id || req.status === 'in_review'}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-40"
                          >
                            Mark In Review
                          </button>
                          <button
                            onClick={() => handleDocStatusUpdate(req.id, 'fulfilled')}
                            disabled={updatingDocId === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-80"
                            style={{ background: '#355E3B' }}
                          >
                            {updatingDocId === req.id ? 'Updating…' : 'Mark Fulfilled'}
                          </button>
                          <button
                            onClick={() => handleDocStatusUpdate(req.id, 'declined')}
                            disabled={updatingDocId === req.id}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                    {(req.status === 'fulfilled' || req.status === 'declined') && req.admin_notes && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border">
                        <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Admin note:</p>
                        <p className="text-xs text-foreground">{req.admin_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main panel */}
      {activeTab === 'messages' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex" style={{ minHeight: '600px' }}>
        {/* Thread list */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-8 pr-3 py-2 bg-secondary/40 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              />
            </div>
          </div>

          {/* Thread items */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {!loading && filteredThreads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-sm text-muted-foreground">No message threads yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clients will appear here once they send a message.</p>
              </div>
            )}
            {filteredThreads.map((thread) => (
              <button
                key={thread.inquiry_id}
                onClick={() => handleSelectThread(thread)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/50 transition-colors hover:bg-secondary/30 ${
                  selectedThread?.inquiry_id === thread.inquiry_id ? 'bg-secondary/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-primary">
                        {thread.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">{thread.client_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {thread.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold">
                        {thread.unread_count}
                      </span>
                    )}
                    {thread.last_message_at && (
                      <span className="text-[10px] text-muted-foreground">{formatTime(thread.last_message_at)}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-1.5">{thread.service}</p>
                <p className="text-xs text-muted-foreground/70 truncate">{thread.last_message || 'No messages yet'}</p>
                {thread.case_status && (
                  <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[thread.case_status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {thread.case_status.replace(/_/g, ' ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Message view */}
        <div className="flex-1 flex flex-col">
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">Select a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a client thread from the left to view and reply to their messages.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {selectedThread.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedThread.client_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedThread.client_email} · {selectedThread.service}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[selectedThread.case_status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {selectedThread.case_status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1" style={{ maxHeight: '420px' }}>
                {selectedThread.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send the first message to this client.</p>
                  </div>
                )}

                {groupedMessages.map(({ date, msgs }) => (
                  <div key={date} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2">
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {msgs.map((msg) => {
                      const isAdmin = msg.sender_role === 'admin';
                      return (
                        <div key={msg.id} className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                          {msg.reply_to && (
                            <div className={`max-w-xs px-3 py-2 rounded-xl border text-xs text-muted-foreground bg-secondary/40 border-border ${isAdmin ? 'mr-1' : 'ml-1'}`}>
                              <p className="font-semibold mb-0.5 text-[10px] uppercase tracking-widest">
                                Replying to {msg.reply_to.sender_role === 'client' ? selectedThread.client_name : 'yourself'}
                              </p>
                              <p className="truncate">{msg.reply_to.body}</p>
                            </div>
                          )}

                          <div
                            className={`group relative max-w-sm lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              isAdmin
                                ? 'text-white rounded-br-sm' :'bg-secondary/50 text-foreground border border-border rounded-bl-sm'
                            }`}
                            style={isAdmin ? { background: '#355E3B' } : {}}
                          >
                            {msg.body}
                            <button
                              onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                              className={`absolute top-2 ${isAdmin ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} opacity-0 group-hover:opacity-100 transition-opacity`}
                              title="Reply"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground hover:text-foreground">
                                <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                              </svg>
                            </button>
                          </div>

                          <div className={`flex items-center gap-1.5 px-1 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] text-muted-foreground" title={formatFullDate(msg.created_at)}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isAdmin && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                {msg.read_at ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary -ml-1.5">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span className="text-primary">Read</span>
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Delivered</span>
                                  </>
                                )}
                              </span>
                            )}
                            {!isAdmin && (
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {selectedThread.client_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Compose */}
              <div className="border-t border-border bg-background px-4 py-3">
                {replyTo && (
                  <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                      <span className="font-semibold">
                        Replying to {replyTo.sender_role === 'client' ? selectedThread.client_name : 'yourself'}:
                      </span>
                      <span className="truncate">{replyTo.body}</span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="flex-shrink-0 hover:text-foreground transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}

                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Reply to ${selectedThread.client_name}… (Enter to send)`}
                    rows={2}
                    className="flex-1 resize-none bg-secondary/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !body.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ background: '#355E3B' }}
                    title="Send reply"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-1">
                  Client will receive a notification when you reply.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
