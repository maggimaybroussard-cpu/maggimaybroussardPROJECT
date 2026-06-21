'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface Inquiry {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  event_title: string;
  event_description: string | null;
  event_date: string;
}

interface Milestone {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  active: boolean;
  date?: string;
}

interface RetainerSubscription {
  id: string;
  plan_name: string;
  amount: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  logged_at: string;
  logged_by: string | null;
}

const RETAINER_TIERS: Record<string, { label: string; hours: number; amount: number }> = {
  essential: { label: 'Essential', hours: 10, amount: 750 },
  standard: { label: 'Standard', hours: 20, amount: 1500 },
  'full-service': { label: 'Full-Service', hours: 40, amount: 2800 },
  full_service: { label: 'Full-Service', hours: 40, amount: 2800 },
};

function getTierHours(planName: string, amount: number): number {
  const key = planName?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (RETAINER_TIERS[key]) return RETAINER_TIERS[key].hours;
  const amt = Math.round(Number(amount));
  if (amt === 750) return 10;
  if (amt === 1500) return 20;
  if (amt === 2800) return 40;
  return 0;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  new: { label: 'Received', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', bg: 'rgba(59,130,246,0.06)' },
  in_review: { label: 'In Review', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', bg: 'rgba(245,158,11,0.06)' },
  contacted: { label: 'In Progress', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bg: 'rgba(16,185,129,0.06)' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', bg: 'rgba(107,114,128,0.06)' },
};

const RETAINER_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  trialing: { label: 'Trial', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  past_due: { label: 'Past Due', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

const ALLOWED_TYPES: Record<string, string> = {
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type CaseTab = 'overview' | 'hours' | 'documents';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

function getWorkTypeFromDescription(desc: string | null): string {
  if (!desc) return 'Other';
  const d = desc.toLowerCase();
  if (d.includes('[research]')) return 'Research';
  if (d.includes('[drafting]')) return 'Drafting';
  if (d.includes('[calls]')) return 'Calls';
  if (d.includes('[review]')) return 'Review';
  if (d.includes('[filing]')) return 'Filing';
  if (d.includes('[discovery]')) return 'Discovery';
  return 'Other';
}

const WORK_TYPE_COLORS: Record<string, string> = {
  Research: '#355E3B',
  Drafting: '#C8965A',
  Calls: '#4A6FA5',
  Review: '#8B5E3C',
  Filing: '#6B7280',
  Discovery: '#7C3AED',
  Other: '#0891B2',
};

function getMilestonesForStatus(status: string, inquiry: Inquiry, timeline: TimelineEvent[]): Milestone[] {
  const bookingEvent = timeline.find((e) =>
    e.event_title.toLowerCase().includes('book') ||
    e.event_title.toLowerCase().includes('consult') ||
    e.event_title.toLowerCase().includes('schedul')
  );

  return [
    {
      id: 'inquiry',
      label: 'Inquiry Submitted',
      description: 'Your inquiry has been received and logged.',
      completed: true,
      active: status === 'new',
      date: inquiry.created_at,
    },
    {
      id: 'review',
      label: 'Case Under Review',
      description: 'Maggi May is reviewing your case details.',
      completed: ['in_review', 'contacted', 'closed'].includes(status),
      active: status === 'in_review',
    },
    {
      id: 'consultation',
      label: 'Consultation Scheduled',
      description: 'Your consultation has been confirmed.',
      completed: ['contacted', 'closed'].includes(status),
      active: status === 'contacted',
      date: bookingEvent?.event_date,
    },
    {
      id: 'engagement',
      label: 'Engagement Complete',
      description: 'Your case has been resolved or closed.',
      completed: status === 'closed',
      active: false,
    },
  ];
}

export default function ClientCasesPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<CaseTab>('overview');
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [retainer, setRetainer] = useState<RetainerSubscription | null>(null);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [emailSentForCase, setEmailSentForCase] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Live sync state
  const [liveFlash, setLiveFlash] = useState<string | null>(null);

  // Search & filter state for documents tab
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [docSortBy, setDocSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');

  // Timeline search
  const [timelineSearch, setTimelineSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: accessData, error: accessError } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessError) throw accessError;
      if (!accessData) { setLoading(false); return; }

      let inquiryId = accessData.inquiry_id;

      const [inquiryRes, docsRes, timelineRes, retainerRes, timeLogsRes] = await Promise.all([
        supabase.from('contact_inquiries').select('*').eq('id', inquiryId).single(),
        supabase.from('case_documents').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }),
        supabase.from('case_timeline').select('*').eq('inquiry_id', inquiryId).order('event_date', { ascending: false }),
        supabase
          .from('retainer_subscriptions')
          .select('*')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('retainer_time_logs')
          .select('id, retainer_subscription_id, hours, description, work_date, logged_at, logged_by')
          .order('work_date', { ascending: false })
          .order('logged_at', { ascending: false }),
      ]);

      if (inquiryRes.error) throw inquiryRes.error;
      setInquiry(inquiryRes.data);
      setDocuments(docsRes.data || []);
      setTimeline(timelineRes.data || []);
      setRetainer(retainerRes.data ?? null);
      setTimeLogs(timeLogsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load case data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send welcome email once per case load (non-blocking)
  useEffect(() => {
    if (inquiry && emailSentForCase !== inquiry.id) {
      setEmailSentForCase(inquiry.id);
      sendCaseNotification('created');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/portal/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    let inquiryId: string | null = null;

    supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        inquiryId = data?.inquiry_id ?? null;
        if (!inquiryId) return;

        const caseChannel = supabase
          .channel('cases-page-inquiry-live')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'contact_inquiries', filter: `id=eq.${inquiryId}` },
            (payload) => {
              const newRow = payload.new as Inquiry;
              const oldRow = payload.old as Inquiry;
              if (newRow.status !== oldRow?.status) {
                const statusLabels: Record<string, string> = {
                  new: 'Received', in_review: 'In Review', contacted: 'In Progress', closed: 'Closed',
                };
                setLiveFlash(`Case updated: ${statusLabels[newRow.status] ?? newRow.status}`);
                fetchData();
              }
            }
          )
          .subscribe();

        const timelineChannel = supabase
          .channel('cases-page-timeline-live')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'case_timeline', filter: `inquiry_id=eq.${inquiryId}` },
            (payload) => {
              const newRow = payload.new as TimelineEvent;
              setLiveFlash(`New update: ${newRow.event_title}`);
              fetchData();
            }
          )
          .subscribe();

        const docsChannel = supabase
          .channel('cases-page-docs-live')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'case_documents', filter: `inquiry_id=eq.${inquiryId}` },
            (payload) => {
              const newRow = payload.new as CaseDocument;
              if (newRow.uploaded_by !== user.email) {
                setLiveFlash(`New document added: ${newRow.file_name}`);
                fetchData();
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'case_documents', filter: `inquiry_id=eq.${inquiryId}` },
            (payload) => {
              const newRow = payload.new as CaseDocument & { deliverable_status?: string };
              const oldRow = payload.old as CaseDocument & { deliverable_status?: string };
              if (newRow.deliverable_status !== oldRow?.deliverable_status) {
                if (newRow.deliverable_status === 'approved') {
                  setLiveFlash(`Deliverable approved: ${newRow.file_name}`);
                } else if (newRow.deliverable_status === 'completed') {
                  setLiveFlash(`Deliverable completed: ${newRow.file_name}`);
                } else if (newRow.deliverable_status === 'rejected') {
                  setLiveFlash(`Deliverable needs revision: ${newRow.file_name}`);
                }
                fetchData();
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(caseChannel);
          supabase.removeChannel(timelineChannel);
          supabase.removeChannel(docsChannel);
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-clear flash message
  useEffect(() => {
    if (!liveFlash) return;
    const t = setTimeout(() => setLiveFlash(null), 4000);
    return () => clearTimeout(t);
  }, [liveFlash]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES[file.type]) return `File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT`;
    if (file.size > MAX_FILE_SIZE) return `File too large. Maximum size is 10 MB.`;
    return null;
  };

  const handleUpload = async (file: File) => {
    if (!user || !inquiry) return;
    const validationError = validateFile(file);
    if (validationError) { setUploadError(validationError); return; }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const supabase = createClient();
      const storagePath = `${user.id}/${inquiry.id}/${Date.now()}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from('case-documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('case-documents').getPublicUrl(storagePath);
      const ext = file.name.split('.').pop();

      const { error: dbError } = await supabase.from('case_documents').insert({
        inquiry_id: inquiry.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: ALLOWED_TYPES[file.type] ?? ext ?? null,
        file_size: file.size,
        uploaded_by: user.email ?? 'Client',
      });

      if (dbError) throw dbError;
      setUploadSuccess(`"${file.name}" uploaded successfully.`);
      await fetchData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendCaseNotification = async (eventType: 'created' | 'updated') => {
    if (!user || !inquiry) return;
    try {
      await fetch('/api/case-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: inquiry.name,
          clientEmail: inquiry.email,
          caseName: inquiry.firm ? `${inquiry.firm} — ${inquiry.service}` : inquiry.service,
          caseId: inquiry.id,
          service: inquiry.service,
          status: inquiry.status,
          message: inquiry.message,
          eventType,
        }),
      });
    } catch {
      // Non-blocking
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (doc: CaseDocument) => {
    if (!user) return;
    setDeletingId(doc.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const supabase = createClient();
      const urlParts = doc.file_url.split('/object/public/case-documents/');
      if (urlParts.length === 2) {
        await supabase.storage.from('case-documents').remove([decodeURIComponent(urlParts[1])]);
      }
      const { error: dbError } = await supabase.from('case_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived retainer data ─────────────────────────────────────────────────
  const retainerTierHours = retainer ? getTierHours(retainer.plan_name, retainer.amount) : 0;
  const hoursConsumed = timeLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
  const hoursRemaining = Math.max(0, retainerTierHours - hoursConsumed);
  const hoursUsedPct = retainerTierHours > 0 ? Math.min(100, Math.round((hoursConsumed / retainerTierHours) * 100)) : 0;
  const retainerStatusCfg = retainer
    ? (RETAINER_STATUS_CONFIG[retainer.status] ?? RETAINER_STATUS_CONFIG['inactive'])
    : null;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-6">
          <div className="w-48 h-8 bg-muted/60 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 h-48 animate-pulse" />
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 h-64 animate-pulse" />
        </main>
      </div>
    );
  }

  const statusCfg = inquiry ? (STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG['new']) : null;
  const milestones = inquiry ? getMilestonesForStatus(inquiry.status, inquiry, timeline) : [];
  const nextMilestone = milestones.find((m) => !m.completed);
  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPct = Math.round((completedCount / milestones.length) * 100);

  // Case name derived from service + firm
  const caseName = inquiry
    ? (inquiry.firm ? `${inquiry.firm} — ${inquiry.service}` : inquiry.service)
    : null;

  const TABS: { id: CaseTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      id: 'hours',
      label: 'Hours & Retainer',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      count: documents.length,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Live flash banner */}
      {liveFlash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-medium text-foreground animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {liveFlash}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                href="/portal/retainer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="hidden sm:inline">Retainer</span>
              </Link>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[160px]">{user?.email}</span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* Page heading */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
          <h1 className="font-serif text-4xl text-foreground">My Cases</h1>
          {inquiry && (
            <p className="text-sm text-muted-foreground font-light mt-1">
              Unified view of your active case, milestones, documents, and timeline.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {!inquiry && !error && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-foreground mb-2">No active cases</h2>
            <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
              Your account hasn&apos;t been linked to a case yet. Please contact Maggi May Broussard directly.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Contact Us
            </Link>
          </div>
        )}

        {inquiry && statusCfg && (
          <div className="space-y-6">

            {/* ── CASE HEADER CARD ── */}
            <section>
              <div
                className="rounded-2xl border-2 p-6"
                style={{ borderColor: 'var(--border)', background: statusCfg.bg }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--primary)', opacity: 0.9 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Active Case</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusCfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                        {retainerStatusCfg && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${retainerStatusCfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${retainerStatusCfg.dot}`} />
                            Retainer {retainerStatusCfg.label}
                          </span>
                        )}
                      </div>
                      <h2 className="font-serif text-xl text-foreground">{caseName}</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">
                        Submitted {formatDate(inquiry.created_at)} · Last updated {formatDateShort(inquiry.updated_at)}
                      </p>
                      <Link href={`/portal/cases/${inquiry.id}`}
                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                        View Full Case Details →
                      </Link>
                    </div>
                  </div>
                  {/* Progress ring */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="relative w-14 h-14">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border)" strokeWidth="4" />
                        <circle
                          cx="28" cy="28" r="22" fill="none"
                          stroke="#355E3B" strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 22}`}
                          strokeDashoffset={`${2 * Math.PI * 22 * (1 - progressPct / 100)}`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.25,0.46,0.45,0.94)' }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                        {progressPct}%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{completedCount}/{milestones.length}</p>
                      <p className="text-xs text-muted-foreground">milestones</p>
                    </div>
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Documents</p>
                    <p className="text-lg font-semibold text-foreground">{documents.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Timeline Events</p>
                    <p className="text-lg font-semibold text-foreground">{timeline.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Hours Used</p>
                    <p className="text-lg font-semibold text-foreground">
                      {hoursConsumed.toFixed(1)}
                      {retainerTierHours > 0 && <span className="text-xs text-muted-foreground font-normal"> / {retainerTierHours}h</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Retainer Plan</p>
                    <p className="text-lg font-semibold text-foreground">
                      {retainer ? retainer.plan_name : <span className="text-sm text-muted-foreground font-normal">None</span>}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── TAB NAVIGATION ── */}
            <div className="flex items-center gap-1 border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-all duration-200 -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                      activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── TAB: OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Inquiry message */}
                {inquiry.message && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Your Inquiry</p>
                    <p className="text-sm text-foreground/80 font-light leading-relaxed">{inquiry.message}</p>
                  </div>
                )}

                {/* Milestones + Next Milestone */}
                <div>
                  <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Milestones</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* Milestone track */}
                    <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6">
                      <div className="space-y-0">
                        {milestones.map((m, idx) => (
                          <div key={m.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                  m.completed
                                    ? 'bg-emerald-500 border-2 border-emerald-500'
                                    : m.active
                                    ? 'border-2 border-accent bg-accent/10' :'border-2 border-border bg-background'
                                }`}
                              >
                                {m.completed ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                ) : m.active ? (
                                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-border" />
                                )}
                              </div>
                              {idx < milestones.length - 1 && (
                                <div
                                  className={`w-0.5 flex-1 min-h-[28px] my-1 rounded-full transition-colors duration-300 ${
                                    m.completed ? 'bg-emerald-300' : 'bg-border'
                                  }`}
                                />
                              )}
                            </div>
                            <div className={`pb-5 flex-1 min-w-0 ${idx === milestones.length - 1 ? 'pb-0' : ''}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-semibold ${m.completed ? 'text-foreground' : m.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {m.label}
                                </p>
                                {m.active && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-semibold border border-accent/30">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-light mt-0.5">{m.description}</p>
                              {m.date && (
                                <p className="text-xs text-muted-foreground mt-1 font-medium">{formatDateShort(m.date)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Next milestone + quick stats */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                      {nextMilestone ? (
                        <div className="bg-card border-2 rounded-2xl p-6 flex-1" style={{ borderColor: 'var(--accent)' }}>
                          <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--accent)' }}>
                            Next Milestone
                          </p>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(200,150,90,0.12)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                          </div>
                          <h3 className="font-serif text-lg text-foreground mb-1">{nextMilestone.label}</h3>
                          <p className="text-sm text-muted-foreground font-light leading-relaxed">{nextMilestone.description}</p>
                          {(inquiry.status === 'new' || inquiry.status === 'in_review') && (
                            <a
                              href="https://calendly.com/maggimaybroussard"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              Schedule Consultation
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="bg-card border border-border rounded-2xl p-6 flex-1 flex flex-col items-center justify-center text-center">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-foreground">All milestones complete</p>
                          <p className="text-xs text-muted-foreground font-light mt-1">Your engagement is fully resolved.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Case Timeline */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Case Timeline</h2>
                    {timeline.length > 3 && (
                      <div className="relative">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                          type="text"
                          value={timelineSearch}
                          onChange={(e) => setTimelineSearch(e.target.value)}
                          placeholder="Filter events…"
                          className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 w-40"
                        />
                      </div>
                    )}
                  </div>
                  {timeline.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center">
                      <p className="text-sm text-muted-foreground font-light">No timeline events recorded yet.</p>
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="p-6 space-y-0">
                        {timeline
                          .filter((e) => !timelineSearch || e.event_title.toLowerCase().includes(timelineSearch.toLowerCase()) || (e.event_description ?? '').toLowerCase().includes(timelineSearch.toLowerCase()))
                          .map((event, idx, arr) => (
                          <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: idx === 0 ? 'var(--primary)' : 'var(--muted)', border: '2px solid var(--border)' }}
                              >
                                {idx === 0 ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                ) : (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                )}
                              </div>
                              {idx < arr.length - 1 && (
                                <div className="w-0.5 flex-1 min-h-[24px] my-1 bg-border rounded-full" />
                              )}
                            </div>
                            <div className={`flex-1 min-w-0 ${idx < arr.length - 1 ? 'pb-5' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className={`text-sm font-semibold ${idx === 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                                    {event.event_title}
                                  </p>
                                  {event.event_description && (
                                    <p className="text-xs text-muted-foreground font-light mt-0.5 leading-relaxed">
                                      {event.event_description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground font-light shrink-0 mt-0.5">
                                  {formatDateShort(event.event_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom CTA */}
                <div className="pb-8">
                  <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Need to discuss your case?</p>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">Book a follow-up or reach out directly.</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                      >
                        Contact Us
                      </Link>
                      <a
                        href="https://calendly.com/maggimaybroussard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Book Consultation
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: HOURS & RETAINER ── */}
            {activeTab === 'hours' && (
              <div className="space-y-6 pb-8">
                {!retainer ? (
                  <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl text-foreground mb-2">No retainer on file</h3>
                    <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
                      You don&apos;t have an active retainer subscription linked to this case yet.
                    </p>
                    <Link
                      href="/portal/retainer"
                      className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                      View Retainer Options
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Retainer status card */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Retainer Plan</p>
                          <h3 className="font-serif text-2xl text-foreground">{retainer.plan_name}</h3>
                          <p className="text-xs text-muted-foreground font-light mt-0.5">
                            Started {formatDateShort(retainer.created_at)}
                            {retainer.current_period_end && ` · Renews ${formatDateShort(retainer.current_period_end)}`}
                          </p>
                        </div>
                        {retainerStatusCfg && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold self-start ${retainerStatusCfg.color}`}>
                            <span className={`w-2 h-2 rounded-full ${retainerStatusCfg.dot}`} />
                            {retainerStatusCfg.label}
                          </span>
                        )}
                      </div>

                      {/* Hours gauge */}
                      {retainerTierHours > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Hours Consumed</p>
                            <p className="text-xs font-semibold text-foreground">
                              {hoursConsumed.toFixed(1)} / {retainerTierHours}h
                            </p>
                          </div>
                          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                hoursUsedPct >= 90 ? 'bg-red-500' : hoursUsedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${hoursUsedPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">{hoursUsedPct}% used</p>
                            <p className="text-xs text-muted-foreground">{hoursRemaining.toFixed(1)}h remaining</p>
                          </div>
                        </div>
                      )}

                      {/* KPI row */}
                      <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6 pt-5 border-t border-border/60">
                        <div className="text-center">
                          <p className="text-2xl font-semibold text-foreground">{hoursConsumed.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Hours Used</p>
                        </div>
                        <div className="text-center border-x border-border/60">
                          <p className="text-2xl font-semibold text-foreground">{hoursRemaining.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Hours Left</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-semibold text-foreground">{timeLogs.length}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Log Entries</p>
                        </div>
                      </div>
                    </div>

                    {/* Time logs table */}
                    <div>
                      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Billable Time Log</h2>
                      {timeLogs.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl p-8 text-center">
                          <p className="text-sm text-muted-foreground font-light">No time entries logged yet.</p>
                        </div>
                      ) : (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="divide-y divide-border">
                            {timeLogs.map((log) => {
                              const workType = getWorkTypeFromDescription(log.description);
                              const color = WORK_TYPE_COLORS[workType] ?? '#6B7280';
                              const cleanDesc = log.description
                                ? log.description.replace(/\[.*?\]\s*/g, '').trim()
                                : null;
                              return (
                                <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                                  <div
                                    className="w-2 h-8 rounded-full shrink-0"
                                    style={{ background: color }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                                        style={{ background: `${color}18`, color }}
                                      >
                                        {workType}
                                      </span>
                                      {cleanDesc && (
                                        <p className="text-sm text-foreground/80 font-light truncate">{cleanDesc}</p>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatDateShort(log.work_date)}
                                      {log.logged_by && ` · ${log.logged_by}`}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold text-foreground">{log.hours.toFixed(1)}h</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Footer total */}
                          <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total</p>
                            <p className="text-sm font-bold text-foreground">{hoursConsumed.toFixed(1)}h</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Link to full retainer page */}
                    <div className="flex justify-end">
                      <Link
                        href="/portal/retainer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Full Retainer Details
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB: DOCUMENTS ── */}
            {activeTab === 'documents' && (
              <div className="space-y-4 pb-8">
                {/* Search + filter bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      placeholder="Search documents…"
                      className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                    />
                  </div>
                  <select
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-border rounded-xl text-xs font-semibold bg-card text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">All types</option>
                    {['PDF','DOC','DOCX','XLS','XLSX','JPEG','PNG','TXT'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={docSortBy}
                    onChange={(e) => setDocSortBy(e.target.value as typeof docSortBy)}
                    className="px-3 py-2 border border-border rounded-xl text-xs font-semibold bg-card text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="name_asc">Name A–Z</option>
                  </select>
                  <div className="flex items-center gap-2 ml-auto">
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {documents.filter((d) => {
                        const matchSearch = !docSearch || d.file_name.toLowerCase().includes(docSearch.toLowerCase());
                        const matchType = docTypeFilter === 'all' || (d.file_type ?? '').toUpperCase() === docTypeFilter;
                        return matchSearch && matchType;
                      }).length} of {documents.length}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    >
                      {uploading ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      )}
                      {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={Object.keys(ALLOWED_TYPES).join(',')}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Feedback banners */}
                {uploadError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {uploadSuccess}
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                    dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-primary/40 hover:bg-muted/20'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {dragOver ? 'Drop to upload' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT · Max 10 MB</p>
                </div>

                {/* Document list */}
                {documents.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-8 text-center">
                    <p className="text-sm text-muted-foreground font-light">No documents linked to this case yet.</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="divide-y divide-border">
                      {documents
                        .filter((d) => {
                          const matchSearch = !docSearch || d.file_name.toLowerCase().includes(docSearch.toLowerCase());
                          const matchType = docTypeFilter === 'all' || (d.file_type ?? '').toUpperCase() === docTypeFilter;
                          return matchSearch && matchType;
                        })
                        .sort((a, b) => {
                          if (docSortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                          if (docSortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                          if (docSortBy === 'name_asc') return a.file_name.localeCompare(b.file_name);
                          return 0;
                        })
                        .map((doc) => (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(74,55,40,0.07)' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground font-light">
                              {doc.file_type && <span className="mr-2 font-medium">{doc.file_type}</span>}
                              {formatFileSize(doc.file_size)}
                              {doc.file_size ? ' · ' : ''}
                              {formatDateShort(doc.created_at)}
                              {doc.uploaded_by && ` · ${doc.uploaded_by}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              Download
                            </a>
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50"
                              aria-label="Delete document"
                            >
                              {deletingId === doc.id ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
