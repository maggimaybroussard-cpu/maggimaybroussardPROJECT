'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PrepDocumentsManager from './PrepDocumentsManager';

interface Consultation {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  status: string;
  notes: string | null;
  booking_stage: string;
  calendly_event_uuid: string | null;
  calendly_start_time: string | null;
  calendly_end_time: string | null;
  calendly_event_name: string | null;
  calendly_meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionItem {
  id: string;
  inquiry_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  priority: string;
  due_date: string | null;
  visible_to_client: boolean;
  completed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Booked',
  proposal_sent: 'Proposal Sent',
  active_client: 'Active Client',
  completed: 'Completed',
  closed: 'Closed',
};

const ONBOARDING_EMAIL_LABELS: Record<string, string> = {
  payment_confirmation: 'Payment Confirmation',
  prep_documents: 'Prep Document Links',
  pre_consultation_checklist: 'Pre-Consultation Checklist',
  post_consultation_followup: 'Post-Consultation Follow-Up',
};

const STAGE_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-100 text-blue-700',
  consultation_booked: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-amber-100 text-amber-700',
  active_client: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function formatDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: 'TBD', time: '' };
  let d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' }),
  };
}

function getMonthKey(iso: string | null): string {
  if (!iso) return 'No Date';
  let d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' });
}

type ViewMode = 'list' | 'calendar' | 'kanban';

interface CalendarDay {
  date: Date;
  consultations: Consultation[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

function buildCalendarGrid(year: number, month: number, consultations: Consultation[]): CalendarDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grid: CalendarDay[] = [];

  // Prev month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthDays - i);
    grid.push({ date, consultations: [], isToday: false, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().slice(0, 10);
    const dayConsultations = consultations.filter((c) => {
      if (!c.calendly_start_time) return false;
      const cDate = new Date(c.calendly_start_time);
      return cDate.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) === dateStr;
    });
    grid.push({
      date,
      consultations: dayConsultations,
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill 6 rows
  const remaining = 42 - grid.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    grid.push({ date, consultations: [], isToday: false, isCurrentMonth: false });
  }

  return grid;
}

const KANBAN_STAGES = ['inquiry', 'consultation_booked', 'proposal_sent', 'active_client', 'completed'];

export default function ConsultationsAdminBoard() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [totalDeposits, setTotalDeposits] = useState<number | null>(null);
  const [sequenceTriggered, setSequenceTriggered] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const [updatingActionItem, setUpdatingActionItem] = useState<string | null>(null);
  const [retainerCase, setRetainerCase] = useState<{ id: string; caseNumber: string } | null>(null);
  const [retainerCaseForId, setRetainerCaseForId] = useState<string | null>(null);
  const [onboardingEmailType, setOnboardingEmailType] = useState<string>('payment_confirmation');
  const [onboardingAmount, setOnboardingAmount] = useState<string>('');
  const [onboardingCustomMsg, setOnboardingCustomMsg] = useState<string>('');
  const [onboardingMsg, setOnboardingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingOnboarding, setSendingOnboarding] = useState(false);
  const [loadingOnboardingLogs, setLoadingOnboardingLogs] = useState(false);
  const [onboardingLogs, setOnboardingLogs] = useState<{ id: string; email_type: string; sent_at: string; status: string }[]>([]);

  // Calendar view state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/consultations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setConsultations(json.consultations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchDeposits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/consultations?deposits=true');
      if (!res.ok) return;
      const json = await res.json();
      if (typeof json.totalDeposits === 'number') {
        setTotalDeposits(json.totalDeposits);
      }
    } catch {
      // silently fail — deposits are supplementary
    }
  }, []);

  const fetchActionItems = useCallback(async (inquiryId: string) => {
    setActionItemsLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase
        .from('consultation_action_items')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      setActionItems((data as ActionItem[]) ?? []);
    } catch {
      setActionItems([]);
    } finally {
      setActionItemsLoading(false);
    }
  }, []);

  const updateActionItemStatus = async (itemId: string, newStatus: ActionItem['status']) => {
    setUpdatingActionItem(itemId);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
      await supabase
        .from('consultation_action_items')
        .update(updates)
        .eq('id', itemId);
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
            : item
        )
      );
    } catch {
      // silent
    } finally {
      setUpdatingActionItem(null);
    }
  };

  const fetchOnboardingLogs = useCallback(async (inquiryId: string) => {
    setLoadingOnboardingLogs(true);
    try {
      const res = await fetch(`/api/admin/consultations/send-onboarding-email?inquiryId=${inquiryId}`);
      if (!res.ok) return;
      const json = await res.json();
      setOnboardingLogs(json.logs ?? []);
    } catch {
      setOnboardingLogs([]);
    } finally {
      setLoadingOnboardingLogs(false);
    }
  }, []);

  const handleSendOnboardingEmail = async () => {
    if (!selected) return;
    setSendingOnboarding(true);
    setOnboardingMsg(null);
    try {
      const body: Record<string, unknown> = {
        inquiryId: selected.id,
        trigger: 'manual',
        emailType: onboardingEmailType,
      };
      if (onboardingEmailType === 'payment_confirmation' && onboardingAmount) {
        body.amount = onboardingAmount;
        body.paymentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (onboardingEmailType === 'post_consultation_followup' && onboardingCustomMsg) {
        body.customMessage = onboardingCustomMsg;
        body.outcome = selected.status === 'no_show' ? 'no_show' : 'attended';
      }
      const res = await fetch('/api/admin/consultations/send-onboarding-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setOnboardingMsg({ type: 'success', text: `${ONBOARDING_EMAIL_LABELS[onboardingEmailType] ?? onboardingEmailType} sent to ${selected.email}` });
      fetchOnboardingLogs(selected.id);
    } catch (err) {
      setOnboardingMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSendingOnboarding(false);
    }
  };

  useEffect(() => { fetchConsultations(); fetchDeposits(); }, [fetchConsultations, fetchDeposits]);

  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status || 'new');
      setEditStage(selected.booking_stage || 'consultation_booked');
      setEditNotes(selected.notes || '');
      if (selected.calendly_start_time) {
        let d = new Date(selected.calendly_start_time);
        setRescheduleDate(d.toISOString().slice(0, 10));
        setRescheduleTime(d.toISOString().slice(11, 16));
      }
      setShowReschedule(false);
      setSaveMsg(null);
      setAlertMsg(null);
      setOnboardingMsg(null);
      setOnboardingLogs([]);
      setActionItems([]);
      fetchActionItems(selected.id);
      fetchOnboardingLogs(selected.id);
      // Reset retainer case state when switching consultations
      setRetainerCase(null);
      setRetainerCaseForId(null);
      // If this consultation is already completed, fetch its retainer case
      if (selected.status === 'completed') {
        (async () => {
          try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            const { data: rc } = await supabase
              .from('retainer_cases')
              .select('id, case_number')
              .eq('inquiry_id', selected.id)
              .maybeSingle();
            if (rc) {
              setRetainerCase({ id: rc.id, caseNumber: rc.case_number });
              setRetainerCaseForId(selected.id);
            }
          } catch {
            // silent
          }
        })();
      }
    }
  }, [selected, fetchActionItems, fetchOnboardingLogs]);

  const now = new Date();

  const filtered = consultations.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.firm?.toLowerCase().includes(q) ||
      c.service?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const start = c.calendly_start_time ? new Date(c.calendly_start_time) : null;
    const matchTime =
      timeFilter === 'all' ||
      (timeFilter === 'upcoming' && start && start > now) ||
      (timeFilter === 'past' && start && start <= now);
    return matchSearch && matchStatus && matchTime;
  });

  const upcoming = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) > now);
  const past = consultations.filter((c) => c.calendly_start_time && new Date(c.calendly_start_time) <= now);

  // ── KPI calculations ──────────────────────────────────────────────────────
  const stageCounts: Record<string, number> = {};
  KANBAN_STAGES.forEach((s) => { stageCounts[s] = consultations.filter((c) => c.booking_stage === s).length; });

  const convertedCount = consultations.filter((c) => c.booking_stage === 'active_client' || c.booking_stage === 'completed').length;
  const conversionRate = consultations.length > 0 ? Math.round((convertedCount / consultations.length) * 100) : 0;

  // No-show: past consultations with status 'closed' and no 'completed' stage
  const noShowCount = past.filter((c) => c.status === 'closed' && c.booking_stage !== 'completed').length;
  const noShowRate = past.length > 0 ? Math.round((noShowCount / past.length) * 100) : 0;

  const stageKpiItems = [
    { key: 'inquiry', label: 'Inquiry', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
    { key: 'consultation_booked', label: 'Booked', color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
    { key: 'proposal_sent', label: 'Proposal', color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
    { key: 'active_client', label: 'Active', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
    { key: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', border: 'border-green-200' },
  ];

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updates: Record<string, unknown> = {
        id: selected.id,
        previousStatus: selected.status,
        status: editStatus,
        notes: editNotes,
        booking_stage: editStage,
      };
      if (showReschedule && rescheduleDate && rescheduleTime) {
        const newStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
        updates.calendly_start_time = newStart.toISOString();
        if (selected.calendly_end_time && selected.calendly_start_time) {
          const dur = new Date(selected.calendly_end_time).getTime() - new Date(selected.calendly_start_time).getTime();
          updates.calendly_end_time = new Date(newStart.getTime() + dur).toISOString();
        }
      }
      const res = await fetch('/api/admin/consultations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const json = await res.json();
      const updated = json.consultation;
      setConsultations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setSelected(updated);
      const actionItemsMsg = json.actionItemsCreated > 0
        ? ` ${json.actionItemsCreated} action items created.`
        : '';
      if (json.postConsultationSequenceTriggered) {
        setSaveMsg({ type: 'success', text: `Changes saved. Post-consultation email sequence triggered.${actionItemsMsg}` });
        setSequenceTriggered(updated.id);
      } else {
        setSaveMsg({ type: 'success', text: `Changes saved.${actionItemsMsg}` });
      }
      // Refresh action items if status changed to completed
      if (json.actionItemsCreated > 0) {
        fetchActionItems(updated.id);
      }
      // Store retainer case info if auto-created
      if (json.retainerCaseCreated) {
        setRetainerCase(json.retainerCaseCreated);
        setRetainerCaseForId(updated.id);
      }
    } catch (err) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendAlert = async (alertType: 'confirmed' | 'rescheduled' | 'completed') => {
    if (!selected) return;
    setSendingAlert(true);
    setAlertMsg(null);
    try {
      const res = await fetch('/api/admin/consultations/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId: selected.id, alertType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setAlertMsg({ type: 'success', text: `${alertType.charAt(0).toUpperCase() + alertType.slice(1)} alert sent to ${selected.email}` });
    } catch (err) {
      setAlertMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send alert' });
    } finally {
      setSendingAlert(false);
    }
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const calGrid = buildCalendarGrid(calYear, calMonth, consultations);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Grouped list by month ──────────────────────────────────────────────────
  const grouped: Record<string, Consultation[]> = {};
  filtered.forEach((c) => {
    const key = getMonthKey(c.calendly_start_time);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  return (
    <div className="space-y-5">
      {/* ── KPI Overview Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Pipeline Stage Breakdown */}
        <div className="sm:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pipeline Stages</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{consultations.length}</p>
              <p className="text-xs text-muted-foreground">total consultations</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/>
              </svg>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stageKpiItems.map((s) => (
              <div key={s.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${s.border} ${s.color.split(' ')[0]}`}>
                <span className={`text-lg font-bold ${s.color.split(' ')[1]}`}>{stageCounts[s.key] ?? 0}</span>
                <span className={`text-xs font-medium ${s.color.split(' ')[1]}`}>{s.label}</span>
              </div>
            ))}
          </div>
          {consultations.length > 0 && (
            <div className="mt-3 flex rounded-full overflow-hidden h-2 gap-0.5">
              {stageKpiItems.map((s) => {
                const pct = Math.round(((stageCounts[s.key] ?? 0) / consultations.length) * 100);
                if (pct === 0) return null;
                const barColors: Record<string, string> = {
                  inquiry: '#3b82f6',
                  consultation_booked: '#a855f7',
                  proposal_sent: '#f59e0b',
                  active_client: '#10b981',
                  completed: '#22c55e',
                };
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${pct}%`}
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColors[s.key] }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Total Deposits Collected */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Deposits Collected</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">
              {totalDeposits !== null
                ? `$${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : <span className="text-muted-foreground text-xl">—</span>
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">from consultation deposits</p>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {consultations.filter((c) => c.booking_stage !== 'inquiry').length} paid bookings
            </span>
          </div>
        </div>

        {/* Conversion Rate + No-Show */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          {/* Conversion Rate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conversion Rate</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${conversionRate}%`, background: '#355E3B' }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{convertedCount} of {consultations.length} became clients</p>
          </div>

          <div className="border-t border-border" />

          {/* No-Show Rate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">No-Show Rate</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold ${noShowRate > 20 ? 'text-red-600' : noShowRate > 10 ? 'text-amber-600' : 'text-foreground'}`}>
              {noShowRate}%
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${noShowRate}%`, background: noShowRate > 20 ? '#dc2626' : noShowRate > 10 ? '#f59e0b' : '#6b7280' }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{noShowCount} of {past.length} past consultations</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: consultations.length, color: 'text-foreground', border: 'border-border' },
          { label: 'Upcoming', value: upcoming.length, color: 'text-emerald-700', border: 'border-emerald-200' },
          { label: 'Past', value: past.length, color: 'text-muted-foreground', border: 'border-border' },
          { label: 'Filtered', value: filtered.length, color: 'text-foreground', border: 'border-border' },
        ].map((s) => (
          <div key={s.label} className={`bg-card border ${s.border} rounded-xl p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, firm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all appearance-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Time filter */}
        <div className="flex rounded-xl border border-border overflow-hidden bg-card">
          {(['all', 'upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all capitalize ${
                timeFilter === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex rounded-xl border border-border overflow-hidden bg-card">
          {([
            { id: 'list', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
            { id: 'calendar', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { id: 'kanban', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></svg> },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id as ViewMode)}
              className={`px-3 py-2.5 transition-all ${
                viewMode === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
              title={v.id.charAt(0).toUpperCase() + v.id.slice(1) + ' view'}
            >
              {v.icon}
            </button>
          ))}
        </div>

        <button
          onClick={fetchConsultations}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className={`grid gap-5 ${selected ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
          {/* Table */}
          <div className={selected ? 'lg:col-span-3' : 'col-span-1'}>
            {loading ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                      <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-3 bg-muted/40 rounded animate-pulse hidden sm:block" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 mx-auto mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-muted-foreground">No consultations found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([month, items]) => (
                  <div key={month}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">{month}</p>
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {items.map((c, idx) => {
                        const { date, time } = formatDateTime(c.calendly_start_time);
                        const isUpcoming = c.calendly_start_time && new Date(c.calendly_start_time) > now;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelected(selected?.id === c.id ? null : c)}
                            className={`w-full text-left px-5 py-4 flex items-start gap-4 transition-all hover:bg-secondary/30 ${
                              idx < items.length - 1 ? 'border-b border-border' : ''
                            } ${selected?.id === c.id ? 'bg-secondary/40' : ''}`}
                          >
                            {/* Date badge */}
                            <div
                              className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-center"
                              style={isUpcoming ? { background: 'rgba(53,94,59,0.1)' } : { background: 'var(--secondary)' }}
                            >
                              {c.calendly_start_time ? (
                                <>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: isUpcoming ? '#355E3B' : 'var(--muted-foreground)' }}>
                                    {new Date(c.calendly_start_time).toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Chicago' })}
                                  </span>
                                  <span className="text-lg font-bold leading-none" style={{ color: isUpcoming ? '#355E3B' : 'var(--muted-foreground)' }}>
                                    {new Date(c.calendly_start_time).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Chicago' })}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">TBD</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-semibold text-foreground text-sm truncate">{c.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{c.firm} · {c.service}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                  {STATUS_LABELS[c.status] ?? c.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {time && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    {time}
                                  </span>
                                )}
                                {c.calendly_meeting_location && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[160px]">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                    </svg>
                                    {c.calendly_meeting_location}
                                  </span>
                                )}
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[c.booking_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {STAGE_LABELS[c.booking_stage] ?? c.booking_stage}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl overflow-hidden sticky top-4">
                {/* Panel header */}
                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.email}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-all shrink-0"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Booking info */}
                  <div className="rounded-xl p-4 space-y-2.5" style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.12)' }}>
                    {[
                      { label: 'Firm', value: selected.firm },
                      { label: 'Service', value: selected.service },
                      { label: 'Event', value: selected.calendly_event_name },
                      { label: 'Location', value: selected.calendly_meeting_location },
                    ].filter((r) => r.value).map((row) => (
                      <div key={row.label} className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">{row.label}</span>
                        <span className="text-xs text-foreground font-medium">{row.value}</span>
                      </div>
                    ))}
                    {selected.calendly_start_time && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">Date</span>
                        <div>
                          <p className="text-xs text-foreground font-medium">{formatDateTime(selected.calendly_start_time).date}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(selected.calendly_start_time).time}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all appearance-none"
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stage */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Booking Stage</label>
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all appearance-none"
                    >
                      {Object.entries(STAGE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reschedule */}
                  <div>
                    <button
                      onClick={() => setShowReschedule((p) => !p)}
                      className="flex items-center gap-2 text-xs font-semibold text-accent hover:opacity-70 transition-opacity"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {showReschedule ? 'Cancel reschedule' : 'Reschedule date/time'}
                    </button>
                    {showReschedule && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Date</label>
                          <input
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Time (CST)</label>
                          <input
                            type="time"
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="Add internal notes…"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
                    />
                  </div>

                  {/* Save */}
                  {saveMsg && (
                    <div className={`p-3 rounded-xl text-xs font-medium ${saveMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                      {saveMsg.text}
                    </div>
                  )}

                  {/* Post-consultation sequence indicator */}
                  {editStatus === 'completed' && selected?.status !== 'completed' && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <span>Saving as <strong>Completed</strong> will automatically send a 3-email follow-up sequence: thank-you (now), next-steps summary (24h), and feedback request (72h).</span>
                    </div>
                  )}

                  {sequenceTriggered === selected?.id && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-green-50 border border-green-200 text-green-700 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Post-consultation sequence active — 3 emails scheduled.
                    </div>
                  )}

                  {/* ── Retainer Case Banner ── */}
                  {retainerCaseForId === selected?.id && retainerCase && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span className="font-semibold">Retainer Case Created — {retainerCase.caseNumber}</span>
                      </div>
                      <p className="text-indigo-700 leading-relaxed">
                        A retainer case record has been opened and linked to this client&apos;s deliverable hub and action items timeline for seamless project continuation.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href="/client-deliverable-hub"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium transition-colors text-[11px]"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          Deliverable Hub
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('action-items-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium transition-colors text-[11px]"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                          </svg>
                          Action Items Timeline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview banner when about to mark completed (no existing retainer case) */}
                  {editStatus === 'completed' && selected?.status !== 'completed' && !retainerCase && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-800 flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span>Saving as <strong>Completed</strong> will auto-create a retainer case record linked to the client&apos;s deliverable hub and action items timeline.</span>
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#355E3B' }}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>

                  {/* ── Action Items ── */}
                  {(actionItems.length > 0 || actionItemsLoading || selected?.status === 'completed') && (
                    <div id="action-items-section" className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Action Items</p>
                        {actionItems.length > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {actionItems.filter((i) => i.status !== 'completed' && i.status !== 'dismissed').length} pending
                          </span>
                        )}
                      </div>
                      {actionItemsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />
                          ))}
                        </div>
                      ) : actionItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No action items yet. Mark consultation as completed to auto-generate tasks.</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {actionItems.map((item) => {
                            const isDone = item.status === 'completed';
                            const isDismissed = item.status === 'dismissed';
                            const taskTypeColors: Record<string, string> = {
                              engagement_form: 'bg-purple-50 text-purple-700',
                              retainer_call: 'bg-blue-50 text-blue-700',
                              intake_questionnaire: 'bg-amber-50 text-amber-700',
                              document_preparation: 'bg-emerald-50 text-emerald-700',
                              document_request: 'bg-orange-50 text-orange-700',
                              legal_review: 'bg-red-50 text-red-700',
                              general: 'bg-gray-100 text-gray-600',
                            };
                            const typeColor = taskTypeColors[item.task_type] ?? taskTypeColors.general;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                                  isDone
                                    ? 'bg-green-50/60 border-green-200 opacity-70'
                                    : isDismissed
                                    ? 'bg-gray-50 border-gray-200 opacity-50' :'bg-card border-border hover:border-accent/30'
                                }`}
                              >
                                {/* Checkbox */}
                                <button
                                  onClick={() => updateActionItemStatus(item.id, isDone ? 'pending' : 'completed')}
                                  disabled={updatingActionItem === item.id || isDismissed}
                                  className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
                                    isDone
                                      ? 'bg-green-500 border-green-500' :'border-border hover:border-accent/60'
                                  } disabled:opacity-50`}
                                  aria-label={isDone ? 'Mark pending' : 'Mark complete'}
                                >
                                  {isDone && (
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium leading-snug ${isDone || isDismissed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {item.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColor}`}>
                                      {item.task_type.replace(/_/g, ' ')}
                                    </span>
                                    {item.visible_to_client && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                        Client visible
                                      </span>
                                    )}
                                    {item.due_date && !isDone && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Dismiss */}
                                {!isDone && !isDismissed && (
                                  <button
                                    onClick={() => updateActionItemStatus(item.id, 'dismissed')}
                                    disabled={updatingActionItem === item.id}
                                    className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-50"
                                    aria-label="Dismiss"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                                    {/* Prep Documents */}
                  <PrepDocumentsManager
                    bookingId={null}
                    inquiryId={selected.id}
                    clientEmail={selected.email}
                    clientName={selected.name}
                  />

                  {/* Alert buttons */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Send Client Alert</p>
                    {alertMsg && (
                      <div className={`p-3 rounded-xl text-xs font-medium mb-2 ${alertMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        {alertMsg.text}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {(['confirmed', 'rescheduled', 'completed'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleSendAlert(type)}
                          disabled={sendingAlert}
                          className="px-2 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:border-accent/50 hover:bg-secondary/40 transition-all disabled:opacity-50 capitalize"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Onboarding Email Automation ── */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(200,150,90,0.15)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                        </svg>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Onboarding Emails</p>
                    </div>

                    {onboardingMsg && (
                      <div className={`p-3 rounded-xl text-xs font-medium mb-3 ${onboardingMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        {onboardingMsg.text}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Email Type</label>
                        <select
                          value={onboardingEmailType}
                          onChange={(e) => { setOnboardingEmailType(e.target.value); setOnboardingMsg(null); }}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all appearance-none"
                        >
                          {Object.entries(ONBOARDING_EMAIL_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>

                      {onboardingEmailType === 'payment_confirmation' && (
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Amount Paid (e.g. $150.00)</label>
                          <input
                            type="text"
                            value={onboardingAmount}
                            onChange={(e) => setOnboardingAmount(e.target.value)}
                            placeholder="$150.00"
                            className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                          />
                        </div>
                      )}

                      {onboardingEmailType === 'post_consultation_followup' && (
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Custom Message (optional)</label>
                          <textarea
                            value={onboardingCustomMsg}
                            onChange={(e) => setOnboardingCustomMsg(e.target.value)}
                            rows={2}
                            placeholder="Add a personal note to include in the follow-up…"
                            className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
                          />
                        </div>
                      )}

                      {/* Email type description */}
                      <div className="px-3 py-2 rounded-xl text-[11px] text-muted-foreground leading-relaxed" style={{ background: 'rgba(200,150,90,0.06)', border: '1px solid rgba(200,150,90,0.15)' }}>
                        {onboardingEmailType === 'payment_confirmation' && 'Sends a branded payment receipt with booking details and a "what happens next" summary.'}
                        {onboardingEmailType === 'prep_documents' && 'Sends prep materials, document links, and pre-consultation tips. Scheduled 24h before booking when triggered automatically.'}
                        {onboardingEmailType === 'pre_consultation_checklist' && 'Sends a 6-item checklist to help the client prepare: documents, questions, tech check, and calendar block.'}
                        {onboardingEmailType === 'post_consultation_followup' && `Sends a follow-up with next steps${selected?.status === 'no_show' ? ' and a reschedule link (no-show template)' : ' and client portal access'}.`}
                      </div>

                      <button
                        onClick={handleSendOnboardingEmail}
                        disabled={sendingOnboarding}
                        className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ background: '#C8965A' }}
                      >
                        {sendingOnboarding ? (
                          <>
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send {ONBOARDING_EMAIL_LABELS[onboardingEmailType]}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Email send log */}
                    {(loadingOnboardingLogs || onboardingLogs.length > 0) && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Send History</p>
                        {loadingOnboardingLogs ? (
                          <div className="space-y-1.5">
                            {[1, 2].map((i) => <div key={i} className="h-8 rounded-lg bg-muted/40 animate-pulse" />)}
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {onboardingLogs
                              .filter(l => !l.email_type.startsWith('sequence_trigger:'))
                              .map((log) => (
                              <div key={log.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-foreground truncate">{ONBOARDING_EMAIL_LABELS[log.email_type] ?? log.email_type}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                  </p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'}`}>
                                  {log.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Month nav */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <button
              onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
                else setCalMonth((m) => m - 1);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="font-semibold text-foreground">{MONTHS[calMonth]} {calYear}</span>
            <button
              onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
                else setCalMonth((m) => m + 1);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {calGrid.map((cell, idx) => (
              <div
                key={idx}
                className={`min-h-[80px] p-1.5 border-b border-r border-border last:border-r-0 ${
                  !cell.isCurrentMonth ? 'bg-secondary/20' : ''
                } ${cell.isToday ? 'bg-accent/5' : ''}`}
              >
                <span className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                  cell.isToday ? 'text-white' : cell.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/30'
                }`} style={cell.isToday ? { background: '#355E3B' } : undefined}>
                  {cell.date.getDate()}
                </span>
                <div className="space-y-0.5">
                  {cell.consultations.slice(0, 2).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelected(c); setViewMode('list'); }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-all hover:opacity-80"
                      style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
                      title={`${c.name} — ${formatDateTime(c.calendly_start_time).time}`}
                    >
                      {formatDateTime(c.calendly_start_time).time.split(' ')[0]} {c.name.split(' ')[0]}
                    </button>
                  ))}
                  {cell.consultations.length > 2 && (
                    <span className="text-[10px] text-muted-foreground pl-1">+{cell.consultations.length - 2} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {KANBAN_STAGES.map((stage) => {
              const stageItems = consultations.filter((c) => c.booking_stage === stage);
              return (
                <div key={stage} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{stageItems.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {stageItems.length === 0 ? (
                      <div className="bg-card border border-dashed border-border rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground/40">No consultations</p>
                      </div>
                    ) : (
                      stageItems.map((c) => {
                        const { date, time } = formatDateTime(c.calendly_start_time);
                        const isUpcoming = c.calendly_start_time && new Date(c.calendly_start_time) > now;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setSelected(c); setViewMode('list'); }}
                            className="w-full text-left bg-card border border-border rounded-xl p-3.5 hover:border-accent/40 hover:shadow-sm transition-all"
                          >
                            <p className="font-semibold text-foreground text-sm truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{c.firm}</p>
                            {c.calendly_start_time && (
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={isUpcoming ? { background: 'rgba(53,94,59,0.1)', color: '#355E3B' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                                >
                                  {date.split(',')[0]}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{time.split(' ').slice(0,2).join(' ')}</span>
                              </div>
                            )}
                            <div className="mt-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {STATUS_LABELS[c.status] ?? c.status}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}