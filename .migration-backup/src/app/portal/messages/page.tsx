'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalMessagesView, trackPortalMessageSent } from '@/lib/analytics';

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
  attachment_url?: string | null;
  attachment_name?: string | null;
}

interface CaseInfo {
  id: string;
  name: string;
  service: string;
  status: string;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const PORTAL_NAV = [
  { href: '/portal/dashboard', label: 'Dashboard', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { href: '/portal/cases', label: 'My Cases', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { href: '/portal/invoices', label: 'Invoices', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { href: '/portal/messages', label: 'Messages', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/portal/documents', label: 'Documents', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></svg> },
  { href: '/portal/notifications', label: 'Notifications', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { href: '/portal/settings', label: 'Settings', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function PortalMessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [authLoading, user, router]);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data: accessData } = await supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const iid = accessData?.inquiry_id ?? null;
    setInquiryId(iid);

    if (iid) {
      const [msgRes, caseRes] = await Promise.all([
        supabase.from('portal_messages').select('*').eq('inquiry_id', iid).order('created_at', { ascending: true }),
        supabase.from('contact_inquiries').select('id, name, service, status').eq('id', iid).single(),
      ]);

      const msgs: Message[] = (msgRes.data || []).map((m: Message) => ({
        ...m,
        reply_to: m.reply_to_id
          ? (msgRes.data || []).find((x: Message) => x.id === m.reply_to_id) ?? null
          : null,
      }));

      setMessages(msgs);
      if (caseRes.data) setCaseInfo(caseRes.data);

      const unread = msgs.filter((m) => m.sender_role === 'admin' && !m.read_at).length;
      setUnreadCount(unread);
      trackPortalMessagesView(msgs.length, unread);

      const unreadIds = msgs.filter((m) => m.sender_role === 'admin' && !m.read_at).map((m) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('portal_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !inquiryId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('portal-messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages', filter: `inquiry_id=eq.${inquiryId}` }, () => { fetchMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, inquiryId, fetchMessages]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!body.trim() || !user || !inquiryId) return;
    setSending(true);
    setError(null);
    const supabase = createClient();

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (attachmentFile) {
      setUploadingAttachment(true);
      const storagePath = `messages/${user.id}/${Date.now()}_${attachmentFile.name}`;
      const { error: storageErr } = await supabase.storage.from('case-documents').upload(storagePath, attachmentFile, { cacheControl: '3600', upsert: false });
      if (!storageErr) {
        const { data: { publicUrl } } = supabase.storage.from('case-documents').getPublicUrl(storagePath);
        attachmentUrl = publicUrl;
        attachmentName = attachmentFile.name;
      }
      setUploadingAttachment(false);
    }

    const { error: insertErr } = await supabase.from('portal_messages').insert({
      inquiry_id: inquiryId,
      sender_id: user.id,
      sender_role: 'client',
      body: body.trim(),
      reply_to_id: replyTo?.id ?? null,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
    });

    if (insertErr) {
      setError('Failed to send message. Please try again.');
    } else {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
      const clientName = user.user_metadata?.full_name ?? user.email ?? 'Client';
      fetch('/api/notifications/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: 'Maggi May Broussard',
          recipientEmail: 'broussardlegalservices@gmail.com',
          senderName: clientName,
          senderRole: 'client',
          messageBody: body.trim(),
          caseName: caseInfo?.name ?? caseInfo?.service ?? undefined,
          portalUrl: `${siteUrl}/admin/messages`,
        }),
      }).catch(() => {});

      setBody('');
      setReplyTo(null);
      setAttachmentFile(null);
      trackPortalMessageSent(!!attachmentUrl);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/portal/login');
  };

  // ── Filtered messages ────────────────────────────────────────────────────────
  const filteredMessages = searchQuery
    ? messages.filter((m) => m.body.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // ── Group messages by date ───────────────────────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  filteredMessages.forEach((m) => {
    const d = new Date(m.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === d) { last.msgs.push(m); }
    else { groupedMessages.push({ date: d, msgs: [m] }); }
  });

  const adminMsgCount = messages.filter((m) => m.sender_role === 'admin').length;
  const clientMsgCount = messages.filter((m) => m.sender_role === 'client').length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/portal/dashboard">
                <AppLogo className="h-7 w-auto" />
              </Link>
              <span className="text-muted-foreground/40 text-sm hidden sm:block">·</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:block">Client Portal</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileNavOpen((v) => !v)} className="sm:hidden p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <nav className="hidden sm:flex items-center gap-0.5">
                {PORTAL_NAV.map((item) => {
                  const active = item.href === '/portal/messages';
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors ${active ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'}`}>
                      <span className={active ? 'text-primary' : 'opacity-60'}>{item.icon}</span>
                      {item.label}
                      {item.href === '/portal/messages' && unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold">{unreadCount}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <button onClick={handleSignOut} disabled={signingOut} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors">
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-1">
            {PORTAL_NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors ${item.href === '/portal/messages' ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'}`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            ))}
            <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors mt-1 border-t border-border pt-3">Sign Out</button>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Page title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
            <h1 className="font-serif text-3xl text-foreground">Messaging Hub</h1>
            <p className="text-sm text-muted-foreground font-light mt-1">
              Secure, direct communication with your attorney — all messages linked to your case.
            </p>
          </div>
          {caseInfo && (
            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-xs text-muted-foreground">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="font-medium text-foreground">{caseInfo.service}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="capitalize">{caseInfo.status?.replace(/_/g, ' ')}</span>
              </div>
              {messages.length > 0 && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{messages.length} total</span>
                  <span>{adminMsgCount} from attorney</span>
                  <span>{clientMsgCount} from you</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* No case linked */}
        {!inquiryId && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 className="font-serif text-xl text-foreground mb-2">No case linked yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Messages will be available once your account is linked to an active case.</p>
            <Link href="/contact" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: '#355E3B' }}>Contact Us</Link>
          </div>
        )}

        {/* Message thread */}
        {inquiryId && (
          <div className="flex flex-col gap-0 bg-card border border-border rounded-2xl overflow-hidden flex-1" style={{ minHeight: '520px' }}>
            {/* Thread header */}
            <div className="px-5 py-4 border-b border-border bg-secondary/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">MM</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Maggi May Broussard</p>
                  <p className="text-xs text-muted-foreground">Broussard Legal Services</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch((v) => !v)}
                  className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
                  title="Search messages"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground hidden sm:block">Secure channel</span>
              </div>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="px-5 py-3 border-b border-border bg-background">
                <div className="relative">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages…"
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Messages scroll area */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1" style={{ maxHeight: '420px', minHeight: '320px' }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
                  <p className="text-xs text-muted-foreground">Send a message to start the conversation with your attorney.</p>
                </div>
              )}

              {searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <p className="text-sm text-muted-foreground">No messages match &ldquo;{searchQuery}&rdquo;</p>
                  <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-primary hover:underline">Clear search</button>
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
                    const isClient = msg.sender_role === 'client';
                    const isHighlighted = searchQuery && msg.body.toLowerCase().includes(searchQuery.toLowerCase());
                    return (
                      <div key={msg.id} className={`flex flex-col gap-1 ${isClient ? 'items-end' : 'items-start'}`}>
                        {msg.reply_to && (
                          <div className={`max-w-xs px-3 py-2 rounded-xl border text-xs text-muted-foreground bg-secondary/40 border-border ${isClient ? 'mr-1' : 'ml-1'}`}>
                            <p className="font-semibold mb-0.5 text-[10px] uppercase tracking-widest">
                              Replying to {msg.reply_to.sender_role === 'admin' ? 'Maggi May' : 'you'}
                            </p>
                            <p className="truncate">{msg.reply_to.body}</p>
                          </div>
                        )}

                        <div
                          className={`group relative max-w-sm lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            isHighlighted ? 'ring-2 ring-amber-400' : ''
                          } ${isClient ? 'text-white rounded-br-sm' : 'bg-secondary/50 text-foreground border border-border rounded-bl-sm'}`}
                          style={isClient ? { background: '#355E3B' } : {}}
                        >
                          {msg.body}

                          {/* Attachment */}
                          {msg.attachment_url && (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isClient ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                              </svg>
                              {msg.attachment_name ?? 'Attachment'}
                            </a>
                          )}

                          <button
                            onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                            className={`absolute top-2 ${isClient ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} opacity-0 group-hover:opacity-100 transition-opacity`}
                            title="Reply"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground hover:text-foreground">
                              <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                            </svg>
                          </button>
                        </div>

                        <div className={`flex items-center gap-1.5 px-1 ${isClient ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[10px] text-muted-foreground" title={formatFullDate(msg.created_at)}>{formatTime(msg.created_at)}</span>
                          {isClient && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              {msg.read_at ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="20 6 9 17 4 12"/></svg>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary -ml-1.5"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span className="text-primary">Read</span>
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span>Sent</span>
                                </>
                              )}
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

            {/* Compose area */}
            <div className="border-t border-border bg-background px-4 py-3">
              {replyTo && (
                <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                    <span className="font-semibold">Replying to {replyTo.sender_role === 'admin' ? 'Maggi May' : 'yourself'}:</span>
                    <span className="truncate">{replyTo.body}</span>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="flex-shrink-0 hover:text-foreground transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {/* Attachment preview */}
              {attachmentFile && (
                <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span className="text-primary font-medium truncate">{attachmentFile.name}</span>
                    <span className="text-muted-foreground">({(attachmentFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={() => setAttachmentFile(null)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

              <div className="flex items-end gap-2">
                <button
                  onClick={() => attachInputRef.current?.click()}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors border border-border"
                  title="Attach file"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <input ref={attachInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachmentFile(f); }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" />

                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 resize-none bg-secondary/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || uploadingAttachment || !body.trim()}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ background: '#355E3B' }}
                  title="Send message"
                >
                  {sending || uploadingAttachment ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-1">
                Messages are private and secure. Attach files up to 10 MB. Maggi May will be notified.
              </p>
            </div>
          </div>
        )}

        {/* Quick links */}
        {inquiryId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '/portal/documents', label: 'Upload Documents', desc: 'Share intake forms & files', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
              { href: '/portal/signatures', label: 'Sign Documents', desc: 'Review & sign agreements', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
              { href: '/portal/cases', label: 'View Case Status', desc: 'Track milestones & timeline', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/15 transition-colors">
                  {link.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{link.label}</p>
                  <p className="text-[10px] text-muted-foreground">{link.desc}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
