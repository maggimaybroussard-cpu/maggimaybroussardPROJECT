'use client';

import React, { useMemo, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDetail {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status: string;
  booking_stage: string | null;
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
  document_type?: string | null;
  requires_client_review?: boolean;
  created_at: string;
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

interface Invoice {
  id: string;
  invoice_number: string;
  due_date: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  created_at: string;
  description: string | null;
}

interface TimelineEvent {
  id: string;
  event_title: string;
  event_description: string | null;
  event_date: string;
}

interface CaseTimelineViewProps {
  caseDetail: CaseDetail;
  documents: CaseDocument[];
  engagements: Engagement[];
  invoices: Invoice[];
  timeline: TimelineEvent[];
}

// ── Unified event type ────────────────────────────────────────────────────────

type EventKind = 'document' | 'engagement' | 'payment' | 'review_flag' | 'case_event' | 'case_created';

interface UnifiedEvent {
  id: string;
  kind: EventKind;
  timestamp: string;
  title: string;
  description: string | null;
  meta?: string | null;
  badge?: string | null;
  badgeColor?: string;
  flagged?: boolean;
  amount?: number;
  currency?: string;
  paymentStatus?: string;
  docType?: string | null;
  engagementStatus?: string;
  retainerTier?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

const DOC_TYPE_COLORS: Record<string, string> = {
  contract: 'bg-purple-50 text-purple-700 border-purple-200',
  filing: 'bg-blue-50 text-blue-700 border-blue-200',
  correspondence: 'bg-sky-50 text-sky-700 border-sky-200',
  invoice: 'bg-amber-50 text-amber-700 border-amber-200',
  evidence: 'bg-rose-50 text-rose-700 border-rose-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ENGAGEMENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-500 border-gray-200',
};

const RETAINER_TIER_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600 border-gray-200',
  starter: 'bg-blue-50 text-blue-700 border-blue-200',
  professional: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
  custom: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ── Icon components ───────────────────────────────────────────────────────────

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function EngagementIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function CaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── Kind config ───────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<EventKind, { label: string; iconBg: string; iconColor: string; dotColor: string }> = {
  document: { label: 'Document', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', dotColor: 'bg-blue-400' },
  engagement: { label: 'Engagement', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', dotColor: 'bg-purple-400' },
  payment: { label: 'Payment', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', dotColor: 'bg-emerald-400' },
  review_flag: { label: 'Review Flag', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', dotColor: 'bg-amber-400' },
  case_event: { label: 'Case Event', iconBg: 'bg-slate-100', iconColor: 'text-slate-600', dotColor: 'bg-slate-400' },
  case_created: { label: 'Case Created', iconBg: 'bg-foreground/10', iconColor: 'text-foreground', dotColor: 'bg-foreground' },
};

function KindIcon({ kind }: { kind: EventKind }) {
  if (kind === 'document' || kind === 'review_flag') return <DocIcon />;
  if (kind === 'engagement') return <EngagementIcon />;
  if (kind === 'payment') return <PaymentIcon />;
  if (kind === 'review_flag') return <FlagIcon />;
  return <CaseIcon />;
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterKind = 'all' | EventKind;

const FILTER_OPTIONS: { value: FilterKind; label: string }[] = [
  { value: 'all', label: 'All Events' },
  { value: 'document', label: 'Documents' },
  { value: 'review_flag', label: 'Review Flags' },
  { value: 'engagement', label: 'Engagements' },
  { value: 'payment', label: 'Payments' },
  { value: 'case_event', label: 'Case Events' },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseTimelineView({
  caseDetail,
  documents,
  engagements,
  invoices,
  timeline,
}: CaseTimelineViewProps) {
  const [filter, setFilter] = useState<FilterKind>('all');

  const events = useMemo<UnifiedEvent[]>(() => {
    const result: UnifiedEvent[] = [];

    // Case created
    result.push({
      id: `case-created-${caseDetail.id}`,
      kind: 'case_created',
      timestamp: caseDetail.created_at,
      title: 'Case opened',
      description: `${caseDetail.name} — case record created`,
      meta: null,
    });

    // Document uploads
    documents.forEach((doc) => {
      result.push({
        id: `doc-${doc.id}`,
        kind: 'document',
        timestamp: doc.created_at,
        title: doc.file_name,
        description: `Uploaded by ${doc.uploaded_by}`,
        meta: [doc.category, doc.document_type, formatFileSize(doc.file_size)].filter(Boolean).join(' · ') || null,
        badge: doc.document_type ?? doc.category ?? null,
        badgeColor: DOC_TYPE_COLORS[doc.document_type?.toLowerCase() ?? ''] ?? DOC_TYPE_COLORS['other'],
        docType: doc.document_type,
        flagged: false,
      });

      // Separate review flag event if flagged
      if (doc.requires_client_review) {
        result.push({
          id: `review-flag-${doc.id}`,
          kind: 'review_flag',
          timestamp: doc.created_at,
          title: `Review requested: ${doc.file_name}`,
          description: 'Document flagged for client review',
          meta: doc.category ?? null,
          flagged: true,
        });
      }
    });

    // Engagement changes
    engagements.forEach((eng) => {
      result.push({
        id: `eng-${eng.id}`,
        kind: 'engagement',
        timestamp: eng.created_at,
        title: eng.title,
        description: eng.description ?? null,
        meta: [
          eng.matter_number ? `Matter #${eng.matter_number}` : null,
          eng.engagement_type.replace(/_/g, ' '),
          eng.start_date ? `Started ${formatDateShort(eng.start_date)}` : null,
        ].filter(Boolean).join(' · ') || null,
        badge: eng.status,
        badgeColor: ENGAGEMENT_STATUS_COLORS[eng.status] ?? ENGAGEMENT_STATUS_COLORS['pending'],
        engagementStatus: eng.status,
        retainerTier: eng.retainer_tier,
      });
    });

    // Payment / invoice events
    invoices.forEach((inv) => {
      // Invoice created
      result.push({
        id: `inv-created-${inv.id}`,
        kind: 'payment',
        timestamp: inv.created_at,
        title: `Invoice ${inv.invoice_number} issued`,
        description: inv.description ?? null,
        meta: inv.due_date ? `Due ${formatDateShort(inv.due_date)}` : null,
        badge: inv.status,
        badgeColor: INVOICE_STATUS_COLORS[inv.status] ?? INVOICE_STATUS_COLORS['draft'],
        amount: inv.amount,
        currency: inv.currency,
        paymentStatus: inv.status,
      });

      // Paid event
      if (inv.status === 'paid' && inv.amount_paid > 0) {
        result.push({
          id: `inv-paid-${inv.id}`,
          kind: 'payment',
          timestamp: inv.updated_at ?? inv.created_at,
          title: `Payment received: ${inv.invoice_number}`,
          description: `${formatCurrency(inv.amount_paid, inv.currency)} collected`,
          meta: null,
          badge: 'paid',
          badgeColor: INVOICE_STATUS_COLORS['paid'],
          amount: inv.amount_paid,
          currency: inv.currency,
          paymentStatus: 'paid',
        });
      }

      // Overdue event
      if (inv.status === 'overdue') {
        result.push({
          id: `inv-overdue-${inv.id}`,
          kind: 'payment',
          timestamp: inv.due_date ?? inv.created_at,
          title: `Invoice overdue: ${inv.invoice_number}`,
          description: `${formatCurrency(inv.amount - (inv.amount_paid ?? 0), inv.currency)} outstanding`,
          meta: null,
          badge: 'overdue',
          badgeColor: INVOICE_STATUS_COLORS['overdue'],
          amount: inv.amount - (inv.amount_paid ?? 0),
          currency: inv.currency,
          paymentStatus: 'overdue',
        });
      }
    });

    // Case timeline events (from case_timeline table)
    timeline.forEach((ev) => {
      result.push({
        id: `timeline-${ev.id}`,
        kind: 'case_event',
        timestamp: ev.event_date,
        title: ev.event_title,
        description: ev.event_description ?? null,
        meta: null,
      });
    });

    // Sort descending (newest first)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return result;
  }, [caseDetail, documents, engagements, invoices, timeline]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.kind === filter);
  }, [events, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; events: UnifiedEvent[] }[] = [];
    const map = new Map<string, UnifiedEvent[]>();
    filtered.forEach((ev) => {
      const dateKey = new Date(ev.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ev);
    });
    map.forEach((evs, date) => groups.push({ date, events: evs }));
    return groups;
  }, [filtered]);

  const reviewFlagCount = events.filter((e) => e.kind === 'review_flag').length;
  const docCount = events.filter((e) => e.kind === 'document').length;
  const paymentCount = events.filter((e) => e.kind === 'payment').length;
  const engagementCount = events.filter((e) => e.kind === 'engagement').length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Documents', count: docCount, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Engagements', count: engagementCount, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
          { label: 'Payment Events', count: paymentCount, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Review Flags', count: reviewFlagCount, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3 ${s.bg}`}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              filter === opt.value
                ? 'bg-foreground text-background'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                filter === opt.value ? 'bg-background/20 text-background' : 'bg-foreground/10 text-foreground'
              }`}>
                {events.filter((e) => e.kind === opt.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-5 py-14 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-3">
            <CaseIcon />
          </div>
          <p className="text-sm text-muted-foreground">No events match the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{group.date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Events for this date */}
              <div className="space-y-2.5">
                {group.events.map((ev, idx) => {
                  const cfg = KIND_CONFIG[ev.kind];
                  return (
                    <div key={ev.id} className="flex gap-3.5">
                      {/* Timeline spine */}
                      <div className="flex flex-col items-center shrink-0 pt-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg} ${cfg.iconColor} border border-border/60`}>
                          {ev.kind === 'review_flag' ? <FlagIcon /> : <KindIcon kind={ev.kind} />}
                        </div>
                        {idx < group.events.length - 1 && (
                          <div className="w-px flex-1 bg-border/60 mt-1.5 min-h-[16px]" />
                        )}
                      </div>

                      {/* Event card */}
                      <div className={`flex-1 min-w-0 bg-card border rounded-2xl px-4 py-3.5 mb-0.5 transition-colors hover:bg-secondary/20 ${
                        ev.kind === 'review_flag' ? 'border-amber-200 bg-amber-50/40' :
                        ev.kind === 'payment' && ev.paymentStatus === 'overdue' ? 'border-red-200 bg-red-50/30' :
                        ev.kind === 'payment'&& ev.paymentStatus === 'paid' ? 'border-emerald-200 bg-emerald-50/30' : 'border-border'
                      }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {/* Kind label */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cfg.iconBg} ${cfg.iconColor} border-transparent`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                                {cfg.label}
                              </span>

                              {/* Status / type badge */}
                              {ev.badge && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${ev.badgeColor}`}>
                                  {ev.badge.replace(/_/g, ' ')}
                                </span>
                              )}

                              {/* Retainer tier for engagements */}
                              {ev.retainerTier && ev.retainerTier !== 'none' && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${RETAINER_TIER_COLORS[ev.retainerTier] ?? RETAINER_TIER_COLORS['none']}`}>
                                  {ev.retainerTier}
                                </span>
                              )}
                            </div>

                            <p className={`text-sm font-semibold leading-snug ${
                              ev.kind === 'review_flag' ? 'text-amber-800' :
                              ev.kind === 'payment'&& ev.paymentStatus === 'overdue' ? 'text-red-700' : 'text-foreground'
                            }`}>
                              {ev.title}
                            </p>

                            {ev.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.description}</p>
                            )}

                            {ev.meta && (
                              <p className="text-[11px] text-muted-foreground mt-1 capitalize">{ev.meta}</p>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            {/* Amount for payment events */}
                            {ev.amount !== undefined && ev.amount > 0 && (
                              <p className={`text-sm font-bold ${
                                ev.paymentStatus === 'paid' ? 'text-emerald-600' :
                                ev.paymentStatus === 'overdue'? 'text-red-600' : 'text-foreground'
                              }`}>
                                {formatCurrency(ev.amount, ev.currency ?? 'usd')}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
