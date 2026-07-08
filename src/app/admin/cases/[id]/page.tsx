'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import CaseDocumentsManager from '@/app/admin/components/CaseDocumentsManager';
import CaseFileAnalyzer from '@/app/admin/components/CaseFileAnalyzer';

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
  urgency?: string | null;
  budget?: string | null;
}

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role?: string | null;
  category: string | null;
  description: string | null;
  storage_path: string | null;
  created_at: string;
  // versioning
  version?: number | null;
  parent_document_id?: string | null;
  document_type?: string | null;
  version_notes?: string | null;
  requires_client_review?: boolean;
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
  updated_at?: string;
  description: string | null;
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
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
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
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
}

interface Engagement {
  id: string;
  title: string;
  matter_number: string | null;
  engagement_type: string;
  retainer_tier: string;
  status: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  new: { label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  in_review: { label: 'In Review', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  contacted: { label: 'In Progress', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
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

type ActiveTab = 'overview' | 'documents' | 'messages' | 'invoices' | 'tasks' | 'retainer' | 'timeline' | 'ai_analysis';

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.id as string;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [retainer, setRetainer] = useState<RetainerSubscription | null>(null);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Admin reply state
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Notion notes state
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [notionQuery, setNotionQuery] = useState('');
  const [syncingNotion, setSyncingNotion] = useState(false);
  const [notionSyncMsg, setNotionSyncMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [caseRes, docsRes, timelineRes, invoicesRes, messagesRes, tasksRes, retainerRes, timeLogsRes, engagementsRes] = await Promise.all([
        supabase.from('contact_inquiries').select('*').eq('id', caseId).single(),
        supabase.from('case_documents').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('case_timeline').select('*').eq('inquiry_id', caseId).order('event_date', { ascending: false }),
        supabase.from('client_invoices').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
        supabase.from('portal_messages').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: true }),
        supabase.from('admin_tasks').select('*').eq('case_id', caseId).order('due_date', { ascending: true }),
        supabase.from('retainer_subscriptions').select('*').eq('inquiry_id', caseId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('retainer_time_logs').select('id,hours,description,work_date,logged_by').order('work_date', { ascending: false }).limit(50),
        supabase.from('engagements').select('id,title,matter_number,engagement_type,retainer_tier,status,description,start_date,end_date,created_at,updated_at').eq('inquiry_id', caseId).order('created_at', { ascending: false }),
      ]);

      if (caseRes.error) throw caseRes.error;
      setCaseDetail(caseRes.data);
      setNotes(caseRes.data?.notes ?? '');
      setDocuments(docsRes.data || []);
      setTimeline(timelineRes.data || []);
      setInvoices(invoicesRes.data || []);
      setMessages(messagesRes.data || []);
      setTasks(tasksRes.data || []);
      setRetainer(retainerRes.data ?? null);
      setTimeLogs(timeLogsRes.data || []);
      setEngagements(engagementsRes.data || []);

      // Fetch case notes (includes Notion-synced notes)
      const { data: notesData } = await supabase
        .from('case_notes')
        .select('*')
        .eq('inquiry_id', caseId)
        .order('created_at', { ascending: false });
      setCaseNotes(notesData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load case data.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) fetchData();
  }, [caseId, fetchData]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!caseDetail) return;
    setUpdatingStatus(true);
    setStatusMsg(null);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from('contact_inquiries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', caseId);
      if (updateErr) throw updateErr;
      setCaseDetail((prev) => prev ? { ...prev, status: newStatus } : prev);
      setStatusMsg('Status updated.');
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!caseDetail) return;
    setSavingNotes(true);
    try {
      const supabase = createClient();
      await supabase.from('contact_inquiries').update({ notes }).eq('id', caseId);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setSavingNotes(false);
    }
  };

  const handleNotionSync = async () => {
    if (!caseId) return;
    setSyncingNotion(true);
    setNotionSyncMsg(null);
    try {
      const query = notionQuery.trim() || caseDetail?.name || caseDetail?.service || '';
      const res = await fetch('/api/notion/sync-case-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setNotionSyncMsg(`Synced ${data.synced} of ${data.total} Notion pages.`);
      await fetchData();
    } catch (err: unknown) {
      setNotionSyncMsg(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingNotion(false);
      setTimeout(() => setNotionSyncMsg(null), 4000);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      const supabase = createClient();
      const { error: msgErr } = await supabase.from('portal_messages').insert({
        inquiry_id: caseId,
        sender_role: 'admin',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading case…</p>
        </div>
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-4">{error ?? 'Case not found.'}</p>
          <button onClick={() => router.back()} className="text-xs text-muted-foreground underline">← Go Back</button>
        </div>
      </div>
    );
  }

  const stage = resolveStage(caseDetail);
  const stageCfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake'];
  const statusCfg = STATUS_CONFIG[caseDetail.status] ?? STATUS_CONFIG['new'];
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const pendingInvoices = invoices.filter((i) => ['sent', 'pending', 'overdue'].includes(i.status));
  const unreadFromClient = messages.filter((m) => m.sender_role === 'client' && !m.read_at);
  const totalBilled = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
  const totalHours = timeLogs.reduce((s, l) => s + (l.hours ?? 0), 0);

  const TABS: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'documents', label: 'Documents', badge: documents.length || undefined },
    { id: 'messages', label: 'Messages', badge: unreadFromClient.length || undefined },
    { id: 'invoices', label: 'Invoices', badge: pendingInvoices.length || undefined },
    { id: 'tasks', label: 'Tasks', badge: openTasks.length || undefined },
    { id: 'retainer', label: 'Retainer' },
    { id: 'ai_analysis', label: '✦ AI Analysis' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.back()}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Case Details</p>
                <h1 className="font-serif text-base text-foreground truncate">
                  {caseDetail.firm ? `${caseDetail.firm} — ${caseDetail.service}` : `${caseDetail.name} — ${caseDetail.service}`}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                ← Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        {/* Case Header Card */}
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
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${statusCfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>
              <h2 className="font-serif text-xl md:text-2xl text-foreground tracking-tight mb-1">
                {caseDetail.name}
                {caseDetail.firm && <span className="text-muted-foreground font-sans text-base ml-2">· {caseDetail.firm}</span>}
              </h2>
              <p className="text-sm text-muted-foreground">{caseDetail.email} · Opened {formatDate(caseDetail.created_at)}</p>
            </div>
            {/* Status Changer */}
            <div className="flex flex-col gap-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Update Status</p>
              <div className="flex gap-1.5 flex-wrap">
                {['new', 'in_review', 'contacted', 'closed'].map((s) => (
                  <button key={s} onClick={() => handleStatusUpdate(s)} disabled={updatingStatus || caseDetail.status === s}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      caseDetail.status === s
                        ? (STATUS_CONFIG[s]?.color ?? 'bg-gray-100 text-gray-500 border-gray-200')
                        : 'bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                    } disabled:opacity-60`}>
                    {STATUS_CONFIG[s]?.label ?? s}
                  </button>
                ))}
              </div>
              {statusMsg && <p className="text-[11px] text-emerald-600">{statusMsg}</p>}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border">
            {[
              { label: 'Service', value: caseDetail.service },
              { label: 'Documents', value: String(documents.length) },
              { label: 'Open Tasks', value: String(openTasks.length) },
              { label: 'Total Billed', value: formatCurrency(totalBilled) },
              { label: 'Total Paid', value: formatCurrency(totalPaid) },
              { label: 'Hours Logged', value: `${totalHours.toFixed(1)}h` },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">{stat.label}</p>
                <p className="text-sm font-bold text-foreground truncate">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
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
            <div className="lg:col-span-2 space-y-4">
              {/* Client Info */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Client Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', value: caseDetail.name },
                    { label: 'Email', value: caseDetail.email },
                    { label: 'Firm / Company', value: caseDetail.firm || '—' },
                    { label: 'Service Type', value: caseDetail.service },
                    { label: 'Phone', value: caseDetail.phone || '—' },
                    { label: 'Jurisdiction', value: caseDetail.jurisdiction || '—' },
                    { label: 'Opposing Party', value: caseDetail.opposing_party || '—' },
                    { label: 'Urgency', value: caseDetail.urgency || '—' },
                    { label: 'Budget', value: caseDetail.budget || '—' },
                    { label: 'Last Updated', value: formatDate(caseDetail.updated_at) },
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
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Matter Description</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{caseDetail.message}</p>
                </div>
              )}

              {/* Admin Notes */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Admin Notes</h3>
                  <button onClick={handleSaveNotes} disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
                    {savingNotes ? 'Saving…' : notesSaved ? '✓ Saved' : 'Save Notes'}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this case (not visible to client)…"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                />
              </div>

              {/* Notion Case Notes */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
                    </svg>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notion Case Notes</h3>
                    {caseNotes.filter(n => n.source === 'notion').length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-foreground/10 text-foreground">
                        {caseNotes.filter(n => n.source === 'notion').length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={notionQuery}
                      onChange={(e) => setNotionQuery(e.target.value)}
                      placeholder={caseDetail?.name ?? 'Search Notion…'}
                      className="px-3 py-1.5 rounded-full border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 w-40"
                    />
                    <button onClick={handleNotionSync} disabled={syncingNotion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
                      {syncingNotion ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></svg>
                      )}
                      {syncingNotion ? 'Syncing…' : 'Sync from Notion'}
                    </button>
                  </div>
                </div>
                {notionSyncMsg && (
                  <p className="text-xs text-emerald-600 mb-3">{notionSyncMsg}</p>
                )}
                {caseNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No case notes yet. Click "Sync from Notion" to pull attorney notes from your Notion workspace.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {caseNotes.map((note) => (
                      <div key={note.id} className="border border-border rounded-xl p-3.5 bg-background">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            note.source === 'notion' ?'bg-purple-50 text-purple-700 border-purple-200' :'bg-secondary text-muted-foreground border-border'
                          }`}>
                            {note.source === 'notion' ? '◆ Notion' : '✎ Manual'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{note.author}</span>
                          {note.notion_synced_at && (
                            <span className="text-[10px] text-muted-foreground ml-auto">Synced {formatDateShort(note.notion_synced_at)}</span>
                          )}
                          {!note.notion_synced_at && (
                            <span className="text-[10px] text-muted-foreground ml-auto">{formatDateShort(note.created_at)}</span>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Messages Preview */}
              {messages.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Messages</h3>
                    <button onClick={() => setActiveTab('messages')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">View all →</button>
                  </div>
                  <div className="space-y-3">
                    {messages.slice(-3).map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.sender_role === 'admin' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          msg.sender_role === 'admin' ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
                        }`}>
                          {msg.sender_role === 'admin' ? 'A' : 'C'}
                        </div>
                        <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.sender_role === 'client' ?'bg-secondary/60 text-foreground rounded-tl-sm' :'text-white rounded-tr-sm'
                        }`} style={msg.sender_role === 'admin' ? { background: '#355E3B' } : {}}>
                          <p className="leading-relaxed">{msg.body}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender_role === 'client' ? 'text-muted-foreground' : 'text-white/60'}`}>
                            {formatDateShort(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Timeline */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Case Timeline</h3>
                {timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.slice(0, 6).map((event) => (
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
                )}
              </div>

              {/* Consultation */}
              {caseDetail.calendly_start_time && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Scheduled Consultation</h3>
                  <p className="text-sm font-semibold text-foreground mb-1">{caseDetail.calendly_event_name ?? 'Consultation'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(caseDetail.calendly_start_time)}</p>
                </div>
              )}

              {/* Quick Links */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button onClick={() => setActiveTab('messages')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-secondary/60 transition-colors text-left">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Send Message
                    {unreadFromClient.length > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: '#C8965A' }}>
                        {unreadFromClient.length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setActiveTab('invoices')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-secondary/60 transition-colors text-left">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    View Invoices
                  </button>
                  <button onClick={() => setActiveTab('tasks')}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-secondary/60 transition-colors text-left">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Manage Tasks
                    {openTasks.length > 0 && (
                      <span className="ml-auto text-[11px] text-muted-foreground">{openTasks.length} open</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === 'documents' && (
          <CaseDocumentsManager
            caseId={caseId}
            documents={documents}
            onDocumentsChange={fetchData}
          />
        )}

        {/* ── AI Analysis Tab ── */}
        {activeTab === 'ai_analysis' && (
          <CaseFileAnalyzer
            caseId={caseId}
            caseName={caseDetail.name}
            caseService={caseDetail.service}
            caseMessage={caseDetail.message}
          />
        )}

        {/* ── Messages Tab ── */}
        {activeTab === 'messages' && (
          <div className="space-y-3">
            {unreadFromClient.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-xs font-semibold text-amber-700">{unreadFromClient.length} unread message{unreadFromClient.length !== 1 ? 's' : ''} from client</span>
              </div>
            )}
            <MatterMessageThread
              matterId={caseId}
              senderRole="admin"
              senderName="Staff"
              caseName={caseDetail ? (caseDetail.firm ? `${caseDetail.firm} — ${caseDetail.service}` : `${caseDetail.name} — ${caseDetail.service}`) : undefined}
            />
          </div>
        )}

        {/* ── Invoices Tab ── */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Billed', value: formatCurrency(totalBilled), color: 'text-foreground' },
                { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'text-emerald-600' },
                { label: 'Outstanding', value: formatCurrency(totalBilled - totalPaid), color: totalBilled - totalPaid > 0 ? 'text-amber-600' : 'text-foreground' },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-2xl px-5 py-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoice History</h3>
              </div>
              {invoices.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No invoices for this case.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invoices.map((inv) => {
                    const cfg = INVOICE_STATUS_CONFIG[inv.status] ?? INVOICE_STATUS_CONFIG['draft'];
                    const balance = inv.amount - (inv.amount_paid ?? 0);
                    return (
                      <div key={inv.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{inv.invoice_number}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </div>
                          {inv.description && <p className="text-xs text-muted-foreground mb-1">{inv.description}</p>}
                          <p className="text-xs text-muted-foreground">
                            {inv.due_date ? `Due ${formatDateShort(inv.due_date)}` : `Issued ${formatDateShort(inv.created_at)}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                          {inv.amount_paid > 0 && <p className="text-[11px] text-emerald-600">Paid: {formatCurrency(inv.amount_paid, inv.currency)}</p>}
                          {balance > 0 && inv.status !== 'paid' && <p className="text-[11px] text-amber-600">Due: {formatCurrency(balance, inv.currency)}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tasks Tab ── */}
        {activeTab === 'tasks' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Linked Tasks ({tasks.length})</h3>
              <Link href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Manage in Tasks Dashboard →
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No tasks linked to this case.</p>
                <p className="text-xs text-muted-foreground mt-1">Create tasks in the Tasks Dashboard and link them to this case.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task) => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['medium'];
                  const statusCfg = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG['todo'];
                  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
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
                        <div className="flex items-center gap-3 mt-1">
                          {task.due_date && (
                            <p className={`text-[11px] ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                              {overdue ? '⚠ Overdue · ' : ''}Due {formatDateShort(task.due_date)}
                            </p>
                          )}
                          {task.assigned_to && <p className="text-[11px] text-muted-foreground">Assigned: {task.assigned_to}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Retainer Tab ── */}
        {activeTab === 'retainer' && (
          <div className="space-y-4">
            {!retainer ? (
              <div className="bg-card border border-border rounded-2xl px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No retainer subscription for this case.</p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Retainer Details</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Plan', value: retainer.plan_name },
                      { label: 'Amount', value: formatCurrency(retainer.amount) },
                      { label: 'Status', value: retainer.status },
                      { label: 'Period Start', value: retainer.current_period_start ? formatDateShort(retainer.current_period_start) : '—' },
                      { label: 'Period End', value: retainer.current_period_end ? formatDateShort(retainer.current_period_end) : '—' },
                      { label: 'Hours Logged', value: `${totalHours.toFixed(1)}h` },
                    ].map((f) => (
                      <div key={f.label}>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">{f.label}</p>
                        <p className="text-sm font-semibold text-foreground">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {timeLogs.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Time Logs</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {timeLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-foreground">{log.hours}h</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{log.description ?? 'Work logged'}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateShort(log.work_date)}
                              {log.logged_by && ` · ${log.logged_by}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
