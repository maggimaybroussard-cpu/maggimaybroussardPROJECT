'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseRecord {
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

interface Invoice {
  id: string;
  inquiry_id: string;
  due_date: string | null;
  amount: number;
  amount_paid: number;
  status: string;
}

interface AdminTask {
  id: string;
  inquiry_id: string | null;
  title: string;
  due_date: string | null;
  priority: string;
  status: string;
}

interface CaseWithMeta extends CaseRecord {
  overdueInvoices: number;
  upcomingDeadlines: AdminTask[];
  overdueDeadlines: AdminTask[];
  totalOwed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: 'bg-slate-100 border-slate-300', headerColor: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400', textColor: 'text-slate-700' },
  { id: 'consultation_booked', label: 'Consultation', color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', textColor: 'text-blue-700' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-50 border-amber-200', headerColor: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', textColor: 'text-amber-700' },
  { id: 'active_client', label: 'Active Client', color: 'bg-emerald-50 border-emerald-200', headerColor: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', textColor: 'text-emerald-700' },
  { id: 'retainer_signed', label: 'Retainer Signed', color: 'bg-purple-50 border-purple-200', headerColor: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', textColor: 'text-purple-700' },
  { id: 'closed', label: 'Closed', color: 'bg-gray-50 border-gray-200', headerColor: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', textColor: 'text-gray-600' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Cases' },
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Sortable Case Card ───────────────────────────────────────────────────────

interface CaseCardProps {
  caseItem: CaseWithMeta;
  isDragging?: boolean;
}

function CaseCard({ caseItem, isDragging }: CaseCardProps) {
  const stage = STAGE_MAP[caseItem.booking_stage || 'inquiry'];
  const hasAlerts = caseItem.overdueInvoices > 0 || caseItem.overdueDeadlines.length > 0;
  const hasUpcoming = caseItem.upcomingDeadlines.length > 0;

  return (
    <div
      className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-primary/30 rotate-1 opacity-90' : 'hover:shadow-md hover:border-primary/30'
      } ${hasAlerts ? 'border-red-200' : 'border-border'}`}
    >
      {/* Alert Banner */}
      {hasAlerts && (
        <div className="flex items-center gap-1.5 mb-2.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-xs font-semibold text-red-700">
            {caseItem.overdueInvoices > 0 && `${caseItem.overdueInvoices} overdue invoice${caseItem.overdueInvoices > 1 ? 's' : ''}`}
            {caseItem.overdueInvoices > 0 && caseItem.overdueDeadlines.length > 0 && ' · '}
            {caseItem.overdueDeadlines.length > 0 && `${caseItem.overdueDeadlines.length} past deadline${caseItem.overdueDeadlines.length > 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{caseItem.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{caseItem.service}</p>
        </div>
        <Link
          href={`/admin/cases/${caseItem.id}`}
          className="shrink-0 p-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Open case"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </Link>
      </div>

      {/* Stage badge */}
      {stage && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
          <span className={`text-xs font-medium ${stage.textColor}`}>{stage.label}</span>
        </div>
      )}

      {/* Upcoming deadlines */}
      {hasUpcoming && (
        <div className="mt-2 space-y-1">
          {caseItem.upcomingDeadlines.slice(0, 2).map((task) => {
            const days = task.due_date ? getDaysUntil(task.due_date) : null;
            return (
              <div key={task.id} className="flex items-center gap-1.5 text-xs">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="text-muted-foreground truncate flex-1">{task.title}</span>
                {days !== null && (
                  <span className={`font-medium shrink-0 ${days <= 1 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {caseItem.totalOwed > 0 && (
        <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Outstanding</span>
          <span className="text-xs font-semibold text-foreground">{fmt(caseItem.totalOwed)}</span>
        </div>
      )}

      {/* Drag handle hint */}
      <div className="mt-2 flex items-center gap-1 text-muted-foreground/40">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
        <span className="text-xs">drag to move</span>
      </div>
    </div>
  );
}

function SortableCaseCard({ caseItem }: { caseItem: CaseWithMeta }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: caseItem.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <CaseCard caseItem={caseItem} isDragging={isDragging} />
    </div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

interface StageColumnProps {
  stage: typeof STAGES[0];
  cases: CaseWithMeta[];
}

function StageColumn({ stage, cases }: StageColumnProps) {
  const alertCount = cases.filter((c) => c.overdueInvoices > 0 || c.overdueDeadlines.length > 0).length;

  return (
    <div className={`flex flex-col min-w-[260px] max-w-[280px] rounded-2xl border ${stage.color} overflow-hidden`}>
      {/* Column Header */}
      <div className={`px-4 py-3 border-b ${stage.headerColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
          <span className="text-sm font-semibold text-foreground">{stage.label}</span>
          <span className="text-xs font-medium text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded-full border border-border/40">
            {cases.length}
          </span>
        </div>
        {alertCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
            {alertCount}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 min-h-[120px]">
        <SortableContext items={cases.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cases.map((c) => (
            <SortableCaseCard key={c.id} caseItem={c} />
          ))}
        </SortableContext>
        {cases.length === 0 && (
          <div className="flex items-center justify-center h-20 border-2 border-dashed border-border/40 rounded-xl">
            <p className="text-xs text-muted-foreground/50">Drop cases here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CasePipelineTimeline() {
  const [cases, setCases] = useState<CaseWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDeadlineAlertsOnly, setShowDeadlineAlertsOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [casesRes, invoicesRes, tasksRes] = await Promise.all([
        supabase
          .from('contact_inquiries')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('client_invoices')
          .select('id, inquiry_id, due_date, amount, amount_paid, status')
          .in('status', ['sent', 'pending', 'overdue']),
        supabase
          .from('admin_tasks')
          .select('id, inquiry_id, title, due_date, priority, status')
          .not('status', 'eq', 'done')
          .lte('due_date', sevenDaysOut),
      ]);

      const rawCases: CaseRecord[] = casesRes.data || [];
      const invoices: Invoice[] = invoicesRes.data || [];
      const tasks: AdminTask[] = tasksRes.data || [];

      const enriched: CaseWithMeta[] = rawCases.map((c) => {
        const caseInvoices = invoices.filter((inv) => inv.inquiry_id === c.id);
        const caseTasks = tasks.filter((t) => t.inquiry_id === c.id);

        const overdueInvoices = caseInvoices.filter((inv) => inv.status === 'overdue').length;
        const totalOwed = caseInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - (inv.amount_paid ?? 0)), 0);

        const overdueDeadlines = caseTasks.filter((t) => t.due_date && t.due_date < todayStr);
        const upcomingDeadlines = caseTasks
          .filter((t) => t.due_date && t.due_date >= todayStr && t.due_date <= sevenDaysOut)
          .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

        return { ...c, overdueInvoices, totalOwed, overdueDeadlines, upcomingDeadlines };
      });

      setCases(enriched);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine target stage from over.id (could be a stage id or a case id)
    const overId = over.id as string;
    const targetStage = STAGES.find((s) => s.id === overId);
    const overCase = cases.find((c) => c.id === overId);
    const newStage = targetStage?.id ?? overCase?.booking_stage ?? null;

    if (!newStage) return;

    const draggedCase = cases.find((c) => c.id === active.id);
    if (!draggedCase || draggedCase.booking_stage === newStage) return;

    // Optimistic update
    setCases((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, booking_stage: newStage } : c))
    );

    setUpdatingId(active.id as string);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ booking_stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', active.id);

      if (updateError) throw updateError;
    } catch {
      // Revert on error
      setCases((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, booking_stage: draggedCase.booking_stage } : c))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const targetStage = STAGES.find((s) => s.id === overId);
    if (!targetStage) return;

    const draggedCase = cases.find((c) => c.id === active.id);
    if (!draggedCase || draggedCase.booking_stage === targetStage.id) return;

    setCases((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, booking_stage: targetStage.id } : c))
    );
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (showDeadlineAlertsOnly && c.overdueInvoices === 0 && c.overdueDeadlines.length === 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q) ||
        (c.firm || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const casesByStage = STAGES.reduce<Record<string, CaseWithMeta[]>>((acc, stage) => {
    acc[stage.id] = filteredCases.filter((c) => (c.booking_stage || 'inquiry') === stage.id);
    return acc;
  }, {});

  const activeDragCase = activeId ? cases.find((c) => c.id === activeId) : null;

  // ── Alert Summary ─────────────────────────────────────────────────────────

  const totalAlerts = cases.filter((c) => c.overdueInvoices > 0 || c.overdueDeadlines.length > 0).length;
  const totalUpcoming = cases.filter((c) => c.upcomingDeadlines.length > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Case Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag cases between stages · {cases.length} total cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Summary Bar */}
      {(totalAlerts > 0 || totalUpcoming > 0) && (
        <div className="flex flex-wrap gap-3">
          {totalAlerts > 0 && (
            <button
              onClick={() => setShowDeadlineAlertsOnly(!showDeadlineAlertsOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                showDeadlineAlertsOnly
                  ? 'bg-red-100 border-red-300 text-red-800' :'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {totalAlerts} case{totalAlerts > 1 ? 's' : ''} need attention
              {showDeadlineAlertsOnly && ' · Click to show all'}
            </button>
          )}
          {totalUpcoming > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-amber-50 border-amber-200 text-xs font-semibold text-amber-700">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {totalUpcoming} case{totalUpcoming > 1 ? 's' : ''} with upcoming deadlines (7 days)
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search cases…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Stage summary pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STAGES.map((stage) => {
            const count = casesByStage[stage.id]?.length ?? 0;
            if (count === 0) return null;
            return (
              <span key={stage.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${stage.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span className="ml-2 text-sm text-muted-foreground">Loading cases…</span>
        </div>
      )}

      {/* Kanban Board */}
      {!loading && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                cases={casesByStage[stage.id] || []}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragCase && (
              <div className="rotate-2 scale-105">
                <CaseCard caseItem={activeDragCase} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Updating indicator */}
      {updatingId && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg text-sm font-medium text-foreground z-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Saving stage change…
        </div>
      )}
    </div>
  );
}
