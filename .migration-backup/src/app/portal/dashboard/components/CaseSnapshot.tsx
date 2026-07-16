'use client';

import React from 'react';
import Link from 'next/link';

interface Inquiry {
  id: string;
  name: string;
  service: string;
  status: string;
  booking_stage: string;
  created_at: string;
  calendly_event_uuid: string | null;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
}

interface Invoice {
  id: string;
  status: string;
  amount: number;
  due_date: string;
}

interface Payment {
  id: string;
  payment_status: string;
  payment_type: string;
}

interface CaseSnapshotProps {
  inquiry: Inquiry;
  invoices: Invoice[];
  payments: Payment[];
}

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  dot: string;
  ring: string;
  description: string;
  order: number;
}> = {
  intake: {
    label: 'Intake',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.08)',
    dot: '#2563EB',
    ring: 'rgba(37,99,235,0.2)',
    description: 'Gathering information and reviewing your matter.',
    order: 1,
  },
  active: {
    label: 'Active',
    color: '#355E3B',
    bg: 'rgba(53,94,59,0.08)',
    dot: '#355E3B',
    ring: 'rgba(53,94,59,0.2)',
    description: 'Your case is actively being worked on.',
    order: 2,
  },
  billed: {
    label: 'Billed',
    color: '#C8965A',
    bg: 'rgba(200,150,90,0.08)',
    dot: '#C8965A',
    ring: 'rgba(200,150,90,0.2)',
    description: 'Work is complete and invoices have been issued.',
    order: 3,
  },
  closed: {
    label: 'Closed',
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.08)',
    dot: '#6B7280',
    ring: 'rgba(107,114,128,0.2)',
    description: 'Your engagement has been completed.',
    order: 4,
  },
};

// Fallback: derive stage from inquiry status if booking_stage is missing
function resolveStage(inquiry: Inquiry): string {
  const raw = (inquiry.booking_stage ?? '').toLowerCase().trim();
  if (STAGE_CONFIG[raw]) return raw;
  // Map old status values to stages
  if (inquiry.status === 'new' || inquiry.status === 'in_review') return 'intake';
  if (inquiry.status === 'contacted') return 'active';
  if (inquiry.status === 'closed') return 'closed';
  return 'intake';
}

// ── Deliverables per stage ────────────────────────────────────────────────────
function getDeliverables(stage: string, inquiry: Inquiry, payments: Payment[], invoices: Invoice[]): {
  label: string;
  done: boolean;
}[] {
  const hasDeposit = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'consultation_deposit');
  const hasRetainer = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'retainer');
  const hasConsultation = !!(inquiry.calendly_event_uuid && inquiry.calendly_start_time);
  const hasPaidInvoice = invoices.some((i) => i.status === 'paid');

  if (stage === 'intake') {
    return [
      { label: 'Inquiry submitted', done: true },
      { label: 'Consultation deposit paid', done: hasDeposit },
      { label: 'Consultation scheduled', done: hasConsultation },
      { label: 'Engagement letter signed', done: hasRetainer },
    ];
  }
  if (stage === 'active') {
    return [
      { label: 'Intake complete', done: true },
      { label: 'Retainer agreement signed', done: hasRetainer },
      { label: 'Case documents uploaded', done: true },
      { label: 'Work product delivered', done: false },
    ];
  }
  if (stage === 'billed') {
    return [
      { label: 'Work product delivered', done: true },
      { label: 'Invoice issued', done: invoices.length > 0 },
      { label: 'Invoice paid', done: hasPaidInvoice },
      { label: 'Final review complete', done: hasPaidInvoice },
    ];
  }
  // closed
  return [
    { label: 'All deliverables completed', done: true },
    { label: 'Final invoice settled', done: hasPaidInvoice },
    { label: 'Case file archived', done: true },
    { label: 'Engagement closed', done: true },
  ];
}

// ── Action items per stage ────────────────────────────────────────────────────
function getActionItems(stage: string, inquiry: Inquiry, payments: Payment[], invoices: Invoice[]): {
  label: string;
  href?: string;
  urgent: boolean;
}[] {
  const hasDeposit = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'consultation_deposit');
  const hasRetainer = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'retainer');
  const hasConsultation = !!(inquiry.calendly_event_uuid && inquiry.calendly_start_time);
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'pending');

  const items: { label: string; href?: string; urgent: boolean }[] = [];

  if (stage === 'intake') {
    if (!hasDeposit) items.push({ label: 'Pay consultation deposit to confirm your booking', href: '/portal/billing', urgent: true });
    if (!hasConsultation) items.push({ label: 'Schedule your initial consultation', href: '/portal/dashboard', urgent: !hasDeposit ? false : true });
    if (!hasRetainer && hasConsultation) items.push({ label: 'Review and sign the engagement letter', href: '/portal/signatures', urgent: false });
  }

  if (stage === 'active') {
    if (!hasRetainer) items.push({ label: 'Sign retainer agreement to proceed', href: '/portal/signatures', urgent: true });
    if (overdueInvoices.length > 0) items.push({ label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} — payment required`, href: '/portal/invoices', urgent: true });
    items.push({ label: 'Upload any requested supporting documents', href: '/portal/documents', urgent: false });
  }

  if (stage === 'billed') {
    if (overdueInvoices.length > 0) items.push({ label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} — pay now`, href: '/portal/invoices', urgent: true });
    if (pendingInvoices.length > 0) items.push({ label: `${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? 's' : ''} awaiting payment`, href: '/portal/invoices', urgent: false });
    if (overdueInvoices.length === 0 && pendingInvoices.length === 0) items.push({ label: 'All invoices settled — thank you!', urgent: false });
  }

  if (stage === 'closed') {
    items.push({ label: 'Your case is closed. Contact us for future matters.', href: '/contact', urgent: false });
  }

  return items;
}

// ── Next milestone ────────────────────────────────────────────────────────────
function getNextMilestone(stage: string, inquiry: Inquiry, payments: Payment[]): string {
  const hasDeposit = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'consultation_deposit');
  const hasRetainer = payments.some((p) => p.payment_status === 'succeeded' && p.payment_type === 'retainer');
  const hasConsultation = !!(inquiry.calendly_event_uuid && inquiry.calendly_start_time);

  if (stage === 'intake') {
    if (!hasDeposit) return 'Pay consultation deposit';
    if (!hasConsultation) return 'Schedule initial consultation';
    if (!hasRetainer) return 'Sign engagement letter';
    return 'Await case assignment';
  }
  if (stage === 'active') {
    if (!hasRetainer) return 'Sign retainer agreement';
    return 'Receive work product from attorney';
  }
  if (stage === 'billed') return 'Settle outstanding invoices';
  return 'No further action required';
}

// ── Stage progress bar ────────────────────────────────────────────────────────
const STAGE_ORDER = ['intake', 'active', 'billed', 'closed'];

export default function CaseSnapshot({ inquiry, invoices, payments }: CaseSnapshotProps) {
  const stage = resolveStage(inquiry);
  const stageCfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['intake'];
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const progressPct = ((stageIndex + 1) / STAGE_ORDER.length) * 100;

  const deliverables = getDeliverables(stage, inquiry, payments, invoices);
  const actionItems = getActionItems(stage, inquiry, payments, invoices);
  const nextMilestone = getNextMilestone(stage, inquiry, payments);

  const completedCount = deliverables.filter((d) => d.done).length;
  const urgentActions = actionItems.filter((a) => a.urgent);
  const normalActions = actionItems.filter((a) => !a.urgent);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* ── Header strip ── */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: stageCfg.bg, borderBottom: `1px solid ${stageCfg.ring}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: stageCfg.ring }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: stageCfg.color }}>Case Snapshot</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">{inquiry.service}</p>
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
          style={{ background: stageCfg.ring, color: stageCfg.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageCfg.dot }} />
          {stageCfg.label}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Stage pipeline ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Stage Progress</p>
            <p className="text-xs text-muted-foreground font-light">{stageIndex + 1} of {STAGE_ORDER.length}</p>
          </div>
          <div className="relative h-2 bg-muted/40 rounded-full overflow-hidden mb-3">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: stageCfg.color }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {STAGE_ORDER.map((s, i) => {
              const cfg = STAGE_CONFIG[s];
              const isActive = s === stage;
              const isDone = i < stageIndex;
              return (
                <div key={s} className="text-center">
                  <div
                    className="w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center"
                    style={{
                      background: isDone ? '#355E3B' : isActive ? cfg.color : 'transparent',
                      border: isDone ? 'none' : isActive ? `2px solid ${cfg.color}` : '2px solid rgba(107,114,128,0.3)',
                    }}
                  >
                    {isDone && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {isActive && <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />}
                  </div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: isActive ? cfg.color : isDone ? '#355E3B' : 'rgba(107,114,128,0.6)' }}
                  >
                    {cfg.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-border/60" />

        {/* ── Two-column: Next milestone + Deliverables ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Next milestone */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: stageCfg.ring }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={stageCfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Next Milestone</p>
            </div>
            <div
              className="rounded-xl p-4 border"
              style={{ background: stageCfg.bg, borderColor: stageCfg.ring }}
            >
              <p className="text-sm font-semibold text-foreground leading-snug">{nextMilestone}</p>
              <p className="text-xs text-muted-foreground font-light mt-1">{stageCfg.description}</p>
            </div>
          </div>

          {/* Deliverables */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Deliverables</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#355E3B' }}>
                {completedCount}/{deliverables.length}
              </span>
            </div>
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: d.done ? '#355E3B' : 'transparent',
                      border: d.done ? 'none' : '1.5px solid rgba(107,114,128,0.35)',
                    }}
                  >
                    {d.done && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs leading-snug ${d.done ? 'text-foreground' : 'text-muted-foreground'} ${d.done ? '' : 'opacity-70'}`}>
                    {d.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Action items ── */}
        {actionItems.length > 0 && (
          <>
            <div className="border-t border-border/60" />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: urgentActions.length > 0 ? 'rgba(220,38,38,0.1)' : 'rgba(53,94,59,0.1)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={urgentActions.length > 0 ? '#DC2626' : '#355E3B'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Action Items</p>
                {urgentActions.length > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                    {urgentActions.length} urgent
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {[...urgentActions, ...normalActions].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
                    style={{
                      background: item.urgent ? 'rgba(220,38,38,0.04)' : 'rgba(53,94,59,0.03)',
                      borderColor: item.urgent ? 'rgba(220,38,38,0.2)' : 'rgba(53,94,59,0.15)',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: item.urgent ? 'rgba(220,38,38,0.12)' : 'rgba(53,94,59,0.1)' }}
                    >
                      {item.urgent ? (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-foreground flex-1 leading-snug">{item.label}</p>
                    {item.href && (
                      <Link
                        href={item.href}
                        className="text-[10px] font-semibold uppercase tracking-widest shrink-0 hover:underline"
                        style={{ color: item.urgent ? '#DC2626' : '#355E3B' }}
                      >
                        Go →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
