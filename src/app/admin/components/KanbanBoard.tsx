'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import CaseSearchPanel, { CaseSearchFilters } from './CaseSearchPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanCase {
  id: string;
  name: string;
  email: string;
  firm: string;
  service: string;
  booking_stage: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Deliverable {
  id: string;
  label: string;
  done: boolean;
}

interface CaseDeliverables {
  [caseId: string]: Deliverable[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_STAGES = [
  {
    id: 'intake',
    label: 'Intake',
    description: 'New inquiries & initial review',
    color: '#3b82f6',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    headerBg: 'bg-blue-500',
    bookingStages: ['inquiry'],
  },
  {
    id: 'active',
    label: 'Active',
    description: 'Consultation booked or proposal sent',
    color: '#355E3B',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    headerBg: 'bg-emerald-600',
    bookingStages: ['consultation_booked', 'proposal_sent', 'active_client'],
  },
  {
    id: 'billed',
    label: 'Billed',
    description: 'Work completed, invoice issued',
    color: '#d97706',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    headerBg: 'bg-amber-500',
    bookingStages: ['completed'],
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Case resolved & archived',
    color: '#6b7280',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    headerBg: 'bg-gray-400',
    bookingStages: ['closed'],
  },
];

const STAGE_TO_BOOKING: Record<string, string> = {
  intake: 'inquiry',
  active: 'active_client',
  billed: 'completed',
  closed: 'closed',
};

const DEFAULT_DELIVERABLES: Record<string, string[]> = {
  intake: [
    'Intake form received',
    'Conflict check completed',
    'Initial consultation scheduled',
    'Engagement letter sent',
  ],
  active: [
    'Retainer agreement signed',
    'Case file opened',
    'Research & discovery',
    'Draft work product',
    'Client review & approval',
  ],
  billed: [
    'Final deliverable sent',
    'Invoice issued',
    'Payment received',
  ],
  closed: [
    'File archived',
    'Client feedback requested',
    'Case closed in system',
  ],
};

const ACCENT = '#355E3B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStageForBooking(bookingStage: string): string {
  for (const stage of KANBAN_STAGES) {
    if (stage.bookingStages.includes(bookingStage)) return stage.id;
  }
  return 'intake';
}

function initDeliverables(caseId: string, stageId: string): Deliverable[] {
  const labels = DEFAULT_DELIVERABLES[stageId] ?? DEFAULT_DELIVERABLES['intake'];
  return labels.map((label, i) => ({
    id: `${caseId}-${i}`,
    label,
    done: false,
  }));
}

function loadDeliverables(caseId: string, stageId: string): Deliverable[] {
  if (typeof window === 'undefined') return initDeliverables(caseId, stageId);
  try {
    const stored = localStorage.getItem(`kanban_deliverables_${caseId}`);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return initDeliverables(caseId, stageId);
}

function saveDeliverables(caseId: string, deliverables: Deliverable[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`kanban_deliverables_${caseId}`, JSON.stringify(deliverables));
  } catch {
    // ignore
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Card Component ───────────────────────────────────────────────────────────

interface KanbanCardProps {
  caseItem: KanbanCase;
  stageId: string;
  onDragStart: (e: React.DragEvent, caseId: string) => void;
  onStageChange: (caseId: string, newStage: string) => void;
  allStages: typeof KANBAN_STAGES;
}

function KanbanCard({ caseItem, stageId, onDragStart, onStageChange, allStages }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDeliverables(loadDeliverables(caseItem.id, stageId));
  }, [caseItem.id, stageId]);

  const toggleDeliverable = (deliverableId: string) => {
    const updated = deliverables.map((d) =>
      d.id === deliverableId ? { ...d, done: !d.done } : d
    );
    setDeliverables(updated);
    saveDeliverables(caseItem.id, updated);
  };

  const completedCount = deliverables.filter((d) => d.done).length;
  const totalCount = deliverables.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentStage = allStages.find((s) => s.id === stageId);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, caseItem.id)}
      className="bg-card border border-border rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-accent/40 hover:shadow-sm transition-all duration-200 group"
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground text-sm leading-tight truncate">{caseItem.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{caseItem.firm || caseItem.email}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 w-6 h-6 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Service badge */}
      <div className="mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary/60 text-muted-foreground border border-border/60 truncate max-w-full">
          {caseItem.service}
        </span>
      </div>

      {/* Progress bar */}
      {mounted && totalCount > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Deliverables</span>
            <span className="text-[10px] text-muted-foreground">{completedCount}/{totalCount}</span>
          </div>
          <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#355E3B' : '#355E3B99' }}
            />
          </div>
        </div>
      )}

      {/* Expanded: Deliverable checklist */}
      {expanded && mounted && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Checklist</p>
          {deliverables.map((d) => (
            <label
              key={d.id}
              className="flex items-start gap-2 cursor-pointer group/item"
            >
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={d.done}
                  onChange={() => toggleDeliverable(d.id)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    d.done
                      ? 'border-transparent' :'border-border group-hover/item:border-accent/60'
                  }`}
                  style={d.done ? { background: ACCENT, borderColor: ACCENT } : {}}
                >
                  {d.done && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
              <span className={`text-xs leading-relaxed transition-colors ${d.done ? 'line-through text-muted-foreground/50' : 'text-foreground/80'}`}>
                {d.label}
              </span>
            </label>
          ))}

          {/* Move to stage buttons */}
          <div className="pt-3 mt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Move to Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {allStages
                .filter((s) => s.id !== stageId)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onStageChange(caseItem.id, s.id)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all hover:opacity-80"
                    style={{ borderColor: s.color, color: s.color, background: `${s.color}12` }}
                  >
                    → {s.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Meta */}
          <div className="pt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Added {formatDate(caseItem.created_at)}
          </div>
          <Link href={`/admin/cases/${caseItem.id}`}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            View Full Case Details →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Column Component ─────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: typeof KANBAN_STAGES[0];
  cases: KanbanCase[];
  onDragStart: (e: React.DragEvent, caseId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onStageChange: (caseId: string, newStage: string) => void;
  allStages: typeof KANBAN_STAGES;
  isDragOver: boolean;
}

function KanbanColumn({
  stage, cases, onDragStart, onDrop, onDragOver, onStageChange, allStages, isDragOver,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex flex-col min-w-[260px] w-full rounded-2xl border transition-all duration-200 ${
        isDragOver ? 'border-accent/60 shadow-md' : 'border-border'
      } bg-secondary/20`}
      onDrop={(e) => onDrop(e, stage.id)}
      onDragOver={onDragOver}
    >
      {/* Column Header */}
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: stage.color }}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">{stage.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{stage.description}</p>
          </div>
        </div>
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
          style={{ background: stage.color }}
        >
          {cases.length}
        </span>
      </div>

      {/* Drop zone indicator */}
      {isDragOver && (
        <div
          className="mx-3 mt-3 h-1.5 rounded-full opacity-60"
          style={{ background: stage.color }}
        />
      )}

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 min-h-[120px]">
        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mb-2 opacity-30"
              style={{ background: stage.color }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground/50">No cases</p>
          </div>
        ) : (
          cases.map((c) => (
            <KanbanCard
              key={c.id}
              caseItem={c}
              stageId={stage.id}
              onDragStart={onDragStart}
              onStageChange={onStageChange}
              allStages={allStages}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main KanbanBoard ─────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const [cases, setCases] = useState<KanbanCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CaseSearchFilters>({
    name: '',
    email: '',
    firm: '',
    service: '',
    status: '',
    stage: '',
    dateFrom: '',
    dateTo: '',
  });
  const dragCaseId = useRef<string | null>(null);
  const supabase = createClient();

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, firm, service, booking_stage, status, notes, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (err) throw err;
      setCases(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleDragStart = (e: React.DragEvent, caseId: string) => {
    dragCaseId.current = caseId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const caseId = dragCaseId.current;
    if (!caseId) return;
    dragCaseId.current = null;
    await moveCase(caseId, targetStageId);
  };

  const moveCase = async (caseId: string, targetStageId: string) => {
    const newBookingStage = STAGE_TO_BOOKING[targetStageId];
    if (!newBookingStage) return;

    const movedCase = cases.find((c) => c.id === caseId);
    const previousBookingStage = movedCase?.booking_stage ?? '';

    // Optimistic update
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, booking_stage: newBookingStage } : c
      )
    );

    setUpdatingId(caseId);
    try {
      const { error: err } = await supabase
        .from('contact_inquiries')
        .update({ booking_stage: newBookingStage, updated_at: new Date().toISOString() })
        .eq('id', caseId);
      if (err) throw err;

      // ── Case milestone notification (email + in-app) ──────────────────────
      if (movedCase?.email && movedCase?.name) {
        // Map booking_stage to milestone stage key
        const stageMap: Record<string, string> = {
          inquiry: 'new',
          consultation_booked: 'in_review',
          proposal_sent: 'in_review',
          active_client: 'active_client',
          completed: 'billed',
          closed: 'closed',
        };
        const prevStageKey = stageMap[previousBookingStage] ?? previousBookingStage;
        const newStageKey = stageMap[newBookingStage] ?? newBookingStage;

        fetch('/api/case-milestone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: movedCase.name,
            clientEmail: movedCase.email,
            caseName: movedCase.name,
            caseId: movedCase.id,
            service: movedCase.service,
            previousStage: prevStageKey,
            newStage: newStageKey,
          }),
        }).catch(() => { /* fire-and-forget */ });
      }
    } catch {
      // Revert on failure
      fetchCases();
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredCases = cases.filter((c) => {
    const { name, email, firm, service, status, stage, dateFrom, dateTo } = filters;

    if (name && !c.name?.toLowerCase().includes(name.toLowerCase())) return false;
    if (email && !c.email?.toLowerCase().includes(email.toLowerCase())) return false;
    if (firm && !c.firm?.toLowerCase().includes(firm.toLowerCase())) return false;
    if (service && !c.service?.toLowerCase().includes(service.toLowerCase())) return false;
    if (status && c.status !== status) return false;
    if (stage && c.booking_stage !== stage) return false;

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(c.created_at) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(c.created_at) > to) return false;
    }

    return true;
  });

  const getCasesForStage = (stageId: string) => {
    const stage = KANBAN_STAGES.find((s) => s.id === stageId);
    if (!stage) return [];
    return filteredCases.filter((c) => stage.bookingStages.includes(c.booking_stage));
  };

  const totalCases = cases.length;
  const activeCases = getCasesForStage('active').length;
  const billedCases = getCasesForStage('billed').length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KANBAN_STAGES.map((stage) => {
          const count = getCasesForStage(stage.id).length;
          return (
            <div key={stage.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{stage.label}</p>
              </div>
              <p className="text-3xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Panel */}
      <CaseSearchPanel
        filters={filters}
        onChange={setFilters}
        resultCount={filteredCases.length}
        totalCount={cases.length}
      />

      {/* Toolbar (refresh + saving indicator) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
          Drag cards between columns to update case stage — click the ↓ to expand checklist
        </div>
        <div className="flex items-center gap-2">
          {updatingId && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Saving…
            </span>
          )}
          <button
            onClick={fetchCases}
            className="px-3 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-medium hover:border-accent/50 transition-all flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.map((stage) => (
            <div key={stage.id} className="bg-secondary/20 border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="w-20 h-4 bg-muted/50 rounded animate-pulse" />
                <div className="w-6 h-6 bg-muted/50 rounded-full animate-pulse" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="w-32 h-3.5 bg-muted/60 rounded animate-pulse" />
                  <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                  <div className="w-full h-1.5 bg-muted/30 rounded-full animate-pulse mt-3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* Kanban Board */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              cases={getCasesForStage(stage.id)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={(e) => {
                handleDragOver(e);
                setDragOverStage(stage.id);
              }}
              onStageChange={moveCase}
              allStages={KANBAN_STAGES}
              isDragOver={dragOverStage === stage.id}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && cases.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">No cases yet. Cases appear here once contact inquiries are submitted.</p>
        </div>
      )}

      {/* No results state (filters active but no matches) */}
      {!loading && cases.length > 0 && filteredCases.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm font-medium">No cases match your filters</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Try adjusting your search criteria or clearing filters.</p>
        </div>
      )}
    </div>
  );
}
