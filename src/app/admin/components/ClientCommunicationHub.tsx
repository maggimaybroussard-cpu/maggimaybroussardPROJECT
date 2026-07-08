'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientThread {
  id: string;
  client_name: string;
  client_email: string;
  matter_type: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: 'active' | 'resolved' | 'pending';
  inquiry_id: string | null;
}

interface Message {
  id: string;
  thread_id: string;
  sender: 'attorney' | 'client';
  sender_name: string;
  content: string;
  sent_at: string;
  read_at: string | null;
  message_type: 'text' | 'email' | 'sms' | 'note';
}

interface BroadcastForm {
  subject: string;
  body: string;
  channel: 'email' | 'sms' | 'both';
  audience: 'all' | 'active_cases' | 'retainer_clients';
}

interface QuickReply {
  id: string;
  label: string;
  content: string;
  category: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { id: '1', label: 'Received & Reviewing', category: 'General', content: 'Thank you for reaching out. I have received your message and will review it shortly. I will follow up with you within 1-2 business days.' },
  { id: '2', label: 'Documents Received', category: 'Documents', content: 'I have received the documents you submitted. I will review them and provide my analysis. Please allow 3-5 business days for a thorough review.' },
  { id: '3', label: 'Schedule Consultation', category: 'Scheduling', content: 'I would like to schedule a consultation to discuss your matter in detail. Please visit our booking page at https://broussardlegalservices.com/book-consultation to select a time that works for you.' },
  { id: '4', label: 'Additional Info Needed', category: 'General', content: 'To properly advise you on this matter, I need some additional information. Could you please provide the following details at your earliest convenience?' },
  { id: '5', label: 'Case Update', category: 'Case Status', content: 'I wanted to provide you with an update on your matter. We are currently in the process of reviewing all relevant documents and will have a more detailed update for you soon.' },
  { id: '6', label: 'Invoice Reminder', category: 'Billing', content: 'This is a friendly reminder that an invoice is due for your account. Please log in to your client portal to view and pay your outstanding balance. If you have any questions, please do not hesitate to reach out.' },
  { id: '7', label: 'Retainer Renewal', category: 'Billing', content: 'Your retainer agreement is approaching its renewal date. I would like to discuss continuing our representation and the terms for the upcoming period. Please let me know your availability for a brief call.' },
  { id: '8', label: 'Matter Closed', category: 'Case Status', content: 'I am pleased to inform you that your matter has been successfully resolved. It has been a pleasure representing you. Please do not hesitate to contact us if you need legal assistance in the future.' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  resolved: 'bg-slate-50 text-slate-600 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const CHANNEL_ICONS: Record<string, string> = {
  email: '📧',
  sms: '💬',
  note: '📝',
  text: '💬',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClientCommunicationHub() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'threads' | 'broadcast' | 'templates' | 'log'>('threads');
  const [threads, setThreads] = useState<ClientThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ClientThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'email' | 'sms' | 'note'>('email');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'resolved'>('all');
  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>({ subject: '', body: '', channel: 'email', audience: 'all' });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [selectedQuickReply, setSelectedQuickReply] = useState<string>('');
  const [commLogs, setCommLogs] = useState<Array<{ id: string; client: string; type: string; subject: string; sent_at: string; status: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads from contact_inquiries
  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status, message, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const mapped: ClientThread[] = (data || []).map(row => ({
        id: row.id,
        client_name: row.name || 'Unknown Client',
        client_email: row.email || '',
        matter_type: row.service || null,
        last_message: row.message ? row.message.slice(0, 80) + (row.message.length > 80 ? '…' : '') : null,
        last_message_at: row.updated_at || row.created_at,
        unread_count: 0,
        status: (row.status === 'resolved' ? 'resolved' : row.status === 'pending' ? 'pending' : 'active') as ClientThread['status'],
        inquiry_id: row.id,
      }));
      setThreads(mapped);
    } catch {
      toast.error('Failed to load communication threads');
    } finally {
      setLoadingThreads(false);
    }
  }, [supabase]);

  // Load messages for a thread from portal_messages
  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('portal_messages')
        .select('id, inquiry_id, sender_role, sender_name, content, created_at, read_at, message_type')
        .eq('inquiry_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mapped: Message[] = (data || []).map(row => ({
        id: row.id,
        thread_id: row.inquiry_id,
        sender: row.sender_role === 'attorney' ? 'attorney' : 'client',
        sender_name: row.sender_name || (row.sender_role === 'attorney' ? 'Maggi May Broussard, Esq.' : 'Client'),
        content: row.content || '',
        sent_at: row.created_at,
        read_at: row.read_at,
        message_type: row.message_type || 'text',
      }));
      setMessages(mapped);
    } catch {
      // If portal_messages doesn't have these columns, show empty
      setMessages([]);
    }
  }, [supabase]);

  // Load communication logs
  const loadCommLogs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('invoice_email_logs')
        .select('id, client_email, email_type, subject, sent_at, status')
        .order('sent_at', { ascending: false })
        .limit(30);
      const mapped = (data || []).map(row => ({
        id: row.id,
        client: row.client_email || '',
        type: row.email_type || 'email',
        subject: row.subject || '(no subject)',
        sent_at: row.sent_at,
        status: row.status || 'sent',
      }));
      setCommLogs(mapped);
    } catch {
      setCommLogs([]);
    }
  }, [supabase]);

  useEffect(() => { loadThreads(); loadCommLogs(); }, [loadThreads, loadCommLogs]);

  useEffect(() => {
    if (selectedThread) loadMessages(selectedThread.id);
  }, [selectedThread, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    setSending(true);
    try {
      const { error } = await supabase.from('portal_messages').insert({
        inquiry_id: selectedThread.id,
        sender_role: 'attorney',
        sender_name: 'Maggi May Broussard, Esq.',
        content: newMessage.trim(),
        message_type: messageType,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNewMessage('');
      setSelectedQuickReply('');
      await loadMessages(selectedThread.id);
      toast.success('Message sent!');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastForm.subject.trim() || !broadcastForm.body.trim()) {
      toast.error('Please fill in subject and message body');
      return;
    }
    setBroadcasting(true);
    try {
      // Send via admin email API
      const res = await fetch('/api/admin/send-automated-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: broadcastForm.subject,
          body: broadcastForm.body,
          audience: broadcastForm.audience,
          channel: broadcastForm.channel,
          type: 'broadcast',
        }),
      });
      if (!res.ok) throw new Error('Broadcast failed');
      setBroadcastSent(true);
      toast.success('Broadcast sent successfully!');
      setTimeout(() => {
        setBroadcastSent(false);
        setBroadcastForm({ subject: '', body: '', channel: 'email', audience: 'all' });
      }, 3000);
    } catch {
      toast.error('Failed to send broadcast. Check API configuration.');
    } finally {
      setBroadcasting(false);
    }
  };

  const applyQuickReply = (reply: QuickReply) => {
    setNewMessage(reply.content);
    setSelectedQuickReply(reply.id);
  };

  const filteredThreads = threads.filter(t => {
    const matchesSearch = !searchQuery || t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || t.client_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,55,40,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A3728" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl text-foreground">Client Communication Hub</h2>
            <p className="text-xs text-muted-foreground">Centralized messaging, broadcasts & communication logs</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {threads.filter(t => t.status === 'active').length} Active Threads
          </span>
        </div>
        <div className="flex gap-2">
          {(['threads', 'broadcast', 'templates', 'log'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${activeTab === tab ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {tab === 'threads' ? '💬 Threads' : tab === 'broadcast' ? '📢 Broadcast' : tab === 'templates' ? '⚡ Quick Replies' : '📋 Log'}
            </button>
          ))}
        </div>
      </div>

      {/* ── THREADS TAB ── */}
      {activeTab === 'threads' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4" style={{ minHeight: '600px' }}>
          {/* Thread List */}
          <div className="xl:col-span-2 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border space-y-3">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients…"
                className="w-full px-3 py-2 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40" />
              <div className="flex gap-1.5">
                {(['all', 'active', 'pending', 'resolved'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {loadingThreads ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#4A3728' }} />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No threads found</div>
              ) : (
                filteredThreads.map(thread => (
                  <button key={thread.id} onClick={() => setSelectedThread(thread)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-secondary/40 transition-all ${selectedThread?.id === thread.id ? 'bg-secondary/60' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ background: '#4A3728' }}>
                          {thread.client_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{thread.client_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{thread.client_email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[thread.status]}`}>
                          {thread.status}
                        </span>
                        {thread.last_message_at && (
                          <span className="text-[10px] text-muted-foreground">{timeAgo(thread.last_message_at)}</span>
                        )}
                      </div>
                    </div>
                    {thread.matter_type && <p className="text-xs text-muted-foreground ml-10 mb-1">{thread.matter_type}</p>}
                    {thread.last_message && <p className="text-xs text-muted-foreground/70 ml-10 truncate">{thread.last_message}</p>}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Thread */}
          <div className="xl:col-span-3 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center p-12 text-center">
                <div>
                  <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Select a client thread</p>
                  <p className="text-xs text-muted-foreground">Choose a conversation from the left to view messages and reply</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#4A3728' }}>
                      {selectedThread.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedThread.client_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedThread.client_email} {selectedThread.matter_type ? `· ${selectedThread.matter_type}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`mailto:${selectedThread.client_email}`}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/80 transition-all">
                      📧 Email
                    </a>
                    <select value={selectedThread.status}
                      onChange={async e => {
                        const newStatus = e.target.value;
                        await supabase.from('contact_inquiries').update({ status: newStatus }).eq('id', selectedThread.id);
                        setSelectedThread(prev => prev ? { ...prev, status: newStatus as ClientThread['status'] } : null);
                        setThreads(prev => prev.map(t => t.id === selectedThread.id ? { ...t, status: newStatus as ClientThread['status'] } : t));
                        toast.success('Status updated');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border bg-input text-xs font-semibold text-foreground focus:outline-none">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: '300px', maxHeight: '400px' }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No messages yet. Send the first message below.</p>
                      {selectedThread.last_message && (
                        <div className="mt-4 p-4 bg-secondary/40 rounded-xl text-left">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Original Inquiry</p>
                          <p className="text-sm text-foreground">{selectedThread.last_message}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'attorney' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.sender === 'attorney' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                          style={{ background: msg.sender === 'attorney' ? '#4A3728' : '#F0EDE8', color: msg.sender === 'attorney' ? '#fff' : '#2C1F14' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold opacity-70">{msg.sender_name}</span>
                            <span className="text-[10px] opacity-50">{CHANNEL_ICONS[msg.message_type]}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className="text-[10px] opacity-50 mt-1 text-right">{timeAgo(msg.sent_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                <div className="px-4 py-2 border-t border-border bg-secondary/20">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {QUICK_REPLIES.slice(0, 5).map(qr => (
                      <button key={qr.id} onClick={() => applyQuickReply(qr)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${selectedQuickReply === qr.id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-border bg-white text-muted-foreground hover:text-foreground'}`}>
                        ⚡ {qr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compose */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2 mb-2">
                    {(['email', 'sms', 'note'] as const).map(type => (
                      <button key={type} onClick={() => setMessageType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${messageType === type ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                        {CHANNEL_ICONS[type]} {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      placeholder={`Type a ${messageType} message…`}
                      rows={3}
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSendMessage(); }}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                    <button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90 self-end"
                      style={{ background: '#4A3728' }}>
                      {sending ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">⌘+Enter to send</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── BROADCAST TAB ── */}
      {activeTab === 'broadcast' && (
        <div className="max-w-2xl">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-secondary/30">
              <h3 className="text-sm font-semibold text-foreground">Send Broadcast Message</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Send a message to multiple clients at once via email or SMS</p>
            </div>
            <div className="p-6 space-y-5">
              {broadcastSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(53,94,59,0.1)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1">Broadcast Sent!</p>
                  <p className="text-sm text-muted-foreground">Your message has been queued for delivery.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Channel</label>
                      <select value={broadcastForm.channel} onChange={e => setBroadcastForm(p => ({ ...p, channel: e.target.value as BroadcastForm['channel'] }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                        <option value="email">📧 Email Only</option>
                        <option value="sms">💬 SMS Only</option>
                        <option value="both">📧💬 Email + SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Audience</label>
                      <select value={broadcastForm.audience} onChange={e => setBroadcastForm(p => ({ ...p, audience: e.target.value as BroadcastForm['audience'] }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                        <option value="all">All Active Clients</option>
                        <option value="active_cases">Active Case Clients</option>
                        <option value="retainer_clients">Retainer Clients</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Subject</label>
                    <input type="text" value={broadcastForm.subject} onChange={e => setBroadcastForm(p => ({ ...p, subject: e.target.value }))}
                      placeholder="Important Update from Broussard Legal Services"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Message Body</label>
                    <textarea rows={8} value={broadcastForm.body} onChange={e => setBroadcastForm(p => ({ ...p, body: e.target.value }))}
                      placeholder="Dear [Client Name],&#10;&#10;I wanted to reach out regarding…&#10;&#10;Best regards,&#10;Maggi May Broussard, Esq."
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
                    <p className="text-xs text-muted-foreground mt-1">Use [Client Name] as a placeholder — it will be personalized for each recipient.</p>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-xs text-amber-700">This will send to <strong>{broadcastForm.audience === 'all' ? 'all active clients' : broadcastForm.audience === 'active_cases' ? 'active case clients' : 'retainer clients'}</strong> via {broadcastForm.channel}. Review carefully before sending.</p>
                  </div>
                  <button onClick={handleBroadcast} disabled={broadcasting || !broadcastForm.subject.trim() || !broadcastForm.body.trim()}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white"
                    style={{ background: '#4A3728' }}>
                    {broadcasting ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending Broadcast…</>
                    ) : '📢 Send Broadcast'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK REPLIES TAB ── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUICK_REPLIES.map(qr => (
            <div key={qr.id} className="bg-card border border-border rounded-2xl p-5 hover:border-accent/40 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{qr.label}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border mt-1">
                    {qr.category}
                  </span>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(qr.content); toast.success('Copied to clipboard!'); }}
                  className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-all text-muted-foreground hover:text-foreground">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{qr.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── COMMUNICATION LOG TAB ── */}
      {activeTab === 'log' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Communication Log</h3>
            <span className="text-xs text-muted-foreground">{commLogs.length} recent entries</span>
          </div>
          {commLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No communication logs found</div>
          ) : (
            <div className="divide-y divide-border">
              {commLogs.map(log => (
                <div key={log.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{log.type === 'email' ? '📧' : log.type === 'sms' ? '💬' : '📝'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{log.subject}</p>
                      <p className="text-xs text-muted-foreground">{log.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${log.status === 'sent' || log.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {log.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{log.sent_at ? timeAgo(log.sent_at) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
