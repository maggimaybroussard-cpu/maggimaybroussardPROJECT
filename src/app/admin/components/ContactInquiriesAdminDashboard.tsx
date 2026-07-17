'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackLeadQualificationChange } from '@/lib/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactInquiry {
  id: string;
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  status: string;
  notes: string | null;
  service_interest_tag: string | null;
  retainer_tier_tag: string | null;
  is_qualified: boolean | null;
  follow_up_status: string | null;
  follow_up_date: string | null;
  lead_tags: string[] | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_INTEREST_OPTIONS = [
  'Document Drafting',
  'Legal Research',
  'Contract Review',
  'Litigation Support',
  'Case Management',
  'Deposition Prep',
  'Discovery',
  'Compliance',
  'Corporate Law',
  'Estate Planning',
  'Other',
];

const RETAINER_TIER_OPTIONS = [
  { value: 'starter', label: 'Starter', price: '$650/mo', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'standard', label: 'Standard', price: '$1,200/mo', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'growth', label: 'Growth', price: '$2,200/mo', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'project_hourly', label: 'Project/Hourly', price: 'Variable', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'attempted', label: 'Attempted', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'no_response', label: 'No Response', color: 'bg-red-100 text-red-600 border-red-200' },
];

const INQUIRY_STATUS_OPTIONS = ['new', 'in_review', 'contacted', 'closed'];
const INQUIRY_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_review: 'In Review',
  contacted: 'Contacted',
  closed: 'Closed',
};
const INQUIRY_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  contacted: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const TIER_BILLING_NOTES: Record<string, { cadence: string; due: string; overage: string; cancel: string }> = {
  starter: { cadence: 'Monthly invoice', due: 'Net 15', overage: '$85/hr', cancel: '15-day notice' },
  standard: { cadence: 'Monthly invoice', due: 'Net 10', overage: '$95/hr', cancel: '15-day notice' },
  growth: { cadence: 'Monthly invoice', due: 'Net 7', overage: '$105/hr', cancel: '15-day notice' },
  project_hourly: { cadence: 'Per milestone', due: 'Net 15', overage: 'N/A', cancel: 'Project-based' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTierConfig(value: string | null) {
  return RETAINER_TIER_OPTIONS.find((t) => t.value === value) ?? null;
}

function getFollowUpConfig(value: string | null) {
  return FOLLOW_UP_STATUS_OPTIONS.find((f) => f.value === value) ?? FOLLOW_UP_STATUS_OPTIONS[0];
}

// ─── CSV Export Helper ────────────────────────────────────────────────────────

function exportToCSV(rows: ContactInquiry[]) {
  const headers = [
    'Name', 'Firm', 'Email', 'Service', 'Status', 'Qualified',
    'Service Interest Tag', 'Retainer Tier', 'Follow-Up Status',
    'Follow-Up Date', 'Notes', 'Submitted At',
  ];
  const escape = (v: string | null | undefined) => {
    const s = v ?? '';
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csvRows = rows.map((r) => [
    escape(r.name),
    escape(r.firm),
    escape(r.email),
    escape(r.service),
    escape(INQUIRY_STATUS_LABELS[r.status] ?? r.status),
    r.is_qualified === true ? '"Qualified"' : r.is_qualified === false ? '"Unqualified"' : '"Not Reviewed"',
    escape(r.service_interest_tag),
    escape(r.retainer_tier_tag),
    escape(r.follow_up_status),
    escape(r.follow_up_date ? formatDate(r.follow_up_date) : null),
    escape(r.notes),
    escape(r.created_at ? formatDate(r.created_at) : null),
  ].join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contact-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContactInquiriesAdminDashboard() {
  const supabase = createClient();

  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContactInquiry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterQualified, setFilterQualified] = useState<'all' | 'qualified' | 'unqualified' | 'unset'>('all');
  const [filterFollowUp, setFilterFollowUp] = useState('all');
  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);

  // Edit state for selected inquiry
  const [editServiceTag, setEditServiceTag] = useState('');
  const [editTierTag, setEditTierTag] = useState('');
  const [editIsQualified, setEditIsQualified] = useState<boolean | null>(null);
  const [editFollowUpStatus, setEditFollowUpStatus] = useState('pending');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('new');

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('contact_inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setInquiries(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Sync edit state when selected changes
  useEffect(() => {
    if (selected) {
      setEditServiceTag(selected.service_interest_tag ?? '');
      setEditTierTag(selected.retainer_tier_tag ?? '');
      setEditIsQualified(selected.is_qualified ?? null);
      setEditFollowUpStatus(selected.follow_up_status ?? 'pending');
      setEditFollowUpDate(selected.follow_up_date ? selected.follow_up_date.slice(0, 10) : '');
      setEditNotes(selected.notes ?? '');
      setEditStatus(selected.status ?? 'new');
      setSaveSuccess(false);
    }
  }, [selected?.id]);

  // Filtered list
  const filtered = inquiries.filter((inq) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inq.name.toLowerCase().includes(q) ||
      inq.email.toLowerCase().includes(q) ||
      inq.firm.toLowerCase().includes(q) ||
      inq.service.toLowerCase().includes(q) ||
      (inq.service_interest_tag ?? '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || inq.status === filterStatus;
    const matchTier = filterTier === 'all' || inq.retainer_tier_tag === filterTier;
    const matchQualified =
      filterQualified === 'all' ||
      (filterQualified === 'qualified' && inq.is_qualified === true) ||
      (filterQualified === 'unqualified' && inq.is_qualified === false) ||
      (filterQualified === 'unset' && inq.is_qualified === null);
    const matchFollowUp = filterFollowUp === 'all' || inq.follow_up_status === filterFollowUp;
    // Date range filter
    const createdAt = new Date(inq.created_at);
    const matchFrom = !dateFrom || createdAt >= new Date(dateFrom);
    const matchTo = !dateTo || createdAt <= new Date(dateTo + 'T23:59:59');
    return matchSearch && matchStatus && matchTier && matchQualified && matchFollowUp && matchFrom && matchTo;
  });

  // Stats
  const stats = {
    total: inquiries.length,
    qualified: inquiries.filter((i) => i.is_qualified === true).length,
    unqualified: inquiries.filter((i) => i.is_qualified === false).length,
    pendingFollowUp: inquiries.filter((i) => i.follow_up_status === 'pending' || !i.follow_up_status).length,
    completedFollowUp: inquiries.filter((i) => i.follow_up_status === 'completed').length,
  };

  // Bulk selection helpers
  const allFilteredSelected = filtered.length > 0 && filtered.every((inq) => selectedIds.has(inq.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((inq) => inq.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatusUpdate() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkSuccess(false);
    try {
      const ids = Array.from(selectedIds);
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ status: bulkStatus })
        .in('id', ids);
      if (updateError) throw updateError;
      setInquiries((prev) =>
        prev.map((inq) => (selectedIds.has(inq.id) ? { ...inq, status: bulkStatus } : inq))
      );
      if (selected && selectedIds.has(selected.id)) {
        setSelected((prev) => prev ? { ...prev, status: bulkStatus } : null);
        setEditStatus(bulkStatus);
      }
      setSelectedIds(new Set());
      setBulkStatus('');
      setBulkSuccess(true);
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updates: Partial<ContactInquiry> = {
        service_interest_tag: editServiceTag || null,
        retainer_tier_tag: editTierTag || null,
        is_qualified: editIsQualified,
        follow_up_status: editFollowUpStatus,
        follow_up_date: editFollowUpDate ? new Date(editFollowUpDate).toISOString() : null,
        notes: editNotes || null,
        status: editStatus,
      };
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update(updates)
        .eq('id', selected.id);
      if (updateError) throw updateError;
      // Track qualification change if it differs from the saved value
      if (editIsQualified !== selected.is_qualified) {
        trackLeadQualificationChange({
          inquiryId: selected.id,
          isQualified: editIsQualified,
          retainerTier: editTierTag || null,
          serviceTag: editServiceTag || null,
          previousValue: selected.is_qualified,
        });
      }
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === selected.id ? { ...inq, ...updates } as ContactInquiry : inq))
      );
      setSelected((prev) => (prev ? { ...prev, ...updates } as ContactInquiry : null));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const tierConfig = getTierConfig(editTierTag);
  const billingNote = editTierTag ? TIER_BILLING_NOTES[editTierTag] : null;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-foreground' },
          { label: 'Qualified', value: stats.qualified, color: 'text-emerald-600' },
          { label: 'Unqualified', value: stats.unqualified, color: 'text-red-500' },
          { label: 'Follow-Up Pending', value: stats.pendingFollowUp, color: 'text-amber-600' },
          { label: 'Follow-Up Done', value: stats.completedFollowUp, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, email, firm, service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {INQUIRY_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
        >
          <option value="all">All Tiers</option>
          {RETAINER_TIER_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label} ({t.price})</option>
          ))}
        </select>
        <select
          value={filterQualified}
          onChange={(e) => setFilterQualified(e.target.value as typeof filterQualified)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
        >
          <option value="all">All Leads</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
          <option value="unset">Not Reviewed</option>
        </select>
        <select
          value={filterFollowUp}
          onChange={(e) => setFilterFollowUp(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
        >
          <option value="all">All Follow-Ups</option>
          {FOLLOW_UP_STATUS_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={fetchInquiries}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Date Range Filter + Export Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Date Range:</span>
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          title="To date"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Clear dates
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => exportToCSV(filtered)}
          disabled={filtered.length === 0}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-accent/50 hover:bg-accent/5 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
          {filtered.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold">{filtered.length}</span>
          )}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'submission' : 'submissions'} selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
            >
              <option value="">— Set status to… —</option>
              {INQUIRY_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || bulkSaving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: '#355E3B' }}
            >
              {bulkSaving ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Updating…
                </>
              ) : bulkSuccess ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Updated
                </>
              ) : 'Apply'}
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div className={`grid gap-6 ${selected ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>

        {/* Table */}
        <div className={selected ? 'lg:col-span-3' : 'col-span-1'}>
          {loading ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-border last:border-0 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                    <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-6 bg-muted/40 rounded-full animate-pulse" />
                  <div className="w-20 h-6 bg-muted/40 rounded-full animate-pulse" />
                  <div className="w-16 h-6 bg-muted/40 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">
                {search || filterStatus !== 'all' || filterTier !== 'all' || filterQualified !== 'all' || filterFollowUp !== 'all' || dateFrom || dateTo
                  ? 'No inquiries match your filters.' : 'No contact submissions yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-border cursor-pointer accent-green-700"
                          title="Select all visible"
                        />
                      </th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Lead</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Service Tag</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Tier</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Qualified</th>
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden lg:table-cell">Follow-Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inq, i) => {
                      const tierCfg = getTierConfig(inq.retainer_tier_tag);
                      const followUpCfg = getFollowUpConfig(inq.follow_up_status);
                      return (
                        <tr
                          key={inq.id}
                          className={`border-b border-border last:border-0 transition-colors ${
                            selected?.id === inq.id
                              ? 'bg-primary/5'
                              : i % 2 === 0 ? 'hover:bg-secondary/30' : 'bg-secondary/10 hover:bg-secondary/30'
                          }`}
                        >
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(inq.id)}
                              onChange={() => toggleSelectOne(inq.id)}
                              className="rounded border-border cursor-pointer accent-green-700"
                            />
                          </td>
                          <td
                            className="px-5 py-3.5 cursor-pointer"
                            onClick={() => setSelected(selected?.id === inq.id ? null : inq)}
                          >
                            <p className="font-medium text-foreground">{inq.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{inq.email}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${INQUIRY_STATUS_COLORS[inq.status] || INQUIRY_STATUS_COLORS['new']}`}>
                                {INQUIRY_STATUS_LABELS[inq.status] || inq.status}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">{formatDate(inq.created_at)}</span>
                            </div>
                          </td>
                          <td
                            className="px-5 py-3.5 hidden sm:table-cell cursor-pointer"
                            onClick={() => setSelected(selected?.id === inq.id ? null : inq)}
                          >
                            {inq.service_interest_tag ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/60 text-foreground border border-border">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                                </svg>
                                {inq.service_interest_tag}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">Untagged</span>
                            )}
                          </td>
                          <td
                            className="px-5 py-3.5 hidden md:table-cell cursor-pointer"
                            onClick={() => setSelected(selected?.id === inq.id ? null : inq)}
                          >
                            {tierCfg ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${tierCfg.color}`}>
                                {tierCfg.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">No tier</span>
                            )}
                          </td>
                          <td
                            className="px-5 py-3.5 cursor-pointer"
                            onClick={() => setSelected(selected?.id === inq.id ? null : inq)}
                          >
                            {inq.is_qualified === true && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Qualified
                              </span>
                            )}
                            {inq.is_qualified === false && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 border border-red-200">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                                Unqualified
                              </span>
                            )}
                            {inq.is_qualified === null && (
                              <span className="text-xs text-muted-foreground/50 italic">Not reviewed</span>
                            )}
                          </td>
                          <td
                            className="px-5 py-3.5 hidden lg:table-cell cursor-pointer"
                            onClick={() => setSelected(selected?.id === inq.id ? null : inq)}
                          >
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${followUpCfg.color}`}>
                              {followUpCfg.label}
                            </span>
                            {inq.follow_up_date && (
                              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(inq.follow_up_date)}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>Showing {filtered.length} of {inquiries.length} {inquiries.length === 1 ? 'submission' : 'submissions'}</span>
                {someSelected && (
                  <span className="text-accent font-medium">{selectedIds.size} selected</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detail / Edit Panel */}
        {selected && (
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-28 space-y-5">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-xl text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.firm}</p>
                  <a href={`mailto:${selected.email}`} className="text-xs text-accent hover:underline mt-0.5 block">{selected.email}</a>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Message</p>
                <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/40 rounded-xl p-3.5 border border-border max-h-28 overflow-y-auto">
                  {selected.message}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Submitted {formatDate(selected.created_at)} · Original service: <span className="font-medium">{selected.service}</span></p>
              </div>

              {/* Inquiry Status */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Inquiry Status</p>
                <div className="flex flex-wrap gap-2">
                  {INQUIRY_STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        editStatus === s ? INQUIRY_STATUS_COLORS[s] : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                      }`}
                    >
                      {INQUIRY_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Interest Tag */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Service Interest Tag</p>
                <select
                  value={editServiceTag}
                  onChange={(e) => setEditServiceTag(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all appearance-none cursor-pointer"
                >
                  <option value="">— Select service interest —</option>
                  {SERVICE_INTEREST_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Retainer Tier Tag */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Retainer Tier</p>
                <div className="flex flex-wrap gap-2">
                  {RETAINER_TIER_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setEditTierTag(editTierTag === t.value ? '' : t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        editTierTag === t.value ? t.color : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                      }`}
                    >
                      {t.label} <span className="opacity-70">{t.price}</span>
                    </button>
                  ))}
                </div>
                {billingNote && tierConfig && (
                  <div className={`mt-2.5 rounded-xl p-3 border text-xs space-y-1 ${tierConfig.color}`}>
                    <p className="font-semibold mb-1">{tierConfig.label} Billing Terms</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      <span className="opacity-70">Cadence:</span><span>{billingNote.cadence}</span>
                      <span className="opacity-70">Due:</span><span>{billingNote.due}</span>
                      <span className="opacity-70">Overage:</span><span>{billingNote.overage}</span>
                      <span className="opacity-70">Cancellation:</span><span>{billingNote.cancel}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Qualified / Unqualified */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Lead Qualification</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditIsQualified(editIsQualified === true ? null : true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      editIsQualified === true
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-transparent border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Qualified
                  </button>
                  <button
                    onClick={() => setEditIsQualified(editIsQualified === false ? null : false)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      editIsQualified === false
                        ? 'bg-red-100 text-red-600 border-red-300' : 'bg-transparent border-border text-muted-foreground hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Unqualified
                  </button>
                </div>
                {editIsQualified === null && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">Click to mark — click again to clear</p>
                )}
              </div>

              {/* Follow-Up Status */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Follow-Up Status</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {FOLLOW_UP_STATUS_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setEditFollowUpStatus(f.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        editFollowUpStatus === f.value ? f.color : 'bg-transparent border-border text-muted-foreground hover:border-accent/50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Follow-Up Date</label>
                  <input
                    type="date"
                    value={editFollowUpDate}
                    onChange={(e) => setEditFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Internal Notes</p>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add internal notes about this lead…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {saving ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Saving…
                  </>
                ) : saveSuccess ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Saved
                  </>
                ) : 'Save Changes'}
              </button>

              {/* Quick Reply */}
              <a
                href={`mailto:${selected.email}?subject=Re: Your Inquiry — Maggi May Broussard Legal Services`}
                className="w-full py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Reply via Email
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
