'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action_type: string;
  actor_email: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface ComplianceExportLog {
  id: string;
  exported_by_email: string;
  export_format: string;
  date_from: string | null;
  date_to: string | null;
  action_filter: string | null;
  total_records: number;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  user_login: 'User Login',
  user_logout: 'User Logout',
  document_upload: 'Document Upload',
  document_delete: 'Document Delete',
  document_download: 'Document Download',
  invoice_sent: 'Invoice Sent',
  invoice_created: 'Invoice Created',
  invoice_updated: 'Invoice Updated',
  case_created: 'Case Created',
  case_updated: 'Case Updated',
  case_status_changed: 'Case Status Changed',
  case_stage_changed: 'Case Stage Changed',
  case_note_added: 'Case Note Added',
  client_invited: 'Client Invited',
  client_email_sent: 'Client Email Sent',
  task_created: 'Task Created',
  task_updated: 'Task Updated',
  task_completed: 'Task Completed',
  template_created: 'Template Created',
  template_updated: 'Template Updated',
  template_deleted: 'Template Deleted',
  email_template_updated: 'Email Template Updated',
  retainer_created: 'Retainer Created',
  retainer_updated: 'Retainer Updated',
  retainer_renewed: 'Retainer Renewed',
  retainer_cancelled: 'Retainer Cancelled',
  payment_recorded: 'Payment Recorded',
  payment_failed: 'Payment Failed',
  message_sent: 'Message Sent',
  signature_requested: 'Signature Requested',
  signature_completed: 'Signature Completed',
  data_export: 'Data Export',
  intake_submitted: 'Intake Submitted',
  appointment_booked: 'Appointment Booked',
  stripe_invoice_synced: 'Stripe Invoice Synced',
  admin_action: 'Admin Action',
  permission_changed: 'Permission Changed',
  role_changed: 'Role Changed',
};

const ACTION_CATEGORIES: Record<string, string[]> = {
  'Authentication': ['user_login', 'user_logout'],
  'Documents': ['document_upload', 'document_delete', 'document_download'],
  'Invoices': ['invoice_sent', 'invoice_created', 'invoice_updated', 'stripe_invoice_synced'],
  'Cases': ['case_created', 'case_updated', 'case_status_changed', 'case_stage_changed', 'case_note_added'],
  'Clients': ['client_invited', 'client_email_sent'],
  'Tasks': ['task_created', 'task_updated', 'task_completed'],
  'Templates': ['template_created', 'template_updated', 'template_deleted', 'email_template_updated'],
  'Billing': ['retainer_created', 'retainer_updated', 'retainer_renewed', 'retainer_cancelled', 'payment_recorded', 'payment_failed'],
  'Messaging': ['message_sent'],
  'Signatures': ['signature_requested', 'signature_completed'],
  'Intake & Bookings': ['intake_submitted', 'appointment_booked'],
  'Compliance': ['data_export'],
  'Permissions': ['permission_changed', 'role_changed'],
  'Other': ['admin_action'],
};

const ACTION_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  user_login: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  user_logout: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  document_upload: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  document_delete: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  document_download: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  invoice_sent: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  invoice_created: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  invoice_updated: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
  case_created: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  case_updated: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  case_status_changed: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  case_stage_changed: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400' },
  case_note_added: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  client_invited: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  client_email_sent: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  task_created: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  task_updated: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400' },
  task_completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  template_created: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  template_updated: { bg: 'bg-pink-50', text: 'text-pink-600', dot: 'bg-pink-400' },
  template_deleted: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  email_template_updated: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  retainer_created: { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
  retainer_updated: { bg: 'bg-lime-50', text: 'text-lime-600', dot: 'bg-lime-400' },
  retainer_renewed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  retainer_cancelled: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  payment_recorded: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  payment_failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  message_sent: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  signature_requested: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  signature_completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  data_export: { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
  intake_submitted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  appointment_booked: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  stripe_invoice_synced: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  admin_action: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
  permission_changed: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  role_changed: { bg: 'bg-violet-50', text: 'text-violet-800', dot: 'bg-violet-600' },
};

const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getActionColor(actionType: string) {
  return ACTION_COLORS[actionType] ?? { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' };
}

function exportAuditCSV(logs: AuditLog[]) {
  const headers = ['Timestamp', 'Action', 'Actor', 'Target', 'Description', 'IP Address'];
  const rows = logs.map(log => [
    formatDateTime(log.created_at),
    ACTION_LABELS[log.action_type] ?? log.action_type,
    log.actor_email,
    log.target_label ?? log.target_id ?? '',
    log.description,
    log.ip_address ?? '',
  ]);
  const csv = [headers, ...rows].map(row =>
    row.map(v => {
      const s = String(v ?? '').replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditTrailDashboard() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'trail' | 'compliance'>('trail');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<{ action_type: string; count: number }[]>([]);

  // Compliance Export state
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportActionFilter, setExportActionFilter] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<ComplianceExportLog[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, categoryFilter, actionFilter, dateFrom, dateTo, actorFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('audit_logs').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (debouncedSearch.trim()) {
        query = query.or(
          `description.ilike.%${debouncedSearch}%,actor_email.ilike.%${debouncedSearch}%,target_label.ilike.%${debouncedSearch}%`
        );
      }

      if (actionFilter) {
        query = query.eq('action_type', actionFilter);
      } else if (categoryFilter) {
        const actions = ACTION_CATEGORIES[categoryFilter] ?? [];
        if (actions.length > 0) {
          query = query.in('action_type', actions);
        }
      }

      if (actorFilter.trim()) {
        query = query.ilike('actor_email', `%${actorFilter}%`);
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;
      setLogs(data ?? []);
      setTotal(count ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, actionFilter, dateFrom, dateTo, actorFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('action_type')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(row => {
          counts[row.action_type] = (counts[row.action_type] ?? 0) + 1;
        });
        const sorted = Object.entries(counts)
          .map(([action_type, count]) => ({ action_type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        setStats(sorted);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchExportHistory = useCallback(async () => {
    setExportHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('compliance_export_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setExportHistory(data ?? []);
    } catch {
      // Non-critical
    } finally {
      setExportHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === 'compliance') fetchExportHistory();
  }, [activeTab, fetchExportHistory]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(debouncedSearch || categoryFilter || actionFilter || dateFrom || dateTo || actorFilter);

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setCategoryFilter('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
    setActorFilter('');
  }

  function handleCategoryChange(cat: string) {
    setCategoryFilter(cat);
    setActionFilter('');
  }

  const actionsForCategory = categoryFilter ? (ACTION_CATEGORIES[categoryFilter] ?? []) : Object.values(ACTION_CATEGORIES).flat();

  async function handleComplianceExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: exportFormat });
      if (exportDateFrom) params.set('date_from', exportDateFrom);
      if (exportDateTo) params.set('date_to', exportDateTo);
      if (exportActionFilter) params.set('action_type', exportActionFilter);

      const response = await fetch(`/api/admin/compliance-export?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error ?? 'Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);

      // Refresh export history
      setTimeout(() => fetchExportHistory(), 1000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-secondary/30 rounded-2xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('trail')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'trail' ?'bg-card shadow-sm text-foreground' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'compliance' ?'bg-card shadow-sm text-foreground' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Compliance Export
        </button>
      </div>

      {/* ── AUDIT TRAIL TAB ── */}
      {activeTab === 'trail' && (
        <>
          {/* Stats Row */}
          {stats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map(({ action_type, count }) => {
                const color = getActionColor(action_type);
                return (
                  <button
                    key={action_type}
                    onClick={() => { setActionFilter(action_type === actionFilter ? '' : action_type); setCategoryFilter(''); }}
                    className={`rounded-2xl border p-4 text-left transition-all hover:shadow-sm ${
                      actionFilter === action_type ? 'ring-2 ring-primary/40 border-primary/30' : 'border-border'
                    } bg-card`}
                  >
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide mb-2 ${color.bg} ${color.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                      {ACTION_LABELS[action_type]?.split(' ')[0] ?? action_type}
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{count}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">last 30 days</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search & Filters */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by description, actor, or target…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Export current page */}
              <button
                onClick={() => exportAuditCSV(logs)}
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground hover:bg-secondary/40 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Page
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={e => handleCategoryChange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Categories</option>
                {Object.keys(ACTION_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Action filter */}
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Actions</option>
                {actionsForCategory.map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                ))}
              </select>

              {/* Actor filter */}
              <input
                type="text"
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
                placeholder="Filter by actor email…"
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
              />

              {/* Date range */}
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${total.toLocaleString()} event${total !== 1 ? 's' : ''}${hasFilters ? ' matching filters' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary/40 disabled:opacity-40 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loading}
                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary/40 disabled:opacity-40 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Logs Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary/40 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  {hasFilters ? 'No events match your filters.' : 'No audit events recorded yet.'}
                </p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-[1fr_160px_160px_140px] gap-4 px-5 py-3 bg-secondary/20">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Event</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actor</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Target</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Timestamp</p>
                </div>

                {logs.map(log => {
                  const color = getActionColor(log.action_type);
                  const isExpanded = expandedId === log.id;
                  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                  return (
                    <div key={log.id} className="hover:bg-secondary/10 transition-colors">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="w-full text-left"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_140px] gap-2 sm:gap-4 px-5 py-4">
                          {/* Event */}
                          <div className="flex items-start gap-3 min-w-0">
                            <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${color.bg} ${color.text}`}>
                                  {ACTION_LABELS[log.action_type] ?? log.action_type}
                                </span>
                              </div>
                              <p className="text-sm text-foreground leading-snug truncate">{log.description}</p>
                            </div>
                          </div>

                          {/* Actor */}
                          <div className="sm:flex items-center hidden">
                            <p className="text-sm text-foreground truncate">{log.actor_email}</p>
                          </div>

                          {/* Target */}
                          <div className="sm:flex items-center hidden">
                            {log.target_label ? (
                              <p className="text-sm text-foreground truncate">{log.target_label}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="sm:flex items-center hidden">
                            <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
                          </div>

                          {/* Mobile: actor + time */}
                          <div className="sm:hidden flex items-center justify-between gap-2 mt-1">
                            <p className="text-xs text-muted-foreground truncate">{log.actor_email}</p>
                            <p className="text-xs text-muted-foreground flex-shrink-0">{formatDateTime(log.created_at)}</p>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-4 bg-secondary/10 border-t border-border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Event ID</p>
                              <p className="text-xs font-mono text-foreground break-all">{log.id}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Actor</p>
                              <p className="text-xs text-foreground">{log.actor_email}</p>
                              {log.actor_id && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{log.actor_id}</p>}
                            </div>
                            {log.target_type && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Target</p>
                                <p className="text-xs text-foreground">{log.target_label ?? log.target_id ?? '—'}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{log.target_type}{log.target_id ? ` · ${log.target_id}` : ''}</p>
                              </div>
                            )}
                            {log.ip_address && (
                              <div>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">IP Address</p>
                                <p className="text-xs font-mono text-foreground">{log.ip_address}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Timestamp</p>
                              <p className="text-xs text-foreground">{formatDateTime(log.created_at)}</p>
                            </div>
                            {hasMetadata && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Metadata</p>
                                <pre className="text-[11px] font-mono text-foreground bg-background border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-secondary/40 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-secondary/40 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ── COMPLIANCE EXPORT TAB ── */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <svg className="text-blue-600 flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-800">Compliance Data Export</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Download a complete audit record for regulatory purposes. All exports are logged and attributed to your account. Exports include all admin actions, case changes, document activity, billing events, and access records.
              </p>
            </div>
          </div>

          {/* Export Configuration */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Configure Export</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date From</label>
                <input
                  type="date"
                  value={exportDateFrom}
                  onChange={e => setExportDateFrom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date To</label>
                <input
                  type="date"
                  value={exportDateTo}
                  onChange={e => setExportDateTo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filter by Action Type</label>
                <select
                  value={exportActionFilter}
                  onChange={e => setExportActionFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Actions (Recommended)</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Export Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      exportFormat === 'csv' ?'border-primary/40 bg-primary/5 text-primary' :'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    CSV
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      exportFormat === 'json' ?'border-primary/40 bg-primary/5 text-primary' :'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                    JSON
                  </button>
                </div>
              </div>
            </div>

            {/* What's included */}
            <div className="bg-secondary/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-2">Export includes:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  'Event ID & Timestamp',
                  'Action Type & Label',
                  'Actor Email & ID',
                  'Target Type & ID',
                  'Description',
                  'IP Address',
                  'Full Metadata (JSON)',
                  'All event categories',
                  'Up to 50,000 records',
                ].map(item => (
                  <div key={item} className="flex items-center gap-1.5">
                    <svg className="text-emerald-500 flex-shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span className="text-[11px] text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={handleComplianceExport}
              disabled={exporting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {exporting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Generating Export…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download {exportFormat.toUpperCase()} Export
                </>
              )}
            </button>
          </div>

          {/* Export History */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Export History</h3>
              <p className="text-xs text-muted-foreground">Last 20 exports</p>
            </div>

            {exportHistoryLoading ? (
              <div className="flex items-center justify-center py-10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>
            ) : exportHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <p className="text-sm text-muted-foreground">No exports yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden sm:grid grid-cols-[1fr_100px_120px_100px_120px] gap-4 px-5 py-3 bg-secondary/20">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Exported By</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Format</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date Range</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Records</p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Exported At</p>
                </div>
                {exportHistory.map(entry => (
                  <div key={entry.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_100px_120px] gap-2 sm:gap-4 px-5 py-3.5 hover:bg-secondary/10 transition-colors">
                    <p className="text-sm text-foreground truncate">{entry.exported_by_email}</p>
                    <div className="sm:flex items-center hidden">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-700">
                        {entry.export_format}
                      </span>
                    </div>
                    <div className="sm:flex items-center hidden">
                      <p className="text-xs text-muted-foreground">
                        {entry.date_from ? new Date(entry.date_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'All'}
                        {' – '}
                        {entry.date_to ? new Date(entry.date_to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Now'}
                      </p>
                    </div>
                    <div className="sm:flex items-center hidden">
                      <p className="text-sm font-medium text-foreground">{entry.total_records.toLocaleString()}</p>
                    </div>
                    <div className="sm:flex items-center hidden">
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                    </div>
                    {/* Mobile */}
                    <div className="sm:hidden flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{entry.export_format.toUpperCase()} · {entry.total_records.toLocaleString()} records</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
