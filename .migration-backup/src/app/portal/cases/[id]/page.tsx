'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackCaseView } from '@/lib/analytics';

import MatterMessageThread from '@/components/MatterMessageThread';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDetail {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  booking_stage: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
  phone?: string | null;
  jurisdiction?: string | null;
  opposing_party?: string | null;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  category: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  event_title: string;
  event_description: string | null;
  event_date: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  due_date: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  created_at: string;
}

interface Message {
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

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  created_at: string;
}

interface RetainerSubscription {
  id: string;
  plan_name: string;
  amount: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface CaseNote {
  id: string;
  content: string;
  author: string;
  source: string;
  notion_page_id: string | null;
  notion_synced_at: string | null;
  created_at: string;
}

// ── Live Stage Change Toast ───────────────────────────────────────────────────
interface StageToast {
  id: string;
  previousStage: string;
  newStage: string;
  visible: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  intake: { label: 'Intake', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', dot: '#2563EB' },
  active: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)', dot: '#355E3B' },
  active_client: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)', dot: '#355E3B' },
  billed: { label: 'Billed', color: '#C8965A', bg: 'rgba(200,150,90,0.08)', dot: '#C8965A' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', dot: '#6B7280' },
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Received', in_review: 'In Review', contacted: 'In Progress', closed: 'Closed',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  review: { label: 'In Review', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  done: { label: 'Done', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  sent: { label: 'Sent', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

function resolveStage(c: CaseDetail): string {
  const raw = (c.booking_stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  if (c.status === 'new' || c.status === 'in_review') return 'intake';
  if (c.status === 'contacted') return 'active';
  if (c.status === 'closed') return 'closed';
  return 'intake';
}

function getMilestones(c: CaseDetail) {
  const stage = resolveStage(c);
  const stageOrder = ['intake', 'active', 'billed', 'closed'];
  const idx = stageOrder.indexOf(stage === 'active_client' ? 'active' : stage);
  return [
    { label: 'Inquiry Submitted', completed: true, active: idx === 0, date: c.created_at },
    { label: 'Case Active', completed: idx >= 1, active: idx === 1, date: null },
    { label: 'Work Billed', completed: idx >= 2, active: idx === 2, date: null },
    { label: 'Engagement Closed', completed: idx >= 3, active: idx === 3, date: null },
  ];
}

type ActiveTab = 'overview' | 'documents' | 'messages' | 'invoices' | 'tasks' | 'notes';

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/documents', label: 'Documents' },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortalCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.id as string;
  const { user, loading: authLoading, signOut } = useAuth();

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [retainer, setRetainer] = useState<RetainerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [stageToast, setStageToast] = useState<StageToast | null>(null);
  const [isLive, setIsLive] = useState(false);
  const prevStageRef = useRef<string | null>(null);

  // Reply state
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !caseId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Verify access
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .eq('inquiry_id', caseId)
        .maybeSingle();

      if (!accessData) {
        setError('You do not have access to this case.');
        setLoading(false);
        return;
      }

      const [caseRes, docsRes, timelineRes, invoicesRes, messagesRes, tasksRes, retainerRes] = await Promise.all([
        supabase.from('contact_inquiries').select('*').eq('id', caseId).single(),
        supabase.from('case_documents').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('case_timeline').select('*').eq('inquiry_id', caseId).order('event_date', { ascending: false }),
        supabase.from('client_invoices').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('portal_messages').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: true }),
        supabase.from('admin_tasks').select('*').eq('case_id', caseId).order('due_date', { ascending: true }),
        supabase.from('retainer_subscriptions').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (caseRes.error) throw caseRes.error;
      setCaseDetail(caseRes.data);
      setDocuments(docsRes.data || []);
      setTimeline(timelineRes.data || []);
      setInvoices(invoicesRes.data || []);
      setMessages(messagesRes.data || []);
      setTasks(tasksRes.data || []);
      setRetainer(retainerRes.data ?? null);

      // Fetch Notion-synced case notes visible to client
      const { data: notesData } = await supabase
        .from('case_notes')
        .select('*')
        .eq('inquiry_id', caseId)
        .order('created_at', { ascending: false });
      setCaseNotes(notesData || []);

      // Track case view milestone
      trackCaseView(
        caseId,
        caseRes.data?.booking_stage ?? caseRes.data?.status ?? 'unknown',
        caseRes.data?.service ?? 'unknown'
      );

      // Mark admin messages as read
      const unreadIds = (messagesRes.data || [])
        .filter((m: Message) => m.sender_role === 'admin' && !m.read_at)
        .map((m: Message) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('portal_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load case data.');
    } finally {
      setLoading(false);
    }
  }, [user, caseId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && caseId) fetchData();
  }, [user, caseId, fetchData]);

  // ── Real-time subscription for case stage changes ─────────────────────────
  useEffect(() => {
    if (!user || !caseId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`case-stage-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_inquiries',
          filter: `id=eq.${caseId}`,
        },
        (payload) => {
          const updated = payload.new as CaseDetail;
          const oldRecord = payload.old as Partial<CaseDetail>;

          const newStage = (updated.booking_stage ?? updated.status ?? '').toLowerCase();
          const oldStage = (oldRecord.booking_stage ?? oldRecord.status ?? prevStageRef.current ?? '').toLowerCase();

          if (newStage !== oldStage && oldStage) {
            const toastId = `${Date.now()}`;
            setStageToast({ id: toastId, previousStage: oldStage, newStage, visible: true });
            // Auto-dismiss after 8 seconds
            setTimeout(() => {
              setStageToast((prev) => (prev?.id === toastId ? { ...prev, visible: false } : prev));
              setTimeout(() => setStageToast(null), 400);
            }, 8000);
          }

          prevStageRef.current = newStage;
          // Refresh data silently
          setCaseDetail(updated);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'case_milestones',
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          // Refresh timeline when a new milestone is inserted
          fetchData();
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [user, caseId, fetchData]);

  // Track initial stage for comparison
  useEffect(() => {
    if (caseDetail && !prevStageRef.current) {
      prevStageRef.current = (caseDetail.booking_stage ?? caseDetail.status ?? '').toLowerCase();
    }
  }, [caseDetail]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); router.replace('/portal/login'); }
    catch { setSigningOut(false); }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !caseId) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      const supabase = createClient();
      const { error: msgErr } = await supabase.from('portal_messages').insert({
        inquiry_id: caseId,
        sender_role: 'client',
        body: replyBody.trim(),
      });
      if (msgErr) throw msgErr;
      setReplyBody('');
      await fetchData();
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSendingReply(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading case details…</p>
        </div>
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-4">{error ?? 'Case not found.'}</p>
          <Link href="/portal/cases" className="text-xs text-muted-foreground underline">← Back to My Cases</Link>
        </div>
      </div>
    );
  }

  const stage = resolveStage(caseDetail);
  const stageCfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake'];
  const milestones = getMilestones(caseDetail);
  const unreadCount = messages.filter((m) => m.sender_role === 'admin' && !m.read_at).length;
  const pendingInvoices = invoices.filter((i) => ['sent', 'pending', 'overdue'].includes(i.status));
  const openTasks = tasks.filter((t) => t.status !== 'done');

  const TABS: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents', badge: documents.length || undefined },
    { id: 'messages', label: 'Messages', badge: unreadCount || undefined },
    { id: 'invoices', label: 'Invoices', badge: pendingInvoices.length || undefined },
    { id: 'tasks', label: 'Tasks', badge: openTasks.length || undefined },
    { id: 'notes', label: 'Case Notes', badge: caseNotes.length || undefined },
  ];

  const stageLabel = (s: string) => STAGE_CONFIG[s]?.label ?? s.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-background">
      {/* ── Live Stage Change Toast ─────────────────────────────────────────── */}
      {stageToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-400 ${
            stageToast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${stageCfg.dot}, ${stageCfg.color})` }} />
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: stageCfg.bg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Case Stage Updated</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your case moved from{' '}
                  <span className="font-medium text-foreground">{stageLabel(stageToast.previousStage)}</span>
                  {' '}→{' '}
                  <span className="font-semibold" style={{ color: stageCfg.color }}>{stageLabel(stageToast.newStage)}</span>
                </p>
              </div>
              <button
                onClick={() => setStageToast(null)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              {/* Live indicator */}
              {isLive && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">{user?.email}</span>
              <button onClick={() => setMobileNavOpen((o) => !o)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors" aria-label="Menu">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button onClick={handleSignOut} disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60">
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <div className="lg:hidden border-t border-border/60 py-3 flex flex-wrap gap-2 pb-4">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200">
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/portal/cases" className="text-xs text-muted-foreground hover:text-foreground transition-colors">My Cases</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-xs text-foreground font-medium truncate">{caseDetail.service}</span>
        </div>

        {/* Case Header */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
            style={{ background: stageCfg.bg, borderBottom: `1px solid ${stageCfg.dot}22` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                  style={{ background: `${stageCfg.dot}22`, color: stageCfg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.dot }} />
                  {stageCfg.label}
                </span>
                <span className="text-xs text-muted-foreground">{STATUS_LABELS[caseDetail.status] ?? caseDetail.status}</span>
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live updates on
                  </span>
                )}
              </div>
              <h1 className="font-serif text-xl md:text-2xl text-foreground tracking-tight mb-1">
                {caseDetail.firm ? `${caseDetail.firm} — ${caseDetail.service}` : caseDetail.service}
              </h1>
              <p className="text-sm text-muted-foreground">Opened {formatDate(caseDetail.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/portal/messages"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Messages
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white" style={{ background: '#355E3B' }}>{unreadCount}</span>
                )}
              </Link>
              <Link href="/portal/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Invoices
              </Link>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
            {[
              { label: 'Service Type', value: caseDetail.service },
              { label: 'Case Stage', value: stageCfg.label },
              { label: 'Documents', value: String(documents.length) },
              { label: 'Open Tasks', value: String(openTasks.length) },
            ].map((stat) => (
              <div key={stat.label} className="px-5 py-3.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">{stat.label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-foreground text-background'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-background/20 text-background' : 'bg-foreground/10 text-foreground'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Client Info + Matter Description */}
            <div className="lg:col-span-2 space-y-4">
              {/* Client Info */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Client Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', value: caseDetail.name },
                    { label: 'Email', value: caseDetail.email },
                    { label: 'Firm / Company', value: caseDetail.firm || '—' },
                    { label: 'Service Type', value: caseDetail.service },
                    { label: 'Phone', value: caseDetail.phone || '—' },
                    { label: 'Jurisdiction', value: caseDetail.jurisdiction || '—' },
                    { label: 'Opposing Party', value: caseDetail.opposing_party || '—' },
                    { label: 'Case Opened', value: formatDate(caseDetail.created_at) },
                  ].map((field) => (
                    <div key={field.label}>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">{field.label}</p>
                      <p className="text-sm text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matter Description */}
              {caseDetail.message && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Matter Description</h2>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{caseDetail.message}</p>
                </div>
              )}

              {/* Recent Messages Preview */}
              {messages.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Messages</h2>
                    <button onClick={() => setActiveTab('messages')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">View all →</button>
                  </div>
                  <div className="space-y-3">
                    {messages.slice(-3).map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.sender_role === 'client' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          msg.sender_role === 'admin' ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
                        }`}>
                          {msg.sender_role === 'admin' ? 'M' : 'C'}
                        </div>
                        <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.sender_role === 'admin' ?'bg-secondary/60 text-foreground rounded-tl-sm' :'text-white rounded-tr-sm'
                        }`} style={msg.sender_role === 'client' ? { background: '#355E3B' } : {}}>
                          <p className="leading-relaxed">{msg.body}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender_role === 'admin' ? 'text-muted-foreground' : 'text-white/60'}`}>
                            {formatDateShort(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Milestones + Retainer + Upcoming */}
            <div className="space-y-4">
              {/* Milestones */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Case Milestones</h2>
                <div className="space-y-0">
                  {milestones.map((m, i) => (
                    <div key={m.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          m.completed ? 'bg-foreground' : m.active ? 'border-2 bg-background' : 'bg-secondary border border-border'
                        }`} style={m.active ? { borderColor: stageCfg.dot } : {}}>
                          {m.completed ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : m.active ? (
                            <div className="w-2 h-2 rounded-full" style={{ background: stageCfg.dot }} />
                          ) : null}
                        </div>
                        {i < milestones.length - 1 && (
                          <div className={`w-px flex-1 my-1 ${m.completed ? 'bg-foreground/30' : 'bg-border'}`} style={{ minHeight: '20px' }} />
                        )}
                      </div>
                      <div className="pb-4 min-w-0">
                        <p className={`text-sm font-medium ${m.completed || m.active ? 'text-foreground' : 'text-muted-foreground'}`}>{m.label}</p>
                        {m.date && <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateShort(m.date)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Retainer */}
              {retainer && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Retainer</h2>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{retainer.plan_name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                      retainer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {retainer.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {retainer.current_period_start && retainer.current_period_end
                      ? `${formatDateShort(retainer.current_period_start)} – ${formatDateShort(retainer.current_period_end)}`
                      : `Started ${formatDateShort(retainer.current_period_start ?? '')}`}
                  </p>
                </div>
              )}

              {/* Upcoming Consultation */}
              {caseDetail.calendly_start_time && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Upcoming Consultation</h2>
                  <p className="text-sm font-semibold text-foreground mb-1">{caseDetail.calendly_event_name ?? 'Consultation'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(caseDetail.calendly_start_time)}</p>
                </div>
              )}

              {/* Timeline */}
              {timeline.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Case Timeline</h2>
                  <div className="space-y-3">
                    {timeline.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{event.event_title}</p>
                          {event.event_description && <p className="text-xs text-muted-foreground mt-0.5">{event.event_description}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDateShort(event.event_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === 'documents' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Case Documents</h2>
              <Link href="/portal/documents"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Manage All Documents →
              </Link>
            </div>
            {documents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No documents yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.category && <span className="mr-2">{doc.category}</span>}
                        {doc.file_type && <span className="mr-2">{doc.file_type}</span>}
                        {formatFileSize(doc.file_size)}
                        {' · '}{formatDateShort(doc.created_at)}
                      </p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Messages Tab ── */}
        {activeTab === 'messages' && (
          <MatterMessageThread
            matterId={caseId}
            senderRole="client"
            senderName={caseDetail?.name ?? 'Client'}
            caseName={caseDetail?.service ?? undefined}
          />
        )}

        {/* ── Invoices Tab ── */}
        {activeTab === 'invoices' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoices</h2>
              <Link href="/portal/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                View All Invoices →
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoices.map((inv) => {
                  const cfg = INVOICE_STATUS_CONFIG[inv.status] ?? INVOICE_STATUS_CONFIG['draft'];
                  const balance = inv.amount - (inv.amount_paid ?? 0);
                  return (
                    <div key={inv.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">{inv.invoice_number}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {inv.due_date ? `Due ${formatDateShort(inv.due_date)}` : `Issued ${formatDateShort(inv.created_at)}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                        {balance > 0 && inv.status !== 'paid' && (
                          <p className="text-[11px] text-amber-600">Balance: {formatCurrency(balance, inv.currency)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tasks Tab ── */}
        {activeTab === 'tasks' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Linked Tasks</h2>
            </div>
            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No tasks linked to this case</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task) => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['medium'];
                  const statusCfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG['todo'];
                  return (
                    <div key={task.id} className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityCfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${priorityCfg.color}`}>
                            {priorityCfg.label}
                          </span>
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                        {task.due_date && (
                          <p className={`text-[11px] mt-1 ${new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-600' : 'text-muted-foreground'}`}>
                            Due {formatDateShort(task.due_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Case Notes Tab ── */}
        {activeTab === 'notes' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
              </svg>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attorney Case Notes</h2>
            </div>
            {caseNotes.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No case notes available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Your attorney will share case notes here as your matter progresses.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {caseNotes.map((note) => (
                  <div key={note.id} className="px-5 py-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{note.author}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateShort(note.notion_synced_at ?? note.created_at)}
                      </span>
                      {note.source === 'notion' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-purple-50 text-purple-700 border-purple-200 ml-auto">
                          ◆ Notion
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
