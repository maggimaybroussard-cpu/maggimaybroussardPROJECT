'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalDashboardView } from '@/lib/analytics';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Inquiry {
  id: string;
  name: string;
  service: string;
  status: string;
  booking_stage: string;
  created_at: string;
  updated_at: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  due_date: string;
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
  case_name: string | null;
  created_at: string;
}

interface Milestone {
  label: string;
  completed: boolean;
  active: boolean;
  date?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  intake: { label: 'Intake', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', dot: '#2563EB' },
  active: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)', dot: '#355E3B' },
  active_client: { label: 'Active', color: '#355E3B', bg: 'rgba(53,94,59,0.08)', dot: '#355E3B' },
  billed: { label: 'Billed', color: '#C8965A', bg: 'rgba(200,150,90,0.08)', dot: '#C8965A' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', dot: '#6B7280' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

function resolveStage(inquiry: Inquiry): string {
  const raw = (inquiry.booking_stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  if (inquiry.status === 'new' || inquiry.status === 'in_review') return 'intake';
  if (inquiry.status === 'contacted') return 'active';
  if (inquiry.status === 'closed') return 'closed';
  return 'intake';
}

function getMilestones(inquiry: Inquiry): Milestone[] {
  const stage = resolveStage(inquiry);
  const stageOrder = ['intake', 'active', 'billed', 'closed'];
  const stageIdx = stageOrder.indexOf(stage === 'active_client' ? 'active' : stage);
  return [
    { label: 'Inquiry Submitted', completed: true, active: stageIdx === 0, date: inquiry.created_at },
    { label: 'Case Active', completed: stageIdx >= 1, active: stageIdx === 1, date: null },
    { label: 'Work Billed', completed: stageIdx >= 2, active: stageIdx === 2, date: null },
    { label: 'Engagement Closed', completed: stageIdx >= 3, active: stageIdx === 3, date: null },
  ];
}

function getNextMilestone(inquiry: Inquiry): { label: string; date: string | null } | null {
  const stage = resolveStage(inquiry);
  if (stage === 'intake') {
    if (inquiry.calendly_start_time) {
      return { label: inquiry.calendly_event_name ?? 'Consultation', date: inquiry.calendly_start_time };
    }
    return { label: 'Schedule Initial Consultation', date: null };
  }
  if (stage === 'active' || stage === 'active_client') return { label: 'Receive Work Product', date: null };
  if (stage === 'billed') return { label: 'Settle Outstanding Invoices', date: null };
  return null;
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
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
    href: '/portal/case-status',
    label: 'Case Status',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
    href: '/portal/hub',
    label: 'Client Hub',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/portal/messages',
    label: 'Messages',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
    href: '/portal/signatures',
    label: 'Signatures',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: '/portal/book',
    label: 'Book Appointment',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientHomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveFlash, setLiveFlash] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      const [inquiryRes, invoicesRes, messagesRes, tasksRes] = await Promise.all([
        inquiryId
          ? supabase
              .from('contact_inquiries')
              .select('id,name,service,status,booking_stage,created_at,updated_at,calendly_start_time,calendly_event_name')
              .eq('id', inquiryId)
              .single()
          : Promise.resolve({ data: null, error: null }),
        inquiryId
          ? supabase
              .from('client_invoices')
              .select('id,invoice_number,due_date,amount,amount_paid,currency,status,created_at')
              .eq('inquiry_id', inquiryId)
              .order('created_at', { ascending: false })
          : supabase
              .from('client_invoices')
              .select('id,invoice_number,due_date,amount,amount_paid,currency,status,created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
        inquiryId
          ? supabase
              .from('portal_messages')
              .select('id,sender_role,body,read_at,created_at')
              .eq('inquiry_id', inquiryId)
              .order('created_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        inquiryId
          ? supabase
              .from('admin_tasks')
              .select('id,title,description,priority,status,due_date,case_name,created_at')
              .eq('case_id', inquiryId)
              .neq('status', 'done')
              .order('due_date', { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (inquiryRes.data) setInquiry(inquiryRes.data);
      setInvoices(invoicesRes.data || []);
      setMessages(messagesRes.data || []);
      setTasks(tasksRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  // First-login onboarding redirect
  useEffect(() => {
    if (!user || authLoading) return;
    const key = `onboarding_complete_${user.id}`;
    try {
      const done = localStorage.getItem(key);
      if (!done) {
        // Check if onboarding record exists and is complete
        const supabase = createClient();
        supabase
          .from('client_onboarding')
          .select('onboarding_complete')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data || !data.onboarding_complete) {
              router.replace('/portal/onboarding');
            } else {
              localStorage.setItem(key, 'true');
            }
          })
          .catch(() => {
            // If table doesn't exist or error, skip redirect
          });
      }
    } catch {
      // ignore localStorage errors
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Realtime: messages + invoices
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
          .channel('home-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages', filter: `inquiry_id=eq.${inquiryId}` }, () => fetchData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'client_invoices', filter: `inquiry_id=eq.${inquiryId}` }, (payload) => {
            const newRow = payload.new as { status?: string; invoice_number?: string };
            const oldRow = payload.old as { status?: string };
            if (payload.eventType === 'INSERT') {
              setLiveFlash(`New invoice posted: ${newRow.invoice_number ?? ''}`);
            } else if (payload.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
              if (newRow.status === 'paid') {
                setLiveFlash(`Invoice ${newRow.invoice_number ?? ''} has been paid`);
              } else {
                setLiveFlash(`Invoice ${newRow.invoice_number ?? ''} updated`);
              }
            }
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks', filter: `case_id=eq.${inquiryId}` }, () => fetchData())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contact_inquiries', filter: `id=eq.${inquiryId}` }, (payload) => {
            const newRow = payload.new as { booking_stage?: string; status?: string };
            const oldRow = payload.old as { booking_stage?: string; status?: string };
            if (newRow.booking_stage !== oldRow?.booking_stage) {
              const stageLabels: Record<string, string> = {
                inquiry: 'Inquiry', consultation_booked: 'Consultation Booked',
                proposal_sent: 'Proposal Sent', active_client: 'Active Client',
                completed: 'Completed', closed: 'Closed',
              };
              setLiveFlash(`Your case has advanced to: ${stageLabels[newRow.booking_stage ?? ''] ?? newRow.booking_stage}`);
            }
            fetchData();
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'case_documents', filter: `inquiry_id=eq.${inquiryId}` }, (payload) => {
            const newRow = payload.new as { deliverable_status?: string; file_name?: string };
            const oldRow = payload.old as { deliverable_status?: string };
            if (newRow.deliverable_status !== oldRow?.deliverable_status && newRow.deliverable_status === 'approved') {
              setLiveFlash(`Deliverable approved: ${newRow.file_name ?? 'Document'}`);
              fetchData();
            }
          })
          .subscribe();

        return () => { supabase.removeChannel(ch); };
      });
  }, [user, fetchData]);

  // Auto-clear flash message
  useEffect(() => {
    if (!liveFlash) return;
    const t = setTimeout(() => setLiveFlash(null), 5000);
    return () => clearTimeout(t);
  }, [liveFlash]);

  useEffect(() => {
    if (!loading && user && messages.length >= 0) {
      const unread = messages.filter(m => m.sender_role === 'admin' && !m.read_at).length;
      trackPortalDashboardView(messages.length, unread);
    }
  }, [loading, user, messages]);

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
  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue');
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const unreadMessages = messages.filter((m) => m.sender_role === 'admin' && !m.read_at);
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const nextMilestone = inquiry ? getNextMilestone(inquiry) : null;
  const milestones = inquiry ? getMilestones(inquiry) : [];
  const stage = inquiry ? resolveStage(inquiry) : null;
  const stageCfg = stage ? (STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake']) : null;

  // Next due date: earliest pending invoice or consultation
  const upcomingDates: { label: string; date: string; urgent: boolean }[] = [];
  if (inquiry?.calendly_start_time) {
    const days = getDaysUntil(inquiry.calendly_start_time);
    if (days >= 0) upcomingDates.push({ label: inquiry.calendly_event_name ?? 'Consultation', date: inquiry.calendly_start_time, urgent: days <= 2 });
  }
  pendingInvoices.forEach((inv) => {
    if (inv.due_date) {
      const days = getDaysUntil(inv.due_date);
      if (days >= -7) upcomingDates.push({ label: `Invoice ${inv.invoice_number}`, date: inv.due_date, urgent: days <= 3 });
    }
  });
  activeTasks.forEach((t) => {
    if (t.due_date) {
      const days = getDaysUntil(t.due_date);
      if (days >= 0 && days <= 7) upcomingDates.push({ label: t.title, date: t.due_date, urgent: days <= 1 });
    }
  });
  upcomingDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextDueDate = upcomingDates[0] ?? null;

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
        <main className="max-w-5xl mx-auto px-5 md:px-8 py-10">
          <div className="mb-8">
            <div className="w-40 h-4 bg-muted/50 rounded animate-pulse mb-3" />
            <div className="w-64 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`bg-card border border-border rounded-2xl p-5 ${i === 1 ? 'md:col-span-2 xl:col-span-1' : ''}`}>
                <div className="w-28 h-3 bg-muted/50 rounded animate-pulse mb-4" />
                <div className="space-y-2.5">
                  {[1, 2].map((j) => (
                    <div key={j} className="w-full h-10 bg-muted/40 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">{user?.email}</span>
              {/* Mobile menu toggle */}
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

          {/* Mobile nav dropdown */}
          {mobileNavOpen && (
            <div className="lg:hidden border-t border-border/60 py-3 flex flex-wrap gap-2 pb-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* ── Live Update Banner ── */}
        {liveFlash && (
          <div className="flex items-center gap-2 px-4 py-2.5 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span>{liveFlash}</span>
            <button onClick={() => setLiveFlash(null)} className="ml-auto text-emerald-500 hover:text-emerald-700 text-xs">✕</button>
          </div>
        )}

        {/* ── Welcome header ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-serif tracking-tight text-foreground">
            {inquiry?.name ? inquiry.name.split(' ')[0] : user?.email?.split('@')[0] ?? 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Here&apos;s a summary of your active matters and pending items.
          </p>
        </div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* ── 1. Active Case ── */}
          <div className="xl:col-span-1 md:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
            {inquiry && stageCfg ? (
              <>
                <div
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ background: stageCfg.bg, borderBottom: `1px solid ${stageCfg.dot}22` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stageCfg.dot}22` }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: stageCfg.color }}>Active Case</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                    style={{ background: `${stageCfg.dot}22`, color: stageCfg.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.dot }} />
                    {stageCfg.label}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-base font-semibold text-foreground leading-snug">{inquiry.service}</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">Since {formatDateShort(inquiry.created_at)}</p>
                  </div>
                  {/* Stage progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Stage Progress</p>
                      <p className="text-[11px] text-muted-foreground">{milestones.filter((m) => m.completed).length}/{milestones.length}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {milestones.map((m, i) => (
                        <div
                          key={i}
                          className="flex-1 h-1.5 rounded-full transition-all duration-500"
                          style={{ background: m.completed ? stageCfg.dot : 'rgba(0,0,0,0.08)' }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: m.completed ? stageCfg.dot : 'rgba(0,0,0,0.06)' }}
                          >
                            {m.completed ? (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                          <p className={`text-xs ${m.completed ? 'text-foreground font-medium' : 'text-muted-foreground font-light'}`}>{m.label}</p>
                          {m.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${stageCfg.dot}22`, color: stageCfg.color }}>Current</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/portal/cases"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ color: stageCfg.color }}
                  >
                    View case details
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              </>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Active Case</p>
                </div>
                <p className="text-sm text-muted-foreground font-light">No active case found.</p>
                <Link href="/portal/intake" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold" style={{ color: '#355E3B' }}>
                  Start a new intake
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
                <Link href="/portal/intake-questionnaire" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: '#C8965A' }}>
                  Or use our guided questionnaire
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              </div>
            )}
          </div>

          {/* ── 2. Pending Invoices ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(200,150,90,0.1)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C8965A' }}>Pending Invoices</p>
              </div>
              {pendingInvoices.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: overdueInvoices.length > 0 ? '#DC2626' : '#C8965A' }}>
                  {pendingInvoices.length}
                </span>
              )}
            </div>
            <div className="p-5">
              {pendingInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-emerald-700">All invoices settled</p>
                  <p className="text-[11px] text-muted-foreground font-light mt-0.5">No outstanding balance</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingInvoices.slice(0, 3).map((inv) => {
                    const isOverdue = inv.status === 'overdue';
                    const daysUntil = inv.due_date ? getDaysUntil(inv.due_date) : null;
                    const balance = inv.amount - (inv.amount_paid ?? 0);
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors hover:bg-muted/20"
                        style={{ borderColor: isOverdue ? 'rgba(220,38,38,0.2)' : 'rgba(200,150,90,0.15)', background: isOverdue ? 'rgba(220,38,38,0.03)' : 'transparent' }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{inv.invoice_number}</p>
                          <p className="text-[11px] text-muted-foreground font-light mt-0.5">
                            {inv.due_date
                              ? isOverdue
                                ? `Overdue · ${formatDateShort(inv.due_date)}`
                                : daysUntil === 0
                                ? 'Due today'
                                : daysUntil === 1
                                ? 'Due tomorrow'
                                : `Due ${formatDateShort(inv.due_date)}`
                              : 'No due date'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold" style={{ color: isOverdue ? '#DC2626' : '#C8965A' }}>
                            {formatCurrency(balance, inv.currency)}
                          </p>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{
                              background: isOverdue ? 'rgba(220,38,38,0.1)' : 'rgba(200,150,90,0.1)',
                              color: isOverdue ? '#DC2626' : '#C8965A',
                            }}
                          >
                            {isOverdue ? 'Overdue' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {pendingInvoices.length > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{pendingInvoices.length - 3} more</p>
                  )}
                  <Link
                    href="/portal/invoices"
                    className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90"
                    style={{ background: 'rgba(200,150,90,0.1)', color: '#C8965A' }}
                  >
                    View &amp; Pay Invoices
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── 3. Unread Messages ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#2563EB' }}>Messages</p>
              </div>
              {unreadMessages.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: '#2563EB' }}>
                  {unreadMessages.length}
                </span>
              )}
            </div>
            <div className="p-5">
              {unreadMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-blue-700">No unread messages</p>
                  <p className="text-[11px] text-muted-foreground font-light mt-0.5">You&apos;re all caught up</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {unreadMessages.slice(0, 3).map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-xl border transition-colors hover:bg-muted/20"
                      style={{ borderColor: 'rgba(37,99,235,0.15)', background: 'rgba(37,99,235,0.03)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#2563EB' }} />
                        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#2563EB' }}>From Maggi May</p>
                        <p className="text-[10px] text-muted-foreground ml-auto">{formatDateShort(msg.created_at)}</p>
                      </div>
                      <p className="text-xs text-foreground font-light leading-relaxed line-clamp-2">{msg.body}</p>
                    </div>
                  ))}
                  {unreadMessages.length > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{unreadMessages.length - 3} more unread</p>
                  )}
                </div>
              )}
              <Link
                href="/portal/messages"
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}
              >
                Open Messages
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* ── 4. Assigned Tasks ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#7C3AED' }}>Assigned Tasks</p>
              </div>
              {activeTasks.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: '#7C3AED' }}>
                  {activeTasks.length}
                </span>
              )}
            </div>
            <div className="p-5">
              {activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(124,58,237,0.08)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: '#7C3AED' }}>No pending tasks</p>
                  <p className="text-[11px] text-muted-foreground font-light mt-0.5">Nothing assigned right now</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeTasks.slice(0, 3).map((task) => {
                    const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['medium'];
                    const isOverdue = task.due_date ? getDaysUntil(task.due_date) < 0 : false;
                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl border border-border/60 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground leading-snug flex-1">{task.title}</p>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${pCfg.color}`}>
                            <span className={`w-1 h-1 rounded-full ${pCfg.dot}`} />
                            {pCfg.label}
                          </span>
                        </div>
                        {task.due_date && (
                          <p className={`text-[11px] font-light mt-1 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {isOverdue ? '⚠ Overdue · ' : 'Due '}
                            {formatDateShort(task.due_date)}
                          </p>
                        )}
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground font-light mt-1 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    );
                  })}
                  {activeTasks.length > 3 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">+{activeTasks.length - 3} more tasks</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Next Milestone & Due Date ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border/60">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>Next Milestone</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Next milestone */}
              {nextMilestone ? (
                <div className="p-3.5 rounded-xl border" style={{ borderColor: 'rgba(53,94,59,0.2)', background: 'rgba(53,94,59,0.04)' }}>
                  <p className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#355E3B' }}>Upcoming</p>
                  <p className="text-sm font-semibold text-foreground">{nextMilestone.label}</p>
                  {nextMilestone.date && (
                    <p className="text-xs text-muted-foreground font-light mt-1">{formatDateShort(nextMilestone.date)}</p>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-border/60 text-center">
                  <p className="text-xs text-muted-foreground font-light">No upcoming milestones</p>
                </div>
              )}

              {/* Next due date */}
              {nextDueDate && (
                <div
                  className="p-3.5 rounded-xl border"
                  style={{
                    borderColor: nextDueDate.urgent ? 'rgba(220,38,38,0.25)' : 'rgba(200,150,90,0.2)',
                    background: nextDueDate.urgent ? 'rgba(220,38,38,0.04)' : 'rgba(200,150,90,0.04)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {nextDueDate.urgent && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    <p
                      className="text-[11px] uppercase tracking-widest font-semibold"
                      style={{ color: nextDueDate.urgent ? '#DC2626' : '#C8965A' }}
                    >
                      {nextDueDate.urgent ? 'Urgent Deadline' : 'Next Due Date'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{nextDueDate.label}</p>
                  <p className="text-xs font-light mt-1" style={{ color: nextDueDate.urgent ? '#DC2626' : '#C8965A' }}>
                    {formatDateShort(nextDueDate.date)}
                    {(() => {
                      const d = getDaysUntil(nextDueDate.date);
                      if (d === 0) return ' · Today';
                      if (d === 1) return ' · Tomorrow';
                      if (d < 0) return ` · ${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} overdue`;
                      return ` · ${d} day${d !== 1 ? 's' : ''} away`;
                    })()}
                  </p>
                </div>
              )}

              {/* Upcoming dates list */}
              {upcomingDates.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">All Upcoming</p>
                  {upcomingDates.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
                      <p className="text-xs text-foreground font-light truncate flex-1">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground shrink-0">{formatDateShort(item.date)}</p>
                    </div>
                  ))}
                </div>
              )}

              {!nextMilestone && upcomingDates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <p className="text-xs text-muted-foreground font-light">No upcoming deadlines</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Quick links ── */}
        <div className="mt-6 pt-6 border-t border-border/60">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Quick Access</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/portal/cases', label: 'My Cases', color: '#355E3B' },
              { href: '/portal/case-status', label: 'Case Status', color: '#355E3B' },
              { href: '/portal/hub', label: 'Client Hub', color: '#2563EB' },
              { href: '/portal/invoices', label: 'Invoices', color: '#C8965A' },
              { href: '/portal/messages', label: 'Messages', color: '#2563EB' },
              { href: '/portal/documents', label: 'Documents', color: '#6B7280' },
              { href: '/portal/signatures', label: 'Signatures', color: '#7C3AED' },
              { href: '/portal/retainer', label: 'Retainer', color: '#0891B2' },
              { href: '/portal/notifications', label: 'Notifications', color: '#059669' },
              { href: '/portal/settings', label: 'Settings', color: '#6B7280' },
              { href: '/portal/welcome', label: 'Portal Guide', color: '#C8965A' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 hover:opacity-80"
                style={{ borderColor: `${link.color}30`, color: link.color, background: `${link.color}08` }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Mobile App Download ── */}
        <div className="mt-6 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2.5 border-b border-border/60" style={{ background: 'rgba(53,94,59,0.04)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>Mobile App Access</p>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'rgba(200,150,90,0.15)', color: '#C8965A' }}>
              Free
            </span>
          </div>
          <div className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">Access your portal on any device</p>
                <p className="text-xs text-muted-foreground font-light leading-relaxed mb-4">
                  Install the Broussard Legal app on your phone or tablet for instant access to your cases, documents, invoices, and messages — no app store required.
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* iOS / Safari install instructions */}
                  <a
                    href="/portal/dashboard"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 hover:opacity-80"
                    style={{ borderColor: 'rgba(53,94,59,0.25)', color: '#355E3B', background: 'rgba(53,94,59,0.06)' }}
                    title="On iPhone/iPad: tap Share → Add to Home Screen"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/>
                    </svg>
                    iOS — Add to Home Screen
                  </a>
                  {/* Android / Chrome install */}
                  <a
                    href="/portal/dashboard"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 hover:opacity-80"
                    style={{ borderColor: 'rgba(200,150,90,0.25)', color: '#C8965A', background: 'rgba(200,150,90,0.06)' }}
                    title="On Android: tap menu (⋮) → Add to Home Screen"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                    Android — Install App
                  </a>
                  {/* Desktop */}
                  <a
                    href="/portal/dashboard"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 hover:opacity-80"
                    style={{ borderColor: 'rgba(107,114,128,0.2)', color: '#6B7280', background: 'rgba(107,114,128,0.05)' }}
                    title="On desktop Chrome/Edge: click install icon in address bar"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                    Desktop — Install
                  </a>
                </div>
              </div>
              {/* Install steps */}
              <div className="shrink-0 bg-secondary/60 border border-border rounded-xl p-4 min-w-[180px]">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2.5">How to install</p>
                {[
                  { icon: '1', text: 'Open this page in your browser' },
                  { icon: '2', text: 'Tap Share or menu (⋮)' },
                  { icon: '3', text: 'Select "Add to Home Screen"' },
                  { icon: '4', text: 'Tap Add — done!' },
                ].map(({ icon, text }) => (
                  <div key={icon} className="flex items-start gap-2 mb-2 last:mb-0">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}>{icon}</span>
                    <p className="text-[11px] text-muted-foreground leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
