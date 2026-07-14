'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultationOutcome {
  id: string;
  booking_id: string | null;
  inquiry_id: string | null;
  clio_matter_id: string | null;
  clio_matter_clio_id: number | null;
  client_name: string | null;
  client_email: string | null;
  consultation_date: string | null;
  outcome_summary: string | null;
  consultation_notes: string | null;
  next_steps: string | null;
  deliverables: string | null;
  follow_up_date: string | null;
  status: string;
  linked_to_clio: boolean;
  clio_note_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ClioMatter {
  id: string;
  clio_id: number;
  display_number: string | null;
  description: string | null;
  status: string | null;
  client_name: string | null;
  practice_area: string | null;
}

interface ConsultationBooking {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
}

type ModalMode = 'create' | 'edit' | null;

const STATUS_OPTIONS = ['draft', 'in_review', 'finalized', 'archived'];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  finalized: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  finalized: 'Finalized',
  archived: 'Archived',
};

// ─── Outcome Form Modal ───────────────────────────────────────────────────────

function OutcomeFormModal({
  mode,
  outcome,
  clioMatters,
  consultationBookings,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  outcome: ConsultationOutcome | null;
  clioMatters: ClioMatter[];
  consultationBookings: ConsultationBooking[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    booking_id: outcome?.booking_id ?? '',
    clio_matter_id: outcome?.clio_matter_id ?? '',
    client_name: outcome?.client_name ?? '',
    client_email: outcome?.client_email ?? '',
    consultation_date: outcome?.consultation_date ?? '',
    outcome_summary: outcome?.outcome_summary ?? '',
    consultation_notes: outcome?.consultation_notes ?? '',
    next_steps: outcome?.next_steps ?? '',
    deliverables: outcome?.deliverables ?? '',
    follow_up_date: outcome?.follow_up_date ?? '',
    status: outcome?.status ?? 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill client info when booking is selected
  const handleBookingChange = (bookingId: string) => {
    const booking = consultationBookings.find(b => b.id === bookingId);
    setForm(f => ({
      ...f,
      booking_id: bookingId,
      client_name: booking?.client_name ?? f.client_name,
      client_email: booking?.client_email ?? f.client_email,
      consultation_date: booking?.booking_date ?? f.consultation_date,
    }));
  };

  const handleSave = async () => {
    if (!form.client_name.trim()) {
      setError('Client name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const selectedMatter = clioMatters.find(m => m.id === form.clio_matter_id);
      const payload = {
        booking_id: form.booking_id || null,
        clio_matter_id: form.clio_matter_id || null,
        clio_matter_clio_id: selectedMatter?.clio_id ?? null,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim() || null,
        consultation_date: form.consultation_date || null,
        outcome_summary: form.outcome_summary.trim() || null,
        consultation_notes: form.consultation_notes.trim() || null,
        next_steps: form.next_steps.trim() || null,
        deliverables: form.deliverables.trim() || null,
        follow_up_date: form.follow_up_date || null,
        status: form.status,
        linked_to_clio: !!form.clio_matter_id,
        updated_at: new Date().toISOString(),
      };

      if (mode === 'create') {
        const { error: insertError } = await supabase
          .from('consultation_outcomes')
          .insert(payload);
        if (insertError) throw new Error(insertError.message);
      } else if (outcome) {
        const { error: updateError } = await supabase
          .from('consultation_outcomes')
          .update(payload)
          .eq('id', outcome.id);
        if (updateError) throw new Error(updateError.message);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-[#1B2A4A]">
              {mode === 'create' ? 'New Consultation Outcome' : 'Edit Outcome'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Capture post-consultation notes, next steps, and deliverables
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Link to Consultation Booking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">
                Link to Consultation Booking
              </label>
              <select
                value={form.booking_id}
                onChange={e => handleBookingChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
              >
                <option value="">— Select booking (optional) —</option>
                {consultationBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.client_name} — {b.booking_date ?? 'No date'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">
                Link to Clio Matter
              </label>
              <select
                value={form.clio_matter_id}
                onChange={e => setForm(f => ({ ...f, clio_matter_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
              >
                <option value="">— Select Clio matter (optional) —</option>
                {clioMatters.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_number ? `#${m.display_number} — ` : ''}{m.client_name ?? 'Unknown'}{m.practice_area ? ` (${m.practice_area})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Client Email</label>
              <input
                type="email"
                value={form.client_email}
                onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
              />
            </div>
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Consultation Date</label>
              <input
                type="date"
                value={form.consultation_date}
                onChange={e => setForm(f => ({ ...f, consultation_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Follow-up Date</label>
              <input
                type="date"
                value={form.follow_up_date}
                onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Outcome Summary */}
          <div>
            <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Outcome Summary</label>
            <textarea
              value={form.outcome_summary}
              onChange={e => setForm(f => ({ ...f, outcome_summary: e.target.value }))}
              rows={2}
              placeholder="Brief summary of the consultation outcome..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {/* Consultation Notes */}
          <div>
            <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Consultation Notes</label>
            <textarea
              value={form.consultation_notes}
              onChange={e => setForm(f => ({ ...f, consultation_notes: e.target.value }))}
              rows={4}
              placeholder="Detailed notes from the consultation — issues discussed, client concerns, legal analysis..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {/* Next Steps */}
          <div>
            <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Next Steps</label>
            <textarea
              value={form.next_steps}
              onChange={e => setForm(f => ({ ...f, next_steps: e.target.value }))}
              rows={3}
              placeholder="Action items and next steps for the client and/or attorney..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {/* Deliverables */}
          <div>
            <label className="block text-xs font-medium text-[#1B2A4A] mb-1.5">Deliverables</label>
            <textarea
              value={form.deliverables}
              onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))}
              rows={3}
              placeholder="Documents, contracts, or other deliverables promised to the client..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-medium hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              mode === 'create' ? 'Create Outcome' : 'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Outcome Detail Panel ─────────────────────────────────────────────────────

function OutcomeDetailPanel({
  outcome,
  clioMatters,
  onEdit,
  onClose,
  onDelete,
}: {
  outcome: ConsultationOutcome;
  clioMatters: ClioMatter[];
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const linkedMatter = clioMatters.find(m => m.id === outcome.clio_matter_id);

  const Section = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value ? (
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg h-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-semibold text-[#1B2A4A] truncate">{outcome.client_name}</h3>
            {outcome.client_email && (
              <p className="text-xs text-gray-500 mt-0.5">{outcome.client_email}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[outcome.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[outcome.status] ?? outcome.status}
              </span>
              {outcome.linked_to_clio && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Clio Linked
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {outcome.consultation_date && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-0.5">Consultation Date</p>
                <p className="text-sm font-medium text-[#1B2A4A]">
                  {new Date(outcome.consultation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
            {outcome.follow_up_date && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-600 mb-0.5">Follow-up Due</p>
                <p className="text-sm font-medium text-amber-800">
                  {new Date(outcome.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Clio Matter */}
          {linkedMatter && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Clio Matter</p>
              <p className="text-sm font-semibold text-blue-900">
                {linkedMatter.display_number ? `#${linkedMatter.display_number} — ` : ''}{linkedMatter.client_name}
              </p>
              {linkedMatter.practice_area && (
                <p className="text-xs text-blue-700 mt-0.5">{linkedMatter.practice_area}</p>
              )}
              {linkedMatter.description && (
                <p className="text-xs text-blue-600 mt-1 line-clamp-2">{linkedMatter.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  linkedMatter.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {linkedMatter.status ?? 'Unknown'}
                </span>
              </div>
            </div>
          )}

          <Section label="Outcome Summary" value={outcome.outcome_summary} />
          <Section label="Consultation Notes" value={outcome.consultation_notes} />
          <Section label="Next Steps" value={outcome.next_steps} />
          <Section label="Deliverables" value={outcome.deliverables} />

          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Created {new Date(outcome.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {outcome.updated_at !== outcome.created_at && (
              <> · Updated {new Date(outcome.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onDelete}
            className="px-4 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-medium hover:bg-[#1B2A4A]/90 transition-colors"
          >
            Edit Outcome
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ConsultationOutcomesDashboard() {
  const [outcomes, setOutcomes] = useState<ConsultationOutcome[]>([]);
  const [clioMatters, setClioMatters] = useState<ClioMatter[]>([]);
  const [consultationBookings, setConsultationBookings] = useState<ConsultationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClio, setFilterClio] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ConsultationOutcome | null>(null);
  const [detailOutcome, setDetailOutcome] = useState<ConsultationOutcome | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [outcomesRes, mattersRes, bookingsRes] = await Promise.all([
        supabase
          .from('consultation_outcomes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('clio_matters')
          .select('id, clio_id, display_number, description, status, client_name, practice_area')
          .order('client_name', { ascending: true }),
        supabase
          .from('consultation_bookings')
          .select('id, client_name, client_email, booking_date, booking_time, status')
          .order('booking_date', { ascending: false })
          .limit(200),
      ]);
      if (outcomesRes.error) throw new Error(outcomesRes.error.message);
      if (mattersRes.error) throw new Error(mattersRes.error.message);
      setOutcomes(outcomesRes.data ?? []);
      setClioMatters(mattersRes.data ?? []);
      setConsultationBookings(bookingsRes.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this consultation outcome? This cannot be undone.')) return;
    try {
      const supabase = createClient();
      const { error: delError } = await supabase
        .from('consultation_outcomes')
        .delete()
        .eq('id', id);
      if (delError) throw new Error(delError.message);
      setDetailOutcome(null);
      fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const filtered = outcomes.filter(o => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (o.client_name ?? '').toLowerCase().includes(q) ||
      (o.client_email ?? '').toLowerCase().includes(q) ||
      (o.outcome_summary ?? '').toLowerCase().includes(q) ||
      (o.consultation_notes ?? '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchClio =
      filterClio === '' ? true :
      filterClio === 'linked' ? o.linked_to_clio :
      filterClio === 'unlinked' ? !o.linked_to_clio : true;
    return matchSearch && matchStatus && matchClio;
  });

  // Stats
  const totalCount = outcomes.length;
  const linkedCount = outcomes.filter(o => o.linked_to_clio).length;
  const finalizedCount = outcomes.filter(o => o.status === 'finalized').length;
  const pendingFollowUp = outcomes.filter(o => o.follow_up_date && new Date(o.follow_up_date) >= new Date()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1B2A4A]">Consultation Outcomes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Post-consultation notes, next steps, deliverables, and Clio matter links
          </p>
        </div>
        <button
          onClick={() => { setSelectedOutcome(null); setModalMode('create'); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B2A4A] text-white text-sm font-medium hover:bg-[#1B2A4A]/90 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Outcome
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Outcomes', value: totalCount, color: 'text-[#1B2A4A]', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Linked to Clio', value: linkedCount, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Finalized', value: finalizedCount, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Pending Follow-up', value: pendingFollowUp, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client name, email, or notes…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterClio}
          onChange={e => setFilterClio(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A] bg-white"
        >
          <option value="">All Records</option>
          <option value="linked">Linked to Clio</option>
          <option value="unlinked">Not Linked</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#1B2A4A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="mx-auto mb-3 opacity-30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <p className="text-sm font-medium">No outcomes found</p>
          <p className="text-xs mt-1">
            {search || filterStatus || filterClio
              ? 'Try adjusting your filters' :'Click "New Outcome" to capture your first post-consultation record'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome Summary</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clio Matter</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(outcome => {
                  const matter = clioMatters.find(m => m.id === outcome.clio_matter_id);
                  const followUpPast = outcome.follow_up_date && new Date(outcome.follow_up_date) < new Date();
                  return (
                    <tr
                      key={outcome.id}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => setDetailOutcome(outcome)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1B2A4A] truncate max-w-[140px]">{outcome.client_name ?? '—'}</p>
                        {outcome.client_email && (
                          <p className="text-xs text-gray-400 truncate max-w-[140px]">{outcome.client_email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {outcome.consultation_date
                          ? new Date(outcome.consultation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 line-clamp-2 max-w-[220px]">
                          {outcome.outcome_summary ?? (outcome.consultation_notes ? outcome.consultation_notes.slice(0, 80) + '…' : '—')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {matter ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                              </svg>
                              {matter.display_number ? `#${matter.display_number}` : matter.client_name ?? 'Linked'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {outcome.follow_up_date ? (
                          <span className={`text-xs font-medium ${followUpPast ? 'text-red-600' : 'text-amber-600'}`}>
                            {new Date(outcome.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {followUpPast && ' ⚠'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[outcome.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[outcome.status] ?? outcome.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setSelectedOutcome(outcome); setModalMode('edit'); }}
                          className="text-gray-400 hover:text-[#1B2A4A] transition-colors p-1"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {outcomes.length} outcome{outcomes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <OutcomeFormModal
          mode={modalMode}
          outcome={selectedOutcome}
          clioMatters={clioMatters}
          consultationBookings={consultationBookings}
          onClose={() => { setModalMode(null); setSelectedOutcome(null); }}
          onSaved={() => { setModalMode(null); setSelectedOutcome(null); fetchData(); }}
        />
      )}

      {/* Detail Panel */}
      {detailOutcome && (
        <OutcomeDetailPanel
          outcome={detailOutcome}
          clioMatters={clioMatters}
          onEdit={() => { setSelectedOutcome(detailOutcome); setDetailOutcome(null); setModalMode('edit'); }}
          onClose={() => setDetailOutcome(null)}
          onDelete={() => handleDelete(detailOutcome.id)}
        />
      )}
    </div>
  );
}
