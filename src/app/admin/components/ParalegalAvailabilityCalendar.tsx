'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockedReason = 'court_date' | 'meeting' | 'vacation' | 'personal' | 'training' | 'other';

interface BlockedSlot {
  id: string;
  paralegal_id: string;
  paralegal_name: string;
  title: string;
  reason: BlockedReason;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  notes: string | null;
  created_at: string;
}

interface SlotFormData {
  paralegal_id: string;
  paralegal_name: string;
  title: string;
  reason: BlockedReason;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  all_day: boolean;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#355E3B';

const PARALEGALS = [
  { id: 'p1', name: 'Sarah Mitchell' },
  { id: 'p2', name: 'James Okafor' },
  { id: 'p3', name: 'Maria Chen' },
  { id: 'p4', name: 'David Reyes' },
];

const REASON_CONFIG: Record<BlockedReason, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  court_date: {
    label: 'Court Date',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
      </svg>
    ),
  },
  meeting: {
    label: 'Meeting',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  vacation: {
    label: 'Vacation',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      </svg>
    ),
  },
  personal: {
    label: 'Personal',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  training: {
    label: 'Training',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  other: {
    label: 'Other',
    color: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
};

const EMPTY_FORM: SlotFormData = {
  paralegal_id: '',
  paralegal_name: '',
  title: '',
  reason: 'other',
  start_date: '',
  start_time: '09:00',
  end_date: '',
  end_time: '17:00',
  all_day: false,
  notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  let d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isActiveBlock(slot: BlockedSlot) {
  const now = new Date();
  return new Date(slot.end_datetime) >= now;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── Block Form Modal ─────────────────────────────────────────────────────────

function BlockFormModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: SlotFormData) => void;
  initial: SlotFormData | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<SlotFormData>(initial ?? { ...EMPTY_FORM, start_date: todayStr(), end_date: todayStr() });

  useEffect(() => {
    setForm(initial ?? { ...EMPTY_FORM, start_date: todayStr(), end_date: todayStr() });
  }, [initial, open]);

  if (!open) return null;

  function set<K extends keyof SlotFormData>(field: K, value: SlotFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleParalegalChange(id: string) {
    const found = PARALEGALS.find((p) => p.id === id);
    setForm((prev) => ({ ...prev, paralegal_id: id, paralegal_name: found?.name ?? '' }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#355E3B]/30 focus:border-[#355E3B] transition-all';
  const labelCls = 'block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-serif text-xl text-foreground">{initial?.title ? 'Edit Blocked Slot' : 'Block Unavailable Time'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Prevent case assignments during this period</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Paralegal */}
          <div>
            <label className={labelCls}>Paralegal</label>
            <select
              className={inputCls}
              value={form.paralegal_id}
              onChange={(e) => handleParalegalChange(e.target.value)}
              required
            >
              <option value="">Select paralegal…</option>
              {PARALEGALS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className={labelCls}>Reason</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(REASON_CONFIG) as BlockedReason[]).map((r) => {
                const cfg = REASON_CONFIG[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('reason', r)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      form.reason === r
                        ? 'border-[#355E3B] bg-[#355E3B]/10 text-[#355E3B]'
                        : 'border-border text-muted-foreground hover:border-[#355E3B]/40'
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title / Description</label>
            <input
              className={inputCls}
              type="text"
              placeholder={`e.g. ${REASON_CONFIG[form.reason].label} — brief description`}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('all_day', !form.all_day)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.all_day ? 'bg-[#355E3B]' : 'bg-border'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.all_day ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-foreground font-medium">All-day block</span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input
                className={inputCls}
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input
                className={inputCls}
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => set('end_date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Times (hidden when all-day) */}
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Time</label>
                <input
                  className={inputCls}
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set('start_time', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>End Time</label>
                <input
                  className={inputCls}
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set('end_time', e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Internal Notes <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Any additional context for the team…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {saving ? 'Saving…' : initial?.title ? 'Update Block' : 'Block Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  slots,
  filterParalegal,
}: {
  slots: BlockedSlot[];
  filterParalegal: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function getBlocksForDay(day: number): BlockedSlot[] {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    return slots.filter((s) => {
      if (filterParalegal && s.paralegal_id !== filterParalegal) return false;
      const start = s.start_datetime.slice(0, 10);
      const end = s.end_datetime.slice(0, 10);
      return dateStr >= start && dateStr <= end;
    });
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      {/* Nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-foreground">{monthName}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const blocks = getBlocksForDay(day);
          const isToday = day === todayDay;
          const hasBlocks = blocks.length > 0;
          const reasonColors = [...new Set(blocks.map((b) => b.reason))];

          return (
            <div
              key={day}
              className={`relative flex flex-col items-center justify-start py-1 rounded-lg min-h-[36px] ${
                isToday ? 'ring-2 ring-[#355E3B]/60' : ''
              } ${hasBlocks ? 'bg-red-50' : 'hover:bg-muted/50'}`}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-[#355E3B] font-bold' : hasBlocks ? 'text-red-700' : 'text-foreground'}`}>
                {day}
              </span>
              {hasBlocks && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {reasonColors.slice(0, 3).map((r) => (
                    <span key={r} className={`w-1.5 h-1.5 rounded-full ${REASON_CONFIG[r].dot}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1.5">
        {(Object.keys(REASON_CONFIG) as BlockedReason[]).map((r) => (
          <div key={r} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${REASON_CONFIG[r].dot}`} />
            <span className="text-[10px] text-muted-foreground">{REASON_CONFIG[r].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParalegalAvailabilityCalendar() {
  const [slots, setSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editSlot, setEditSlot] = useState<SlotFormData | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [filterParalegal, setFilterParalegal] = useState('');
  const [filterReason, setFilterReason] = useState<BlockedReason | ''>('');
  const [showPast, setShowPast] = useState(false);

  const supabase = createClient();

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('paralegal_blocked_slots')
        .select('*')
        .order('start_datetime', { ascending: true });
      if (err) throw err;
      setSlots(data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load blocked slots';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  function showToast(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function handleSave(form: SlotFormData) {
    setSaving(true);
    setError(null);
    try {
      const startDt = form.all_day
        ? `${form.start_date}T00:00:00`
        : `${form.start_date}T${form.start_time}:00`;
      const endDt = form.all_day
        ? `${form.end_date}T23:59:59`
        : `${form.end_date}T${form.end_time}:00`;

      const payload = {
        paralegal_id: form.paralegal_id,
        paralegal_name: form.paralegal_name,
        title: form.title,
        reason: form.reason,
        start_datetime: startDt,
        end_datetime: endDt,
        all_day: form.all_day,
        notes: form.notes || null,
      };

      if (editId) {
        const { error: err } = await supabase
          .from('paralegal_blocked_slots')
          .update(payload)
          .eq('id', editId);
        if (err) throw err;
        showToast('Blocked slot updated successfully');
      } else {
        const { error: err } = await supabase
          .from('paralegal_blocked_slots')
          .insert(payload);
        if (err) throw err;
        showToast('Time blocked — auto-routing will skip this period');
      }

      setShowModal(false);
      setEditSlot(null);
      setEditId(null);
      fetchSlots();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save blocked slot';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this blocked slot? The paralegal will become available for case assignments during this period.')) return;
    try {
      const { error: err } = await supabase
        .from('paralegal_blocked_slots')
        .delete()
        .eq('id', id);
      if (err) throw err;
      showToast('Blocked slot removed');
      fetchSlots();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete blocked slot';
      setError(msg);
    }
  }

  function openEdit(slot: BlockedSlot) {
    const startDate = slot.start_datetime.slice(0, 10);
    const endDate = slot.end_datetime.slice(0, 10);
    const startTime = slot.start_datetime.slice(11, 16);
    const endTime = slot.end_datetime.slice(11, 16);
    setEditSlot({
      paralegal_id: slot.paralegal_id,
      paralegal_name: slot.paralegal_name,
      title: slot.title,
      reason: slot.reason,
      start_date: startDate,
      start_time: startTime || '09:00',
      end_date: endDate,
      end_time: endTime || '17:00',
      all_day: slot.all_day,
      notes: slot.notes ?? '',
    });
    setEditId(slot.id);
    setShowModal(true);
  }

  function openNew() {
    setEditSlot(null);
    setEditId(null);
    setShowModal(true);
  }

  // Filtered list
  const now = new Date();
  const filtered = slots.filter((s) => {
    if (filterParalegal && s.paralegal_id !== filterParalegal) return false;
    if (filterReason && s.reason !== filterReason) return false;
    if (!showPast && new Date(s.end_datetime) < now) return false;
    return true;
  });

  const activeCount = slots.filter((s) => isActiveBlock(s)).length;
  const upcomingCount = slots.filter((s) => new Date(s.start_datetime) > now).length;
  const paralegalBlockCounts: Record<string, number> = {};
  slots.filter((s) => isActiveBlock(s)).forEach((s) => {
    paralegalBlockCounts[s.paralegal_name] = (paralegalBlockCounts[s.paralegal_name] ?? 0) + 1;
  });
  const mostBlocked = Object.entries(paralegalBlockCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Paralegal Availability</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Block time slots to prevent the auto-routing engine from assigning new cases during court dates, meetings, or vacations.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all shrink-0"
          style={{ background: ACCENT }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Block Time Slot
        </button>
      </div>

      {/* Toast */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Routing Notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-xs text-amber-800">
          <strong>Auto-routing impact:</strong> Paralegals with active blocks will be skipped by the case assignment engine during the blocked period. Existing assigned cases are not affected.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Active Blocks</p>
          <p className="text-3xl font-semibold" style={{ color: ACCENT }}>{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Currently in effect</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Upcoming</p>
          <p className="text-3xl font-semibold text-foreground">{upcomingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Scheduled ahead</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Blocks</p>
          <p className="text-3xl font-semibold text-foreground">{slots.length}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Most Blocked</p>
          <p className="text-sm font-semibold text-foreground truncate mt-1">{mostBlocked ? mostBlocked[0].split(' ')[0] : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{mostBlocked ? `${mostBlocked[1]} active block${mostBlocked[1] !== 1 ? 's' : ''}` : 'No active blocks'}</p>
        </div>
      </div>

      {/* Main layout: calendar + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <MiniCalendar slots={slots} filterParalegal={filterParalegal} />
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#355E3B]/30"
              value={filterParalegal}
              onChange={(e) => setFilterParalegal(e.target.value)}
            >
              <option value="">All Paralegals</option>
              {PARALEGALS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#355E3B]/30"
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value as BlockedReason | '')}
            >
              <option value="">All Reasons</option>
              {(Object.keys(REASON_CONFIG) as BlockedReason[]).map((r) => (
                <option key={r} value={r}>{REASON_CONFIG[r].label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                className="rounded border-border"
              />
              Show past blocks
            </label>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Slot cards */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Loading blocked slots…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">No blocked slots found</p>
              <p className="text-xs text-muted-foreground mt-1">Block a time slot to prevent case assignments during that period.</p>
              <button
                onClick={openNew}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: ACCENT }}
              >
                Block Time Slot
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((slot) => {
                const cfg = REASON_CONFIG[slot.reason];
                const active = isActiveBlock(slot);
                const isPast = new Date(slot.end_datetime) < now;
                const isOngoing = new Date(slot.start_datetime) <= now && new Date(slot.end_datetime) >= now;

                return (
                  <div
                    key={slot.id}
                    className={`bg-card border rounded-2xl p-4 transition-all ${isPast ? 'opacity-60 border-border' : 'border-border hover:border-[#355E3B]/30 hover:shadow-sm'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Reason badge */}
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{slot.title}</p>
                            {isOngoing && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Active Now
                              </span>
                            )}
                            {!isOngoing && active && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Upcoming</span>
                            )}
                            {isPast && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">Past</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <strong>{slot.paralegal_name}</strong>
                            {' · '}
                            {slot.all_day
                              ? `${formatDate(slot.start_datetime)} — ${formatDate(slot.end_datetime)} (All day)`
                              : `${formatDate(slot.start_datetime)} ${formatTime(slot.start_datetime)} → ${formatDate(slot.end_datetime)} ${formatTime(slot.end_datetime)}`
                            }
                          </p>
                          {slot.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{slot.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(slot)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove block"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <BlockFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditSlot(null); setEditId(null); }}
        onSave={handleSave}
        initial={editSlot}
        saving={saving}
      />
    </div>
  );
}
