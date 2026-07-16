'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

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
  attachment_url?: string | null;
  attachment_name?: string | null;
}

interface CaseUpdate {
  id: string;
  event_title: string;
  event_description: string | null;
  event_date: string;
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
  updated_at: string;
}

interface CaseInfo {
  id: string;
  name: string;
  service: string;
  status: string;
  booking_stage: string | null;
}

type Tab = 'messages' | 'updates' | 'documents';

// ── Nav ───────────────────────────────────────────────────────────────────────

const PORTAL_NAV = [
  {
    href: '/portal/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/portal/cases',
    label: 'My Cases',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: '/portal/hub',
    label: 'Client Hub',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/portal/invoices',
    label: 'Invoices',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: '/portal/documents',
    label: 'Documents',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/portal/settings',
    label: 'Settings',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
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
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const DOC_REQUEST_TYPES = [
  'Retainer Agreement Copy',
  'Invoice / Receipt',
  'Case Summary',
  'Court Filing Copy',
  'Correspondence Copy',
  'Settlement Agreement',
  'Contract Draft',
  'Legal Opinion Letter',
  'Other',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: 'Pending', color: '#C8965A', bg: 'rgba(200,150,90,0.08)', dot: '#C8965A' },
  in_review: { label: 'In Review', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', dot: '#2563EB' },
  fulfilled: { label: 'Fulfilled', color: '#355E3B', bg: 'rgba(53,94,59,0.08)', dot: '#355E3B' },
  declined: { label: 'Declined', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', dot: '#6B7280' },
};

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  intake: { label: 'Intake', color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  active: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)' },
  active_client: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)' },
  billed: { label: 'Billed', color: '#C8965A', bg: 'rgba(200,150,90,0.08)' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
};

function resolveStage(stage: string | null, status: string): string {
  const raw = (stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  if (status === 'new' || status === 'in_review') return 'intake';
  if (status === 'contacted') return 'active';
  if (status === 'closed') return 'closed';
  return 'intake';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientHubPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Case updates state
  const [caseUpdates, setCaseUpdates] = useState<CaseUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // Document requests state
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSuccess, setDocSuccess] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [authLoading, user, router]);

  // ── Fetch base data ─────────────────────────────────────────────────────────
  const fetchBase = useCallback(async () => {
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
      const { data: caseData } = await supabase
        .from('contact_inquiries')
        .select('id, name, service, status, booking_stage')
        .eq('id', iid)
        .single();
      if (caseData) setCaseInfo(caseData);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user || !inquiryId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('portal_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });

    const msgs: Message[] = data ?? [];
    setMessages(msgs);
    const unread = msgs.filter((m) => m.sender_role === 'admin' && !m.read_at).length;
    setUnreadCount(unread);

    const unreadIds = msgs.filter((m) => m.sender_role === 'admin' && !m.read_at).map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('portal_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
    }
  }, [user, inquiryId]);

  // ── Fetch case updates ──────────────────────────────────────────────────────
  const fetchUpdates = useCallback(async () => {
    if (!user || !inquiryId) return;
    setUpdatesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('case_timeline')
      .select('id, event_title, event_description, event_date')
      .eq('inquiry_id', inquiryId)
      .order('event_date', { ascending: false });
    setCaseUpdates(data ?? []);
    setUpdatesLoading(false);
  }, [user, inquiryId]);

  // ── Fetch document requests ─────────────────────────────────────────────────
  const fetchDocRequests = useCallback(async () => {
    if (!user || !inquiryId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('client_document_requests')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false });
    setDocRequests(data ?? []);
  }, [user, inquiryId]);

  useEffect(() => {
    if (!inquiryId) return;
    fetchMessages();
    fetchUpdates();
    fetchDocRequests();
  }, [inquiryId, fetchMessages, fetchUpdates, fetchDocRequests]);

  // ── Realtime messages ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !inquiryId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('hub-messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages', filter: `inquiry_id=eq.${inquiryId}` }, () => { fetchMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, inquiryId, fetchMessages]);

  useEffect(() => {
    if (activeTab === 'messages') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!msgBody.trim() || !user || !inquiryId) return;
    setSending(true);
    setMsgError(null);
    const supabase = createClient();

    const { error } = await supabase.from('portal_messages').insert({
      inquiry_id: inquiryId,
      sender_id: user.id,
      sender_role: 'client',
      body: msgBody.trim(),
    });

    if (error) {
      setMsgError('Failed to send message. Please try again.');
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
          messageBody: msgBody.trim(),
          caseName: caseInfo?.name ?? caseInfo?.service ?? undefined,
          portalUrl: `${siteUrl}/admin/messages`,
        }),
      }).catch(() => {});
      setMsgBody('');
    }
    setSending(false);
  };

  const handleMsgKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // ── Submit document request ─────────────────────────────────────────────────
  const handleDocRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docType || !user || !inquiryId) return;
    setDocSubmitting(true);
    setDocError(null);
    const supabase = createClient();

    const { error } = await supabase.from('client_document_requests').insert({
      inquiry_id: inquiryId,
      client_id: user.id,
      document_type: docType,
      description: docDescription.trim() || null,
      status: 'pending',
    });

    if (error) {
      setDocError('Failed to submit request. Please try again.');
    } else {
      setDocSuccess(true);
      setDocType('');
      setDocDescription('');
      setShowDocForm(false);
      fetchDocRequests();
      setTimeout(() => setDocSuccess(false), 4000);
    }
    setDocSubmitting(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/portal/login');
  };

  // ── Group messages by date ──────────────────────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((m) => {
    const d = new Date(m.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === d) { last.msgs.push(m); }
    else { groupedMessages.push({ date: d, msgs: [m] }); }
  });

  const stageKey = caseInfo ? resolveStage(caseInfo.booking_stage, caseInfo.status) : 'intake';
  const stageCfg = STAGE_CONFIG[stageKey] ?? STAGE_CONFIG.intake;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your hub…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border bg-card shrink-0 fixed top-0 left-0 h-full z-20">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/portal/dashboard">
            <AppLogo className="h-7 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {PORTAL_NAV.map((item) => {
            const active = item.href === '/portal/hub';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors w-full"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── Mobile nav overlay ── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col z-50">
            <div className="px-5 py-5 border-b border-border flex items-center justify-between">
              <AppLogo className="h-7 w-auto" />
              <button onClick={() => setMobileNavOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {PORTAL_NAV.map((item) => {
                const active = item.href === '/portal/hub';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Client Hub</h1>
              <p className="text-[11px] text-muted-foreground">Messages · Case Updates · Document Requests</p>
            </div>
          </div>
          {caseInfo && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{ background: stageCfg.bg, color: stageCfg.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.color }} />
              {caseInfo.name ?? caseInfo.service}
            </div>
          )}
        </header>

        <div className="flex-1 p-5 max-w-4xl mx-auto w-full">
          {/* Case banner */}
          {caseInfo && (
            <div className="mb-5 p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{caseInfo.name ?? caseInfo.service}</p>
                  <p className="text-[11px] text-muted-foreground">{caseInfo.service}</p>
                </div>
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
                style={{ background: stageCfg.bg, color: stageCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.color }} />
                {stageCfg.label}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-5 bg-secondary/40 rounded-xl p-1">
            {[
              {
                key: 'messages' as Tab,
                label: 'Messages',
                badge: unreadCount > 0 ? unreadCount : null,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
              },
              {
                key: 'updates' as Tab,
                label: 'Case Updates',
                badge: null,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
              },
              {
                key: 'documents' as Tab,
                label: 'Document Requests',
                badge: docRequests.filter((r) => r.status === 'fulfilled').length > 0 ? docRequests.filter((r) => r.status === 'fulfilled').length : null,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" />
                  </svg>
                ),
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                {tab.badge !== null && (
                  <span className="w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Messages Tab ── */}
          {activeTab === 'messages' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Direct Messages</h2>
                </div>
                <span className="text-[11px] text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: '420px' }}>
                {!inquiryId ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No active case found</p>
                    <p className="text-xs text-muted-foreground/70">Messaging is available once your case is set up</p>
                  </div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/70">Send a message to your legal team below</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground font-medium px-2">
                          {new Date(group.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      {group.msgs.map((msg) => {
                        const isSelf = msg.sender_role === 'client';
                        return (
                          <div key={msg.id} className={`flex gap-3 mb-3 ${isSelf ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                              isSelf ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
                            }`}>
                              {isSelf ? 'C' : 'A'}
                            </div>
                            <div className={`max-w-[72%] flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                              <div
                                className={`px-4 py-3 rounded-2xl text-sm ${isSelf ? 'rounded-tr-sm text-white' : 'bg-secondary/60 text-foreground rounded-tl-sm'}`}
                                style={isSelf ? { background: '#355E3B' } : {}}
                              >
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                              </div>
                              {msg.attachment_url && (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground hover:bg-secondary/60 transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  {msg.attachment_name ?? 'Attachment'}
                                </a>
                              )}
                              <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Compose */}
              {inquiryId && (
                <div className="px-5 py-4 border-t border-border">
                  {msgError && (
                    <p className="text-xs text-red-500 mb-2">{msgError}</p>
                  )}
                  <div className="flex items-end gap-3">
                    <textarea
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                      onKeyDown={handleMsgKeyDown}
                      placeholder="Type a message… (Enter to send)"
                      rows={2}
                      className="flex-1 resize-none text-sm bg-secondary/40 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !msgBody.trim()}
                      className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-80 transition-opacity"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Case Updates Tab ── */}
          {activeTab === 'updates' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Matter-Specific Notifications</h2>
                </div>
                <span className="text-[11px] text-muted-foreground">{caseUpdates.length} update{caseUpdates.length !== 1 ? 's' : ''}</span>
              </div>

              {updatesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : !inquiryId ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-5">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">No active case found</p>
                </div>
              ) : caseUpdates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-5">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">No case updates yet</p>
                  <p className="text-xs text-muted-foreground/70">Updates will appear here as your matter progresses</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {caseUpdates.map((update, idx) => (
                    <div key={update.id} className="px-5 py-4 flex gap-4">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        {idx < caseUpdates.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[24px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground leading-snug">{update.event_title}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(update.event_date)}</span>
                        </div>
                        {update.event_description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{update.event_description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5">{formatFullDate(update.event_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Document Requests Tab ── */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" />
                    </svg>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Document Requests</h2>
                  </div>
                  {inquiryId && (
                    <button
                      onClick={() => { setShowDocForm(!showDocForm); setDocError(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-80 transition-opacity"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      New Request
                    </button>
                  )}
                </div>

                {/* Success banner */}
                {docSuccess && (
                  <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p className="text-xs text-emerald-700 font-medium">Document request submitted successfully.</p>
                  </div>
                )}

                {/* Request form */}
                {showDocForm && inquiryId && (
                  <form onSubmit={handleDocRequest} className="px-5 py-4 border-b border-border space-y-3">
                    <p className="text-xs font-medium text-foreground">Request a Document</p>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Document Type <span className="text-red-500">*</span></label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        required
                        className="w-full text-sm bg-secondary/40 border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                      >
                        <option value="">Select document type…</option>
                        {DOC_REQUEST_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Additional Details (optional)</label>
                      <textarea
                        value={docDescription}
                        onChange={(e) => setDocDescription(e.target.value)}
                        placeholder="Describe what you need, date range, or any specific details…"
                        rows={3}
                        className="w-full resize-none text-sm bg-secondary/40 border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                      />
                    </div>
                    {docError && <p className="text-xs text-red-500">{docError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={docSubmitting || !docType}
                        className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
                      >
                        {docSubmitting ? 'Submitting…' : 'Submit Request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDocForm(false); setDocError(null); }}
                        className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Requests list */}
                {!inquiryId ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 px-5">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No active case found</p>
                  </div>
                ) : docRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 px-5">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No document requests yet</p>
                    <p className="text-xs text-muted-foreground/70">Use the button above to request documents without email</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {docRequests.map((req) => {
                      const sc = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                      return (
                        <div key={req.id} className="px-5 py-4 flex items-start gap-4">
                          <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{req.document_type}</p>
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
                                style={{ background: sc.bg, color: sc.color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                                {sc.label}
                              </div>
                            </div>
                            {req.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{req.description}</p>
                            )}
                            {req.admin_notes && (
                              <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border">
                                <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Note from legal team:</p>
                                <p className="text-xs text-foreground">{req.admin_notes}</p>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-1.5">Requested {formatFullDate(req.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info callout */}
              <div className="px-4 py-3 rounded-xl border border-border bg-secondary/20 flex items-start gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Document requests are reviewed by your legal team. You will receive a notification when your request is fulfilled. No email required.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
