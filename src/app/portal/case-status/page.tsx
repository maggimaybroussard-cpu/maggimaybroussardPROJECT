'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDetail {
  id: string;
  name: string;
  service: string;
  status: string;
  booking_stage: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
  assigned_paralegal: string | null;
  suggested_service: string | null;
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

interface PortalMessage {
  id: string;
  sender_role: 'client' | 'admin';
  body: string;
  read_at: string | null;
  created_at: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(dateStr);
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; ring: string; order: number; description: string }> = {
  intake: {
    label: 'Intake',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.07)',
    dot: '#2563EB',
    ring: 'rgba(37,99,235,0.18)',
    order: 0,
    description: 'Gathering information and reviewing your matter.',
  },
  active: {
    label: 'Active',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.07)',
    dot: '#355E3B',
    ring: 'rgba(53,94,59,0.18)',
    order: 1,
    description: 'Your case is actively being worked on.',
  },
  active_client: {
    label: 'Active',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.07)',
    dot: '#355E3B',
    ring: 'rgba(53,94,59,0.18)',
    order: 1,
    description: 'Your case is actively being worked on.',
  },
  billed: {
    label: 'Billed',
    color: '#C8965A',
    bg: 'rgba(200,150,90,0.07)',
    dot: '#C8965A',
    ring: 'rgba(200,150,90,0.18)',
    order: 2,
    description: 'Work is complete and invoices have been issued.',
  },
  closed: {
    label: 'Closed',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.07)',
    dot: '#6B7280',
    ring: 'rgba(107,114,128,0.18)',
    order: 3,
    description: 'Your engagement has been completed.',
  },
};

const STAGE_ORDER = ['intake', 'active', 'billed', 'closed'];
const STAGE_LABELS = ['Intake', 'Active', 'Billed', 'Closed'];

function resolveStage(c: CaseDetail): string {
  const raw = (c.booking_stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  if (c.status === 'new' || c.status === 'in_review') return 'intake';
  if (c.status === 'contacted') return 'active';
  if (c.status === 'closed') return 'closed';
  return 'intake';
}

const PARALEGAL_PROFILES: Record<string, { initials: string; specialty: string; color: string }> = {
  'Sarah Chen': { initials: 'SC', specialty: 'Litigation & Discovery', color: '#355E3B' },
  'Marcus Williams': { initials: 'MW', specialty: 'Contract Review', color: '#2563EB' },
  'Elena Rodriguez': { initials: 'ER', specialty: 'Legal Research', color: '#7C3AED' },
  'James Okafor': { initials: 'JO', specialty: 'Document Drafting', color: '#C8965A' },
  'Priya Patel': { initials: 'PP', specialty: 'Case Management', color: '#0891B2' },
};

function getParalegalProfile(name: string | null) {
  if (!name) return null;
  return PARALEGAL_PROFILES[name] ?? {
    initials: name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
    specialty: 'Legal Support',
    color: '#355E3B',
  };
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-slate-500' },
  sent: { label: 'Sent', color: 'text-blue-600' },
  pending: { label: 'Pending', color: 'text-amber-600' },
  paid: { label: 'Paid', color: 'text-emerald-600' },
  overdue: { label: 'Overdue', color: 'text-red-600' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400' },
};

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/case-status', label: 'Case Status' },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/documents', label: 'Documents' },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseStatusDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveFlash, setLiveFlash] = useState(false);
  const [stageChangeToast, setStageChangeToast] = useState<string | null>(null);
  const prevStageRef = React.useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;
      if (!inquiryId) { setLoading(false); return; }

      const [caseRes, timelineRes, invoicesRes, messagesRes, tasksRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id,name,service,status,booking_stage,notes,created_at,updated_at,calendly_start_time,calendly_event_name,assigned_paralegal,suggested_service')
          .eq('id', inquiryId)
          .single(),
        supabase
          .from('case_timeline')
          .select('id,event_title,event_description,event_date')
          .eq('inquiry_id', inquiryId)
          .order('event_date', { ascending: false })
          .limit(10),
        supabase
          .from('client_invoices')
          .select('id,invoice_number,due_date,amount,amount_paid,currency,status,created_at')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('portal_messages')
          .select('id,sender_role,body,read_at,created_at')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('admin_tasks')
          .select('id,title,description,priority,status,due_date,created_at')
          .eq('case_id', inquiryId)
          .neq('status', 'done')
          .order('due_date', { ascending: true })
          .limit(6),
      ]);

      if (caseRes.data) setCaseDetail(caseRes.data);
      setTimeline(timelineRes.data || []);
      setInvoices(invoicesRes.data || []);
      setMessages(messagesRes.data || []);
      setTasks(tasksRes.data || []);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const inquiryId = data?.inquiry_id ?? null;
        if (!inquiryId) return;

        const ch = supabase
          .channel('case-status-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_inquiries', filter: `id=eq.${inquiryId}` }, (payload) => {
            const updated = payload.new as Record<string, unknown>;
            const prevStage = prevStageRef.current;
            const newStage = updated?.booking_stage ? String(updated.booking_stage) : null;

            // Show toast if stage changed
            if (newStage && prevStage !== newStage) {
              const STAGE_LABELS_MAP: Record<string, string> = {
                inquiry: 'Inquiry',
                intake: 'Intake',
                consultation: 'Consultation',
                proposal_sent: 'Proposal Sent',
                active_client: 'Active',
                active: 'Active',
                billed: 'Billed',
                closed: 'Closed',
              };
              const label = STAGE_LABELS_MAP[newStage] ?? newStage;
              setStageChangeToast(`Your case has moved to: ${label}`);
              setTimeout(() => setStageChangeToast(null), 5000);
            }

            fetchData();
            setLiveFlash(true);
            setTimeout(() => setLiveFlash(false), 2000);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'case_timeline', filter: `inquiry_id=eq.${inquiryId}` }, () => {
            fetchData();
            setLiveFlash(true);
            setTimeout(() => setLiveFlash(false), 2000);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages', filter: `inquiry_id=eq.${inquiryId}` }, (payload) => {
            const msg = payload.new as Record<string, unknown>;
            if (msg?.sender_role === 'admin') {
              setStageChangeToast('New message from your attorney');
              setTimeout(() => setStageChangeToast(null), 5000);
            }
            fetchData();
            setLiveFlash(true);
            setTimeout(() => setLiveFlash(false), 2000);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks', filter: `case_id=eq.${inquiryId}` }, () => {
            fetchData();
          })
          .subscribe();

        return () => { supabase.removeChannel(ch); };
      });
  }, [user, fetchData]);

  // Track stage changes for toast
  useEffect(() => {
    if (caseDetail) {
      prevStageRef.current = caseDetail.booking_stage;
    }
  }, [caseDetail]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const stage = caseDetail ? resolveStage(caseDetail) : 'intake';
  const stageCfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake'];
  const stageIdx = STAGE_ORDER.indexOf(stage === 'active_client' ? 'active' : stage);
  const progressPct = ((stageIdx + 1) / STAGE_ORDER.length) * 100;
  const paralegalProfile = getParalegalProfile(caseDetail?.assigned_paralegal ?? null);
  const unreadMessages = messages.filter((m) => m.sender_role === 'admin' && !m.read_at);
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'pending');

  const milestones = [
    { label: 'Inquiry Submitted', completed: true, active: stageIdx === 0, date: caseDetail?.created_at ?? null },
    { label: 'Case Active', completed: stageIdx >= 1, active: stageIdx === 1, date: null },
    { label: 'Work Billed', completed: stageIdx >= 2, active: stageIdx === 2, date: null },
    { label: 'Engagement Closed', completed: stageIdx >= 3, active: stageIdx === 3, date: null },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
            <div className="w-28 h-6 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-5 md:px-8 py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6">
              <div className="w-32 h-3 bg-muted/50 rounded animate-pulse mb-4" />
              <div className="space-y-2">
                <div className="w-full h-8 bg-muted/40 rounded-xl animate-pulse" />
                <div className="w-3/4 h-8 bg-muted/30 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Stage change toast */}
      {stageChangeToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-emerald-200 bg-white max-w-sm animate-in slide-in-from-top-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Case Updated</p>
            <p className="text-xs text-muted-foreground truncate">{stageChangeToast}</p>
          </div>
          <button
            onClick={() => setStageChangeToast(null)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                    item.href === '/portal/case-status' ?'border-border bg-muted/40 text-foreground' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">{user?.email}</span>
              <button
                onClick={() => setMobileNavOpen((o) => !o)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Menu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileNavOpen && (
            <div className="lg:hidden border-t border-border/60 py-3 flex flex-wrap gap-2 pb-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Case Status</p>
            <h1 className="text-2xl md:text-3xl font-serif tracking-tight text-foreground">
              {caseDetail?.name ? `${caseDetail.name.split(' ')[0]}'s Case` : 'Your Case Status'}
            </h1>
            <p className="text-sm text-muted-foreground font-light mt-1">
              {caseDetail?.service ?? 'Legal Services'} · Real-time updates
            </p>
          </div>
          {/* Live indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 shrink-0 ${
            liveFlash
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :'border-border bg-card text-muted-foreground'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${liveFlash ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
            Live
          </div>
        </div>

        {/* ── No case state ── */}
        {!caseDetail && (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No active case found</p>
            <p className="text-xs text-muted-foreground mb-5">Your case will appear here once your portal access is linked to an inquiry.</p>
            <Link href="/contact" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white transition-all duration-200" style={{ background: '#355E3B' }}>
              Contact Us
            </Link>
          </div>
        )}

        {caseDetail && (
          <>
            {/* ── Alerts ── */}
            {(overdueInvoices.length > 0 || unreadMessages.length > 0) && (
              <div className="space-y-2">
                {overdueInvoices.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-xs text-red-700 font-medium flex-1">
                      {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — payment required
                    </p>
                    <Link href="/portal/invoices" className="text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2">
                      Pay now
                    </Link>
                  </div>
                )}
                {unreadMessages.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="text-xs text-blue-700 font-medium flex-1">
                      {unreadMessages.length} unread message{unreadMessages.length > 1 ? 's' : ''} from your paralegal
                    </p>
                    <Link href="/portal/messages" className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2">
                      View
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── Left column: Stage + Milestones ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Stage Progress Card */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ background: stageCfg.bg, borderBottom: `1px solid ${stageCfg.ring}` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: stageCfg.ring }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: stageCfg.color }}>Case Stage</p>
                        <p className="text-xs text-muted-foreground font-light mt-0.5">{stageCfg.description}</p>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest shrink-0"
                      style={{ background: stageCfg.ring, color: stageCfg.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.dot }} />
                      {stageCfg.label}
                    </span>
                  </div>

                  <div className="p-6">
                    {/* Stage pipeline */}
                    <div className="flex items-center gap-0 mb-6">
                      {STAGE_ORDER.map((s, i) => {
                        const cfg = STAGE_CONFIG[s];
                        const normalizedStage = stage === 'active_client' ? 'active' : stage;
                        const isCompleted = i <= stageIdx;
                        const isCurrent = s === normalizedStage;
                        return (
                          <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-1.5 flex-1">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                                style={{
                                  background: isCompleted ? cfg.dot : 'transparent',
                                  border: `2px solid ${isCompleted ? cfg.dot : '#E5E7EB'}`,
                                  color: isCompleted ? '#fff' : '#9CA3AF',
                                  boxShadow: isCurrent ? `0 0 0 4px ${cfg.ring}` : 'none',
                                }}
                              >
                                {isCompleted && !isCurrent ? (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <span>{i + 1}</span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-center leading-tight" style={{ color: isCompleted ? cfg.color : '#9CA3AF' }}>
                                {STAGE_LABELS[i]}
                              </span>
                            </div>
                            {i < STAGE_ORDER.length - 1 && (
                              <div
                                className="h-0.5 flex-1 mb-5 transition-all duration-500"
                                style={{ background: i < stageIdx ? stageCfg.dot : '#E5E7EB' }}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Overall progress</span>
                      <span className="text-xs font-semibold" style={{ color: stageCfg.color }}>{Math.round(progressPct)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%`, background: stageCfg.dot }}
                      />
                    </div>

                    {/* Last updated */}
                    {lastUpdated && (
                      <p className="text-[10px] text-muted-foreground mt-3 text-right">
                        Last synced {formatTimeAgo(lastUpdated.toISOString())}
                      </p>
                    )}
                  </div>
                </div>

                {/* Milestones Card */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Milestones</p>
                    <span className="text-xs text-muted-foreground font-light">
                      {milestones.filter((m) => m.completed).length} of {milestones.length} complete
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="relative">
                      {/* Vertical connector line */}
                      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border/60" />
                      <div className="space-y-5">
                        {milestones.map((m, i) => (
                          <div key={i} className="flex items-start gap-4 relative">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-300"
                              style={{
                                background: m.completed ? stageCfg.dot : m.active ? stageCfg.ring : '#F3F4F6',
                                border: `2px solid ${m.completed ? stageCfg.dot : m.active ? stageCfg.dot : '#E5E7EB'}`,
                                boxShadow: m.active ? `0 0 0 3px ${stageCfg.ring}` : 'none',
                              }}
                            >
                              {m.completed ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : m.active ? (
                                <span className="w-2 h-2 rounded-full" style={{ background: stageCfg.dot }} />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 pt-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-medium ${m.completed ? 'text-foreground' : m.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {m.label}
                                </p>
                                {m.active && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: stageCfg.ring, color: stageCfg.color }}>
                                    Current
                                  </span>
                                )}
                              </div>
                              {m.date && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(m.date)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline / Latest Updates */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Latest Updates</p>
                    {liveFlash && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        New update
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-border/40">
                    {/* Recent messages from admin */}
                    {messages.filter((m) => m.sender_role === 'admin').slice(0, 2).map((msg) => (
                      <div key={msg.id} className="px-6 py-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(53,94,59,0.1)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-semibold text-foreground">Message from paralegal</p>
                            {!msg.read_at && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{msg.body}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTimeAgo(msg.created_at)}</p>
                        </div>
                      </div>
                    ))}

                    {/* Timeline events */}
                    {timeline.slice(0, 3).map((event) => (
                      <div key={event.id} className="px-6 py-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: stageCfg.bg }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{event.event_title}</p>
                          {event.event_description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.event_description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDateShort(event.event_date)}</p>
                        </div>
                      </div>
                    ))}

                    {/* Case created fallback */}
                    {timeline.length === 0 && messages.filter((m) => m.sender_role === 'admin').length === 0 && (
                      <div className="px-6 py-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: stageCfg.bg }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-foreground">Inquiry submitted</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Your case has been received and is under review.</p>
                          {caseDetail.created_at && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(caseDetail.created_at)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(timeline.length > 0 || messages.filter((m) => m.sender_role === 'admin').length > 0) && (
                      <div className="px-6 py-3 flex items-center justify-between">
                        <Link href="/portal/messages" className="text-xs font-medium hover:underline underline-offset-2 transition-colors" style={{ color: stageCfg.color }}>
                          View all messages →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right column: Paralegal + Tasks + Invoices ── */}
              <div className="space-y-5">

                {/* Assigned Paralegal Card */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Assigned Paralegal</p>
                  </div>
                  <div className="p-5">
                    {paralegalProfile && caseDetail.assigned_paralegal ? (
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ background: paralegalProfile.color }}
                        >
                          {paralegalProfile.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{caseDetail.assigned_paralegal}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{paralegalProfile.specialty}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[11px] text-emerald-600 font-medium">Available</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">Maggi May Broussard</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Lead Paralegal</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[11px] text-emerald-600 font-medium">Available</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                      <Link
                        href="/portal/messages"
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-200"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Send a message
                        {unreadMessages.length > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold">
                            {unreadMessages.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/portal/documents"
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-200"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload documents
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Upcoming Tasks */}
                {tasks.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Action Items</p>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                        {tasks.length}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {tasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="px-5 py-3.5 flex items-start gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
                            {task.due_date && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Due {formatDateShort(task.due_date)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invoice Summary */}
                {invoices.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Invoices</p>
                      {(overdueInvoices.length > 0 || pendingInvoices.length > 0) && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                          {overdueInvoices.length + pendingInvoices.length}
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-border/40">
                      {invoices.slice(0, 3).map((inv) => {
                        const statusCfg = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: 'text-muted-foreground' };
                        return (
                          <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{inv.invoice_number}</p>
                              {inv.due_date && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">Due {formatDateShort(inv.due_date)}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                              <p className={`text-[10px] font-medium mt-0.5 ${statusCfg.color}`}>{statusCfg.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-border/40">
                      <Link href="/portal/invoices" className="text-xs font-medium hover:underline underline-offset-2 transition-colors" style={{ color: stageCfg.color }}>
                        View all invoices →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Consultation info */}
                {caseDetail.calendly_start_time && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/60">
                      <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Upcoming</p>
                    </div>
                    <div className="p-5 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(37,99,235,0.08)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{caseDetail.calendly_event_name ?? 'Consultation'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(caseDetail.calendly_start_time)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
