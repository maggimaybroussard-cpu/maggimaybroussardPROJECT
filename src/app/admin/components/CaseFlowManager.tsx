'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseFlow {
  id: string;
  name: string;
  email: string;
  firm: string | null;
  service: string;
  status: string;
  booking_stage: string | null;
  created_at: string;
  updated_at: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
  notes: string | null;
}

interface CaseInvoice {
  id: string;
  inquiry_id: string;
  invoice_number: string;
  amount: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
}

interface CaseDocument {
  id: string;
  inquiry_id: string;
  file_name: string;
  created_at: string;
}

interface CaseMessage {
  id: string;
  inquiry_id: string;
  body: string;
  sender_role: string;
  created_at: string;
}

interface CaseFlowEnriched extends CaseFlow {
  invoices: CaseInvoice[];
  documents: CaseDocument[];
  messages: CaseMessage[];
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  overdueCount: number;
  unreadMessages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STAGE_CONFIG: Record<string, { label: string; pill: string; dot: string; order: number }> = {
  inquiry:          { label: 'Inquiry',          pill: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   order: 0 },
  intake:           { label: 'Intake',            pill: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500',    order: 1 },
  consultation:     { label: 'Consultation',      pill: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500',  order: 2 },
  proposal_sent:    { label: 'Proposal Sent',     pill: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500',   order: 3 },
  active_client:    { label: 'Active',            pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', order: 4 },
  active:           { label: 'Active',            pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', order: 4 },
  billed:           { label: 'Billed',            pill: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500',  order: 5 },
  closed:           { label: 'Closed',            pill: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400',    order: 6 },
};

function resolveStage(c: CaseFlow): string {
  const raw = (c.booking_stage ?? '').toLowerCase().trim().replace(/\s+/g, '_');
  if (STAGE_CONFIG[raw]) return raw;
  if (c.status === 'new' || c.status === 'in_review') return 'intake';
  if (c.status === 'contacted') return 'active';
  if (c.status === 'closed') return 'closed';
  return 'inquiry';
}

const FLOW_STAGES = ['inquiry', 'intake', 'consultation', 'proposal_sent', 'active_client', 'billed', 'closed'];

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseFlowManager() {
  const [cases, setCases] = useState<CaseFlowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseFlowEnriched | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'invoices' | 'documents' | 'messages'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [inquiriesRes, invoicesRes, docsRes, messagesRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('id,name,email,firm,service,status,booking_stage,created_at,updated_at,calendly_start_time,calendly_event_name,notes')
          .order('updated_at', { ascending: false })
          .limit(200),
        supabase
          .from('client_invoices')
          .select('id,inquiry_id,invoice_number,amount,amount_paid,status,due_date')
          .order('created_at', { ascending: false }),
        supabase
          .from('case_documents')
          .select('id,inquiry_id,file_name,created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('portal_messages')
          .select('id,inquiry_id,body,sender_role,created_at,read_at')
          .order('created_at', { ascending: false }),
      ]);

      const inquiries: CaseFlow[] = inquiriesRes.data || [];
      const invoices: CaseInvoice[] = invoicesRes.data || [];
      const docs: CaseDocument[] = docsRes.data || [];
      const msgs: CaseMessage[] = (messagesRes.data || []) as CaseMessage[];

      const enriched: CaseFlowEnriched[] = inquiries.map((c) => {
        const cInvoices = invoices.filter((i) => i.inquiry_id === c.id);
        const cDocs = docs.filter((d) => d.inquiry_id === c.id);
        const cMsgs = msgs.filter((m) => m.inquiry_id === c.id);
        const totalBilled = cInvoices.reduce((s, i) => s + (i.amount || 0), 0);
        const totalPaid = cInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
        const outstanding = Math.max(0, totalBilled - totalPaid);
        const overdueCount = cInvoices.filter((i) => i.status === 'overdue').length;
        const unreadMessages = cMsgs.filter((m) => m.sender_role === 'client').length;
        return { ...c, invoices: cInvoices, documents: cDocs, messages: cMsgs, totalBilled, totalPaid, outstanding, overdueCount, unreadMessages };
      });

      setCases(enriched);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = cases.filter((c) => {
    const stage = resolveStage(c);
    const matchStage = selectedStage === 'all' || stage === selectedStage;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.firm ?? '').toLowerCase().includes(q) || c.service.toLowerCase().includes(q);
    return matchStage && matchSearch;
  });

  const stageCounts = FLOW_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = cases.filter((c) => resolveStage(c) === s).length;
    return acc;
  }, {});

  const totalOutstanding = cases.reduce((s, c) => s + c.outstanding, 0);
  const totalBilled = cases.reduce((s, c) => s + c.totalBilled, 0);
  const activeCount = cases.filter((c) => ['active_client', 'active', 'billed'].includes(resolveStage(c))).length;
  const overdueTotal = cases.filter((c) => c.overdueCount > 0).length;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases', value: cases.length.toString(), sub: `${activeCount} active`, icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          ), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Billed', value: fmt(totalBilled), sub: 'all time', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
          ), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Outstanding', value: fmt(totalOutstanding), sub: 'unpaid balance', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ), color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overdue Cases', value: overdueTotal.toString(), sub: 'need attention', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          ), color: 'text-red-600', bg: 'bg-red-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Flow Stage Pipeline */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Case Pipeline</p>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {FLOW_STAGES.map((stage, idx) => {
            const cfg = STAGE_CONFIG[stage];
            const count = stageCounts[stage] || 0;
            const isSelected = selectedStage === stage;
            return (
              <React.Fragment key={stage}>
                <button
                  onClick={() => setSelectedStage(isSelected ? 'all' : stage)}
                  className={`flex-1 min-w-[90px] flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all text-center ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <span className={`text-xl font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{count}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{cfg.label}</span>
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                </button>
                {idx < FLOW_STAGES.length - 1 && (
                  <div className="flex items-center text-muted-foreground/40 shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, firm, or service…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedStage('all'); setSearchQuery(''); }}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            Clear
          </button>
          <span className="text-sm text-muted-foreground">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Case List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No cases found</p>
          <p className="text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const stage = resolveStage(c);
            const stageCfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG.inquiry;
            const isExpanded = expandedId === c.id;
            const nextDeadline = c.calendly_start_time;
            const daysUntil = nextDeadline ? getDaysUntil(nextDeadline) : null;

            return (
              <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-sm">
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {/* Stage dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stageCfg.dot}`} />

                  {/* Case info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${stageCfg.pill}`}>
                        {stageCfg.label}
                      </span>
                      {c.overdueCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                          {c.overdueCount} overdue
                        </span>
                      )}
                      {c.unreadMessages > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                          {c.unreadMessages} msg{c.unreadMessages !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.service}{c.firm ? ` · ${c.firm}` : ''} · {c.email}
                    </p>
                  </div>

                  {/* Deadline */}
                  {daysUntil !== null && (
                    <div className="hidden sm:block text-right shrink-0">
                      <p className={`text-xs font-semibold ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : daysUntil === 0 ? 'Today' : `In ${daysUntil}d`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{c.calendly_event_name ?? 'Consultation'}</p>
                    </div>
                  )}

                  {/* Billing */}
                  <div className="text-right shrink-0">
                    {c.totalBilled > 0 ? (
                      <>
                        <p className="text-sm font-bold text-foreground">{fmt(c.totalBilled)}</p>
                        {c.outstanding > 0 ? (
                          <p className="text-xs text-amber-600 font-medium">{fmt(c.outstanding)} due</p>
                        ) : (
                          <p className="text-xs text-emerald-600 font-medium">Paid in full</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No invoices</p>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20">
                    {/* Drawer Tabs */}
                    <div className="flex items-center gap-1 px-5 pt-4 pb-0">
                      {(['overview', 'invoices', 'documents', 'messages'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => { setSelectedCase(c); setDrawerTab(tab); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                            selectedCase?.id === c.id && drawerTab === tab
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tab === 'invoices' ? `Invoices (${c.invoices.length})` :
                           tab === 'documents' ? `Docs (${c.documents.length})` :
                           tab === 'messages' ? `Messages (${c.messages.length})` :
                           'Overview'}
                        </button>
                      ))}
                    </div>

                    <div className="px-5 py-4">
                      {/* Overview Tab */}
                      {(selectedCase?.id !== c.id || drawerTab === 'overview') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Case Details</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-medium text-foreground">{c.service}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${stageCfg.pill}`}>{stageCfg.label}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground">{fmtDate(c.created_at)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="text-foreground">{fmtDate(c.updated_at)}</span></div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Billing Summary</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-medium text-foreground">{fmt(c.totalBilled)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Total Paid</span><span className="text-emerald-600 font-medium">{fmt(c.totalPaid)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className={`font-bold ${c.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(c.outstanding)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Invoices</span><span className="text-foreground">{c.invoices.length}</span></div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Activity</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Documents</span><span className="text-foreground">{c.documents.length}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Messages</span><span className="text-foreground">{c.messages.length}</span></div>
                              {c.calendly_start_time && (
                                <div className="flex justify-between"><span className="text-muted-foreground">Next Event</span><span className="text-foreground">{fmtDate(c.calendly_start_time)}</span></div>
                              )}
                              {c.notes && (
                                <div className="mt-2 p-2 bg-background rounded-lg border border-border/60">
                                  <p className="text-xs text-muted-foreground">{c.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Invoices Tab */}
                      {selectedCase?.id === c.id && drawerTab === 'invoices' && (
                        <div>
                          {c.invoices.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No invoices for this case.</p>
                          ) : (
                            <div className="space-y-2">
                              {c.invoices.map((inv) => {
                                const balance = Math.max(0, inv.amount - (inv.amount_paid || 0));
                                const statusCfg: Record<string, string> = {
                                  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                  sent: 'bg-blue-50 text-blue-700 border-blue-200',
                                  pending: 'bg-amber-50 text-amber-700 border-amber-200',
                                  overdue: 'bg-red-50 text-red-700 border-red-200',
                                  draft: 'bg-gray-100 text-gray-500 border-gray-200',
                                };
                                return (
                                  <div key={inv.id} className="flex items-center justify-between gap-4 p-3 bg-background rounded-xl border border-border/60">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{inv.invoice_number}</p>
                                      {inv.due_date && <p className="text-xs text-muted-foreground">Due {fmtDate(inv.due_date)}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg[inv.status] ?? statusCfg.draft}`}>
                                        {inv.status === 'sent' ? 'Due' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                      </span>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">{fmt(inv.amount)}</p>
                                        {balance > 0 && inv.status !== 'paid' && (
                                          <p className="text-xs text-amber-600">{fmt(balance)} due</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Documents Tab */}
                      {selectedCase?.id === c.id && drawerTab === 'documents' && (
                        <div>
                          {c.documents.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No documents uploaded for this case.</p>
                          ) : (
                            <div className="space-y-2">
                              {c.documents.slice(0, 10).map((doc) => (
                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/60">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">{fmtDate(doc.created_at)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Messages Tab */}
                      {selectedCase?.id === c.id && drawerTab === 'messages' && (
                        <div>
                          {c.messages.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No messages for this case.</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {c.messages.slice(0, 10).map((msg) => (
                                <div key={msg.id} className={`flex gap-3 ${msg.sender_role === 'admin' ? 'flex-row-reverse' : ''}`}>
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.sender_role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {msg.sender_role === 'admin' ? 'A' : 'C'}
                                  </div>
                                  <div className={`flex-1 max-w-xs p-3 rounded-xl text-sm ${msg.sender_role === 'admin' ? 'bg-primary/10 text-foreground' : 'bg-background border border-border text-foreground'}`}>
                                    <p>{msg.body}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(msg.created_at)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/60">
                        <a
                          href={`/admin/cases/${c.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open Case
                        </a>
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Email Client
                        </a>
                        {c.outstanding > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {fmt(c.outstanding)} outstanding
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
