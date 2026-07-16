'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveCase {
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

interface RecentDocument {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  category: string | null;
  description: string | null;
  created_at: string;
  requires_client_review?: boolean;
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

interface RetainerInfo {
  id: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  hoursAllowance: number;
  hoursConsumed: number;
  engagements: EngagementHours[];
}

interface EngagementHours {
  id: string;
  title: string;
  matter_number: string | null;
  retainer_tier: string;
  retainer_amount: number | null;
  hoursLogged: number;
  hoursAllowance: number;
}

interface ClientActionItem {
  id: string;
  inquiry_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  priority: string;
  due_date: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTierHours(planName: string, amount: number): number {
  const nameLower = (planName ?? '').toLowerCase();
  if (nameLower.includes('essential') || amount <= 750) return 5;
  if (nameLower.includes('standard') || (amount > 750 && amount <= 1500)) return 10;
  if (nameLower.includes('premium') || (amount > 1500 && amount <= 2500)) return 20;
  if (nameLower.includes('enterprise') || amount > 2500) return 40;
  return 10;
}

function getTierLabel(planName: string, amount: number): string {
  const nameLower = (planName ?? '').toLowerCase();
  if (nameLower.includes('essential') || amount <= 750) return 'Essential';
  if (nameLower.includes('standard') || (amount > 750 && amount <= 1500)) return 'Standard';
  if (nameLower.includes('premium') || (amount > 1500 && amount <= 2500)) return 'Premium';
  if (nameLower.includes('enterprise') || amount > 2500) return 'Enterprise';
  return planName || 'Retainer';
}

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  intake: {
    label: 'Intake',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.07)',
    dot: '#2563EB',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  active: {
    label: 'Active',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.07)',
    dot: '#355E3B',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  active_client: {
    label: 'Active',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.07)',
    dot: '#355E3B',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  billed: {
    label: 'Billed',
    color: '#C8965A',
    bg: 'rgba(200,150,90,0.07)',
    dot: '#C8965A',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  closed: {
    label: 'Closed',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.07)',
    dot: '#6B7280',
    pill: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  sent: { label: 'Due', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  overdue: { label: 'Overdue', pill: 'bg-red-50 text-red-700 border-red-200' },
  paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PDF: { bg: 'bg-red-50', text: 'text-red-600' },
  DOC: { bg: 'bg-blue-50', text: 'text-blue-600' },
  DOCX: { bg: 'bg-blue-50', text: 'text-blue-600' },
  XLS: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  XLSX: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  JPEG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  PNG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  TXT: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function resolveStage(c: ActiveCase): string {
  const raw = (c.booking_stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  if (c.status === 'new' || c.status === 'in_review') return 'intake';
  if (c.status === 'contacted') return 'active';
  if (c.status === 'closed') return 'closed';
  return 'intake';
}

function getFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'FILE';
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'text/plain': 'TXT',
  };
  return map[mimeType] ?? mimeType.split('/').pop()?.toUpperCase().slice(0, 4) ?? 'FILE';
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Overview' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/documents', label: 'Documents' },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/messages', label: 'Messages' },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [activeCases, setActiveCases] = useState<ActiveCase[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [retainerInfo, setRetainerInfo] = useState<RetainerInfo | null>(null);
  const [actionItems, setActionItems] = useState<ClientActionItem[]>([]);
  const [retainerCaseInfo, setRetainerCaseInfo] = useState<{ id: string; caseNumber: string; title: string; serviceType: string | null; openedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      // Resolve inquiry_id for this client
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      // Parallel fetches
      const [casesRes, docsRes, invoicesRes, retainerRes] = await Promise.all([
        // Active cases: all non-closed inquiries linked to this client
        inquiryId
          ? supabase
              .from('contact_inquiries')
              .select('id,name,service,status,booking_stage,created_at,updated_at,calendly_start_time,calendly_event_name')
              .eq('id', inquiryId)
              .neq('status', 'closed')
          : supabase
              .from('contact_inquiries')
              .select('id,name,service,status,booking_stage,created_at,updated_at,calendly_start_time,calendly_event_name')
              .eq('email', user.email ?? '')
              .neq('status', 'closed')
              .order('created_at', { ascending: false })
              .limit(5),

        // Recent documents (last 5)
        inquiryId
          ? supabase
              .from('case_documents')
              .select('id,inquiry_id,file_name,file_url,file_type,file_size,uploaded_by,category,description,created_at,requires_client_review')
              .eq('inquiry_id', inquiryId)
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),

        // Invoices for balance calculation
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

        // Retainer subscription
        supabase
          .from('retainer_subscriptions')
          .select('id,plan_name,amount,currency,status,current_period_start,current_period_end')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const cases = (casesRes.data ?? []) as ActiveCase[];
      setActiveCases(cases);
      if (cases.length > 0 && cases[0].name) {
        setClientName(cases[0].name.split(' ')[0]);
      }
      setRecentDocuments((docsRes.data ?? []) as RecentDocument[]);
      setInvoices((invoicesRes.data ?? []) as Invoice[]);

      // Process retainer info
      const retainerSub = retainerRes.data?.[0] ?? null;
      if (retainerSub) {
        const hoursAllowance = getTierHours(retainerSub.plan_name, Number(retainerSub.amount));
        let hoursConsumed = 0;
        const periodStart = retainerSub.current_period_start;
        const periodEnd = retainerSub.current_period_end;
        const timeLogsQuery = supabase
          .from('retainer_time_logs')
          .select('hours, engagement_id')
          .eq('retainer_subscription_id', retainerSub.id);
        if (periodStart) timeLogsQuery.gte('work_date', periodStart.slice(0, 10));
        if (periodEnd) timeLogsQuery.lte('work_date', periodEnd.slice(0, 10));
        const { data: timeLogs } = await timeLogsQuery;
        if (timeLogs && timeLogs.length > 0) {
          hoursConsumed = timeLogs.reduce((sum: number, log: { hours: number }) => sum + Number(log.hours), 0);
        }

        // Fetch engagements for this case to show per-engagement breakdown
        let engagementHours: EngagementHours[] = [];
        if (inquiryId) {
          const { data: engsData } = await supabase
            .from('engagements')
            .select('id, title, matter_number, retainer_tier, retainer_amount')
            .eq('inquiry_id', inquiryId)
            .eq('status', 'active');

          if (engsData && engsData.length > 0) {
            engagementHours = engsData.map((eng: { id: string; title: string; matter_number: string | null; retainer_tier: string; retainer_amount: number | null }) => {
              const engLogs = (timeLogs ?? []).filter((l: { hours: number; engagement_id: string | null }) => l.engagement_id === eng.id);
              const engHoursLogged = engLogs.reduce((s: number, l: { hours: number }) => s + Number(l.hours), 0);
              const tierMap: Record<string, number> = { essential: 5, standard: 10, premium: 20, enterprise: 40 };
              const engAllowance = tierMap[(eng.retainer_tier ?? '').toLowerCase()] ?? (eng.retainer_amount ? Math.floor(Number(eng.retainer_amount) / 100) : 0);
              return {
                id: eng.id,
                title: eng.title,
                matter_number: eng.matter_number,
                retainer_tier: eng.retainer_tier,
                retainer_amount: eng.retainer_amount,
                hoursLogged: Math.round(engHoursLogged * 100) / 100,
                hoursAllowance: engAllowance,
              };
            }).filter((e: EngagementHours) => e.hoursLogged > 0);
          }
        }

        setRetainerInfo({
          ...retainerSub,
          hoursAllowance,
          hoursConsumed: Math.round(hoursConsumed * 100) / 100,
          engagements: engagementHours,
        });
      } else {
        setRetainerInfo(null);
      }

      // Fetch client-visible action items for this inquiry
      if (inquiryId) {
        const { data: actionItemsData } = await supabase
          .from('consultation_action_items')
          .select('id,inquiry_id,title,description,task_type,status,priority,due_date,created_at')
          .eq('inquiry_id', inquiryId)
          .eq('visible_to_client', true)
          .neq('status', 'dismissed')
          .order('created_at', { ascending: true });
        setActionItems((actionItemsData as ClientActionItem[]) ?? []);
      }

      // Fetch retainer case linked to this inquiry
      if (inquiryId) {
        const { data: rcData } = await supabase
          .from('retainer_cases')
          .select('id, case_number, title, service_type, opened_at')
          .eq('inquiry_id', inquiryId)
          .eq('status', 'active')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rcData) {
          setRetainerCaseInfo({
            id: rcData.id,
            caseNumber: rcData.case_number,
            title: rcData.title,
            serviceType: rcData.service_type ?? null,
            openedAt: rcData.opened_at,
          });
        }
      }
    } catch {
      // silent — show empty states
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login?redirectTo=/client/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const outstandingInvoices = invoices.filter(
    (i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue'
  );
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const paidInvoices = invoices.filter((i) => i.status === 'paid');

  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.amount - (inv.amount_paid ?? 0)),
    0
  );
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.amount_paid ?? inv.amount), 0);

  const pendingReviewDocs = recentDocuments.filter((d) => d.requires_client_review);

  const displayName = clientName || user?.email?.split('@')[0] || 'Welcome back';

  // ── Loading skeleton ──────────────────────────────────────────────────────

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
            <div className="w-32 h-3 bg-muted/50 rounded animate-pulse mb-3" />
            <div className="w-56 h-8 bg-muted/60 rounded-lg animate-pulse mb-2" />
            <div className="w-72 h-4 bg-muted/40 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 h-28 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`bg-card border border-border rounded-2xl p-5 h-64 animate-pulse ${i === 3 ? 'lg:col-span-2' : ''}`} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">

            {/* Logo */}
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
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">
                {user?.email}
              </span>

              {/* Mobile menu */}
              <button
                onClick={() => setMobileNavOpen((o) => !o)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Menu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {/* Sign out */}
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
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

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">

        {/* Welcome header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
            {greeting}
          </p>
          <h1 className="text-2xl md:text-3xl font-serif tracking-tight text-foreground">
            {displayName}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Your active matters, recent documents, and billing at a glance.
          </p>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

          {/* Active cases count */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Active Cases
              </span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.08)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-serif tracking-tight text-foreground">{activeCases.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCases.length === 1 ? 'open matter' : 'open matters'}
            </p>
          </div>

          {/* Outstanding balance */}
          <div className={`bg-card border rounded-2xl p-5 ${overdueInvoices.length > 0 ? 'border-red-200' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Outstanding Balance
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${overdueInvoices.length > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={overdueInvoices.length > 0 ? '#DC2626' : '#C8965A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
            </div>
            <p className={`text-3xl font-serif tracking-tight ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueInvoices.length > 0
                ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`
                : outstandingInvoices.length > 0
                ? `${outstandingInvoices.length} pending invoice${outstandingInvoices.length > 1 ? 's' : ''}`
                : 'No outstanding balance'}
            </p>
          </div>

          {/* Documents */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Documents
              </span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-serif tracking-tight text-foreground">{recentDocuments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingReviewDocs.length > 0
                ? `${pendingReviewDocs.length} pending your review`
                : 'recent documents'}
            </p>
          </div>
        </div>

        {/* ── Retainer Case Card ── */}
        {retainerCaseInfo && (
          <div className="mb-4 bg-card border border-indigo-200 rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-indigo-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">Your Retainer Case</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {retainerCaseInfo.caseNumber}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Active
              </span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">{retainerCaseInfo.title}</p>
                {retainerCaseInfo.serviceType && (
                  <p className="text-xs text-muted-foreground mt-0.5">{retainerCaseInfo.serviceType}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opened {new Date(retainerCaseInfo.openedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href="/client-deliverable-hub"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-medium border border-indigo-200 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Deliverable Hub
                </Link>
                {actionItems.length > 0 && (
                  <a
                    href="#action-items"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    {actionItems.filter((i) => i.status !== 'completed').length} Action Items
                  </a>
                )}
                <Link
                  href="/portal/cases"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Case Status
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Action Items (client-visible) ── */}
        {actionItems.length > 0 && (
          <div id="action-items" className="mb-4 bg-card border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-amber-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-foreground">Action Items</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                  {actionItems.filter((i) => i.status !== 'completed').length} pending
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Steps to move your matter forward</p>
            </div>
            <ul className="divide-y divide-border/40">
              {actionItems.map((item) => {
                const isDone = item.status === 'completed';
                const taskTypeLabels: Record<string, string> = {
                  engagement_form: 'Engagement Form',
                  retainer_call: 'Retainer Call',
                  intake_questionnaire: 'Intake Form',
                  document_preparation: 'Document Prep',
                  document_request: 'Document Request',
                  legal_review: 'Legal Review',
                  general: 'Task',
                };
                const taskLabel = taskTypeLabels[item.task_type] ?? 'Task';
                const isOverdue = item.due_date && !isDone && new Date(item.due_date) < new Date();
                return (
                  <li key={item.id} className={`flex items-start gap-3 px-5 py-3.5 ${isDone ? 'opacity-60' : ''}`}>
                    <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${isDone ? 'bg-green-500 border-green-500' : 'border-amber-400'}`}>
                      {isDone && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      {item.description && !isDone && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                          {taskLabel}
                        </span>
                        {item.due_date && (
                          <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {isOverdue ? 'Overdue · ' : 'Due '}
                            {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {isDone && (
                      <span className="shrink-0 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        Done
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Active Cases ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Active Cases</h2>
              <Link
                href="/portal/cases"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                View all
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            {activeCases.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No active cases found.</p>
                <Link
                  href="/portal/cases"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  View case history
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {activeCases.map((c) => {
                  const stage = resolveStage(c);
                  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake'];
                  const hasConsultation = !!c.calendly_start_time;
                  const consultDays = hasConsultation ? getDaysUntil(c.calendly_start_time!) : null;
                  return (
                    <li key={c.id}>
                      <Link
                        href="/portal/cases"
                        className="flex items-start gap-3.5 px-5 py-4 hover:bg-muted/30 transition-colors group"
                      >
                        {/* Stage dot */}
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: cfg.dot }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">{c.service}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.pill}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Opened {formatDateShort(c.created_at)}
                          </p>
                          {hasConsultation && consultDays !== null && consultDays >= 0 && (
                            <p className="text-xs mt-1 font-medium" style={{ color: cfg.color }}>
                              {c.calendly_event_name ?? 'Consultation'} in {consultDays === 0 ? 'today' : `${consultDays}d`}
                            </p>
                          )}
                        </div>
                        <svg
                          width="12" height="12"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-1"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Invoice Balance ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Invoice Balance</h2>
              <Link
                href="/portal/invoices"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                View all
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            {/* Retainer tier & hours panel */}
            {retainerInfo && (
              <div className="px-5 py-4 border-b border-border/60" style={{ background: 'rgba(53,94,59,0.04)' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="text-xs font-semibold text-foreground">
                      {getTierLabel(retainerInfo.plan_name, retainerInfo.amount)} Retainer
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {retainerInfo.current_period_end
                      ? `Renews ${formatDateShort(retainerInfo.current_period_end)}`
                      : retainerInfo.plan_name}
                  </span>
                </div>

                {/* Overall hours progress */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">Billable Hours This Period</span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {retainerInfo.hoursConsumed}h <span className="font-normal text-muted-foreground">/ {retainerInfo.hoursAllowance}h</span>
                    </span>
                  </div>
                  {(() => {
                    const pct = retainerInfo.hoursAllowance > 0
                      ? Math.min(100, (retainerInfo.hoursConsumed / retainerInfo.hoursAllowance) * 100)
                      : 0;
                    const barColor = pct >= 90 ? '#DC2626' : pct >= 75 ? '#D97706' : '#355E3B';
                    return (
                      <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Remaining balance row */}
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[11px] text-muted-foreground">Remaining Allowance</span>
                  <span className={`text-[11px] font-semibold ${
                    retainerInfo.hoursAllowance - retainerInfo.hoursConsumed <= 0
                      ? 'text-red-600'
                      : retainerInfo.hoursAllowance - retainerInfo.hoursConsumed <= retainerInfo.hoursAllowance * 0.25
                      ? 'text-amber-600' : 'text-emerald-700'
                  }`}>
                    {Math.max(0, Math.round((retainerInfo.hoursAllowance - retainerInfo.hoursConsumed) * 100) / 100)}h remaining
                  </span>
                </div>

                {/* Per-engagement breakdown */}
                {retainerInfo.engagements && retainerInfo.engagements.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">By Engagement</p>
                    {retainerInfo.engagements.map(eng => {
                      const engPct = eng.hoursAllowance > 0
                        ? Math.min(100, (eng.hoursLogged / eng.hoursAllowance) * 100)
                        : 0;
                      const engBarColor = engPct >= 90 ? '#DC2626' : engPct >= 75 ? '#D97706' : '#355E3B';
                      const tierLabel = eng.retainer_tier && eng.retainer_tier !== 'none'
                        ? eng.retainer_tier.charAt(0).toUpperCase() + eng.retainer_tier.slice(1)
                        : null;
                      return (
                        <div key={eng.id} className="bg-background/60 rounded-lg px-3 py-2.5 border border-border/40">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-medium text-foreground truncate">{eng.title}</span>
                              {eng.matter_number && (
                                <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{eng.matter_number}</span>
                              )}
                              {tierLabel && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  {tierLabel}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-foreground shrink-0 ml-2">
                              {eng.hoursLogged}h{eng.hoursAllowance > 0 ? ` / ${eng.hoursAllowance}h` : ''}
                            </span>
                          </div>
                          {eng.hoursAllowance > 0 && (
                            <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${engPct}%`, background: engBarColor }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Balance summary */}
            <div className="px-5 py-4 border-b border-border/60 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                <p className={`text-xl font-serif tracking-tight ${totalOutstanding > 0 ? (overdueInvoices.length > 0 ? 'text-red-600' : 'text-amber-600') : 'text-foreground'}`}>
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                <p className="text-xl font-serif tracking-tight text-emerald-700">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
            </div>

            {/* Invoice list */}
            {invoices.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">No invoices on file.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60 max-h-56 overflow-y-auto">
                {invoices.slice(0, 6).map((inv) => {
                  const statusCfg = INVOICE_STATUS_CONFIG[inv.status] ?? { label: inv.status, pill: 'bg-gray-100 text-gray-500 border-gray-200' };
                  const balance = Math.max(0, inv.amount - (inv.amount_paid ?? 0));
                  const isOverdue = inv.status === 'overdue';
                  const daysUntil = inv.due_date ? getDaysUntil(inv.due_date) : null;
                  return (
                    <li key={inv.id}>
                      <Link
                        href="/portal/invoices"
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{inv.invoice_number}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.pill}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {inv.due_date
                              ? isOverdue
                                ? `Overdue since ${formatDateShort(inv.due_date)}`
                                : daysUntil !== null && daysUntil <= 7 && daysUntil >= 0
                                ? `Due in ${daysUntil === 0 ? 'today' : `${daysUntil}d`}`
                                : `Due ${formatDateShort(inv.due_date)}`
                              : `Issued ${formatDateShort(inv.created_at)}`}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${isOverdue ? 'text-red-600' : inv.status === 'paid' ? 'text-emerald-700' : 'text-foreground'}`}>
                          {inv.status === 'paid' ? formatCurrency(inv.amount_paid ?? inv.amount) : formatCurrency(balance)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Pay now CTA if outstanding */}
            {totalOutstanding > 0 && (
              <div className="px-5 py-4 border-t border-border/60">
                <Link
                  href="/portal/invoices"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:opacity-90"
                  style={{ background: '#355E3B' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Pay Outstanding Balance
                </Link>
              </div>
            )}
          </div>

          {/* ── Recent Documents ── (full width) */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Recent Documents</h2>
                {pendingReviewDocs.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {pendingReviewDocs.length} pending review
                  </span>
                )}
              </div>
              <Link
                href="/portal/documents"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                View all
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            {recentDocuments.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                <Link
                  href="/portal/documents"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Go to Documents
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-3">File</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-3 hidden sm:table-cell">Category</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-3 hidden md:table-cell">Size</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-3">Date</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentDocuments.map((doc) => {
                      const typeLabel = getFileTypeLabel(doc.file_type);
                      const typeColors = DOC_TYPE_COLORS[typeLabel] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
                      const categoryLabel = doc.category
                        ? doc.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                        : 'Other';
                      return (
                        <tr
                          key={doc.id}
                          className={`hover:bg-muted/20 transition-colors ${doc.requires_client_review ? 'bg-amber-50/40' : ''}`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors.bg}`}>
                                <span className={`text-[9px] font-bold uppercase ${typeColors.text}`}>{typeLabel.slice(0, 4)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate max-w-[160px] sm:max-w-[220px]">
                                  {doc.file_name}
                                </p>
                                {doc.requires_client_review && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 mt-0.5">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                      <line x1="12" y1="9" x2="12" y2="13" />
                                      <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    Pending your review
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">{categoryLabel}</span>
                          </td>
                          <td className="px-3 py-3.5 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-xs text-muted-foreground">{formatDateShort(doc.created_at)}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href="/portal/documents"
                              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              View
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* ── Quick links footer ── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { href: '/portal/messages', label: 'Messages' },
            { href: '/portal/book', label: 'Book Appointment' },
            { href: '/portal/signatures', label: 'Signatures' },
            { href: '/portal/settings', label: 'Settings' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
            >
              {link.label}
            </Link>
          ))}
        </div>

      </main>
    </div>
  );
}
