'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveCase {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Engagement {
  id: string;
  inquiry_id: string;
  title: string;
  retainer_amount: number | null;
  retainer_tier: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

interface Deadline {
  id: string;
  inquiry_id: string | null;
  title: string;
  due_date: string;
  event_type: string | null;
  status: string | null;
}

interface Invoice {
  id: string;
  inquiry_id: string | null;
  amount: number;
  status: string;
  due_date: string | null;
}

interface CaseRow {
  caseData: ActiveCase;
  engagement: Engagement | null;
  nextDeadline: Deadline | null;
  invoiceSummary: { total: number; outstanding: number; count: number } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  active_client: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  proposal_sent: 'bg-amber-50 text-amber-700 border-amber-200',
  consultation_booked: 'bg-purple-50 text-purple-700 border-purple-200',
  inquiry: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STAGE_LABELS: Record<string, string> = {
  active_client: 'Active Client',
  proposal_sent: 'Proposal Sent',
  consultation_booked: 'Consultation Booked',
  inquiry: 'Inquiry',
  completed: 'Completed',
  closed: 'Closed',
};

const RETAINER_TIER_COLORS: Record<string, string> = {
  starter: 'text-blue-700',
  professional: 'text-purple-700',
  enterprise: 'text-amber-700',
  custom: 'text-emerald-700',
  none: 'text-gray-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: Deadline | null }) {
  if (!deadline) return <span className="text-xs text-muted-foreground">—</span>;
  const days = daysUntil(deadline.due_date);
  let cls = 'bg-gray-50 text-gray-500 border-gray-200';
  if (days < 0) cls = 'bg-red-50 text-red-700 border-red-200';
  else if (days <= 3) cls = 'bg-red-50 text-red-700 border-red-200';
  else if (days <= 7) cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else cls = 'bg-blue-50 text-blue-700 border-blue-200';

  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={deadline.title}>
        {deadline.title}
      </span>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onClick,
  href,
  color = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  color?: 'default' | 'green' | 'blue' | 'amber';
}) {
  const colorMap = {
    default: 'bg-secondary/60 text-foreground hover:bg-secondary border-border',
    green: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
  };
  let cls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${colorMap[color]}`;

  if (href) {
    return (
      <Link href={href} className={cls} title={label}>
        {icon}
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls} title={label}>
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ─── Case Detail Drawer ───────────────────────────────────────────────────────

type DrawerTab = 'documents' | 'timeline' | 'communications' | 'invoices';

function CaseDetailDrawer({
  caseRow,
  onClose,
}: {
  caseRow: CaseRow;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('documents');
  const [documents, setDocuments] = useState<{ id: string; file_name: string; file_url: string; category: string | null; created_at: string }[]>([]);
  const [timeline, setTimeline] = useState<{ id: string; event_type: string; description: string; created_at: string }[]>([]);
  const [messages, setMessages] = useState<{ id: string; sender_role: string; content: string; created_at: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; amount: number; status: string; due_date: string | null; description: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTabData = useCallback(async (tab: DrawerTab) => {
    setLoading(true);
    const supabase = createClient();
    try {
      if (tab === 'documents') {
        const { data } = await supabase
          .from('case_documents')
          .select('id,file_name,file_url,category,created_at')
          .eq('inquiry_id', caseRow.caseData.id)
          .order('created_at', { ascending: false });
        setDocuments(data || []);
      } else if (tab === 'timeline') {
        const { data } = await supabase
          .from('case_actions')
          .select('id,event_type,description,created_at')
          .eq('inquiry_id', caseRow.caseData.id)
          .order('created_at', { ascending: false })
          .limit(30);
        setTimeline(data || []);
      } else if (tab === 'communications') {
        const { data } = await supabase
          .from('portal_messages')
          .select('id,sender_role,content,created_at')
          .eq('inquiry_id', caseRow.caseData.id)
          .order('created_at', { ascending: false })
          .limit(30);
        setMessages(data || []);
      } else if (tab === 'invoices') {
        const { data } = await supabase
          .from('client_invoices')
          .select('id,amount,status,due_date,description,created_at')
          .eq('inquiry_id', caseRow.caseData.id)
          .order('created_at', { ascending: false });
        setInvoices(data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [caseRow.caseData.id]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'documents',
      label: 'Documents',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      id: 'communications',
      label: 'Messages',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-foreground truncate">{caseRow.caseData.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{caseRow.caseData.service} · {caseRow.caseData.email}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-secondary/10 px-2 pt-2 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                activeTab === t.id
                  ? 'bg-background text-foreground border border-b-0 border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Documents */}
              {activeTab === 'documents' && (
                <div className="space-y-2">
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet.</p>
                  ) : (
                    documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/30 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.category || 'General'} · {formatDate(doc.created_at)}</p>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ))
                  )}
                </div>
              )}

              {/* Timeline */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No timeline events recorded yet.</p>
                  ) : (
                    <div className="relative pl-5">
                      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                      {timeline.map((event) => (
                        <div key={event.id} className="relative mb-4">
                          <div className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-background" />
                          <div className="bg-card border border-border rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground capitalize">{(event.event_type || 'update').replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(event.created_at)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Communications */}
              {activeTab === 'communications' && (
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.sender_role === 'admin' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          msg.sender_role === 'admin' ? 'bg-primary text-white' : 'bg-secondary text-foreground'
                        }`}>
                          {msg.sender_role === 'admin' ? 'A' : 'C'}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                          msg.sender_role === 'admin' ?'bg-primary text-white rounded-tr-sm' :'bg-secondary/60 text-foreground rounded-tl-sm border border-border'
                        }`}>
                          <p className="text-xs leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender_role === 'admin' ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Invoices */}
              {activeTab === 'invoices' && (
                <div className="space-y-2">
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No invoices found for this case.</p>
                  ) : (
                    invoices.map((inv) => {
                      const statusColors: Record<string, string> = {
                        paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        pending: 'bg-amber-50 text-amber-700 border-amber-200',
                        overdue: 'bg-red-50 text-red-700 border-red-200',
                        draft: 'bg-gray-50 text-gray-500 border-gray-200',
                      };
                      let cls = statusColors[inv.status] || statusColors.draft;
                      return (
                        <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(inv.amount)}</p>
                            <p className="text-xs text-muted-foreground truncate">{inv.description || 'Invoice'} {inv.due_date ? `· Due ${formatDate(inv.due_date)}` : ''}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
                            {inv.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActiveCasesDashboard() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedRow, setSelectedRow] = useState<CaseRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch active cases (active_client + proposal_sent + consultation_booked)
      const { data: cases, error: casesErr } = await supabase
        .from('contact_inquiries')
        .select('id,name,firm,email,service,status,booking_stage,notes,created_at,updated_at')
        .in('booking_stage', ['active_client', 'proposal_sent', 'consultation_booked', 'inquiry'])
        .order('updated_at', { ascending: false });

      if (casesErr) throw casesErr;
      if (!cases || cases.length === 0) {
        setRows([]);
        return;
      }

      const caseIds = cases.map((c) => c.id);

      // Fetch engagements, deadlines, invoices in parallel
      const [engRes, deadlineRes, invoiceRes] = await Promise.all([
        supabase
          .from('engagements')
          .select('id,inquiry_id,title,retainer_amount,retainer_tier,status,start_date,end_date')
          .in('inquiry_id', caseIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('scheduled_events')
          .select('id,inquiry_id,title,due_date,event_type,status')
          .in('inquiry_id', caseIds)
          .gte('due_date', new Date().toISOString().split('T')[0])
          .order('due_date', { ascending: true }),
        supabase
          .from('client_invoices')
          .select('id,inquiry_id,amount,status,due_date')
          .in('inquiry_id', caseIds),
      ]);

      const engagements: Engagement[] = engRes.data || [];
      const deadlines: Deadline[] = deadlineRes.data || [];
      const invoices: Invoice[] = invoiceRes.data || [];

      // Build rows
      const built: CaseRow[] = cases.map((c) => {
        const eng = engagements.find((e) => e.inquiry_id === c.id) || null;
        const caseDeadlines = deadlines.filter((d) => d.inquiry_id === c.id);
        const nextDeadline = caseDeadlines.length > 0 ? caseDeadlines[0] : null;
        const caseInvoices = invoices.filter((i) => i.inquiry_id === c.id);
        const invoiceSummary = caseInvoices.length > 0
          ? {
              total: caseInvoices.reduce((s, i) => s + (i.amount || 0), 0),
              outstanding: caseInvoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + (i.amount || 0), 0),
              count: caseInvoices.length,
            }
          : null;
        return { caseData: c, engagement: eng, nextDeadline, invoiceSummary };
      });

      setRows(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load active cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.caseData.name.toLowerCase().includes(search.toLowerCase()) ||
      r.caseData.email.toLowerCase().includes(search.toLowerCase()) ||
      r.caseData.service.toLowerCase().includes(search.toLowerCase()) ||
      (r.caseData.firm || '').toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || r.caseData.booking_stage === stageFilter;
    return matchSearch && matchStage;
  });

  // Summary stats
  const totalRetainer = rows.reduce((s, r) => s + (r.engagement?.retainer_amount || 0), 0);
  const overdueDeadlines = rows.filter((r) => r.nextDeadline && daysUntil(r.nextDeadline.due_date) <= 3).length;
  const outstandingInvoices = rows.reduce((s, r) => s + (r.invoiceSummary?.outstanding || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-red-700 font-medium">{error}</p>
        <button onClick={fetchData} className="mt-3 text-xs text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Cases" value={String(rows.length)} sub="across all stages" />
        <StatCard
          label="Total Retainer"
          value={formatCurrency(totalRetainer)}
          sub="from active engagements"
          accent="text-emerald-700"
        />
        <StatCard
          label="Upcoming Deadlines"
          value={String(overdueDeadlines)}
          sub="within 3 days"
          accent={overdueDeadlines > 0 ? 'text-red-600' : 'text-foreground'}
        />
        <StatCard
          label="Outstanding Invoices"
          value={formatCurrency(outstandingInvoices)}
          sub="unpaid balance"
          accent={outstandingInvoices > 0 ? 'text-amber-700' : 'text-foreground'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by client, email, or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
        >
          <option value="all">All Stages</option>
          <option value="active_client">Active Client</option>
          <option value="proposal_sent">Proposal Sent</option>
          <option value="consultation_booked">Consultation Booked</option>
          <option value="inquiry">Inquiry</option>
        </select>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-card border border-border rounded-xl hover:bg-secondary/40 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Cases Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No active cases found</p>
          <p className="text-xs text-muted-foreground">
            {search || stageFilter !== 'all' ? 'Try adjusting your filters.' : 'Cases in active, proposal, or consultation stages will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Retainer</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next Deadline</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoices</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => (
                  <tr key={row.caseData.id} className="hover:bg-secondary/10 transition-colors group">
                    {/* Client */}
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-foreground">{row.caseData.name}</p>
                        <p className="text-xs text-muted-foreground">{row.caseData.firm || row.caseData.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{row.caseData.service}</p>
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STAGE_COLORS[row.caseData.booking_stage || 'inquiry'] || STAGE_COLORS.inquiry}`}>
                        {STAGE_LABELS[row.caseData.booking_stage || 'inquiry'] || 'Inquiry'}
                      </span>
                    </td>
                    {/* Retainer */}
                    <td className="px-4 py-4">
                      {row.engagement ? (
                        <div>
                          <p className={`font-semibold text-sm ${RETAINER_TIER_COLORS[row.engagement.retainer_tier] || 'text-foreground'}`}>
                            {row.engagement.retainer_amount ? formatCurrency(row.engagement.retainer_amount) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{row.engagement.retainer_tier}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No retainer</span>
                      )}
                    </td>
                    {/* Next Deadline */}
                    <td className="px-4 py-4">
                      <DeadlineBadge deadline={row.nextDeadline} />
                    </td>
                    {/* Invoices */}
                    <td className="px-4 py-4">
                      {row.invoiceSummary ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatCurrency(row.invoiceSummary.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.invoiceSummary.outstanding > 0
                              ? <span className="text-amber-600">{formatCurrency(row.invoiceSummary.outstanding)} outstanding</span>
                              : 'All paid'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Quick Access */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <QuickAction
                          icon={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                          }
                          label="Documents"
                          onClick={() => { setSelectedRow(row); }}
                          color="blue"
                        />
                        <QuickAction
                          icon={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                            </svg>
                          }
                          label="Timeline"
                          onClick={() => { setSelectedRow(row); }}
                          color="default"
                        />
                        <QuickAction
                          icon={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          }
                          label="Messages"
                          onClick={() => { setSelectedRow(row); }}
                          color="default"
                        />
                        <QuickAction
                          icon={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                            </svg>
                          }
                          label="Invoices"
                          onClick={() => { setSelectedRow(row); }}
                          color="amber"
                        />
                        <Link
                          href={`/admin/cases/${row.caseData.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                          title="Open full case"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          <span className="hidden lg:inline">Open</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map((row) => (
              <div key={row.caseData.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.caseData.name}</p>
                    <p className="text-xs text-muted-foreground">{row.caseData.service}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${STAGE_COLORS[row.caseData.booking_stage || 'inquiry'] || STAGE_COLORS.inquiry}`}>
                    {STAGE_LABELS[row.caseData.booking_stage || 'inquiry'] || 'Inquiry'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Retainer</p>
                    <p className="font-semibold text-foreground">
                      {row.engagement?.retainer_amount ? formatCurrency(row.engagement.retainer_amount) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Next Deadline</p>
                    <DeadlineBadge deadline={row.nextDeadline} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedRow(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Docs
                  </button>
                  <button
                    onClick={() => setSelectedRow(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary/60 text-foreground border border-border"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    Timeline
                  </button>
                  <button
                    onClick={() => setSelectedRow(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                    Invoices
                  </button>
                  <Link
                    href={`/admin/cases/${row.caseData.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-white"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-secondary/10 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filtered.length}</span> of <span className="font-medium text-foreground">{rows.length}</span> active cases
            </p>
            <Link
              href="/admin/cases"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all cases →
            </Link>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedRow && (
        <CaseDetailDrawer
          caseRow={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
