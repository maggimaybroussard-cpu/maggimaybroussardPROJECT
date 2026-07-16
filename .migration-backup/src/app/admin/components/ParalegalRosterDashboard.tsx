'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent, getAdminEmail } from '@/lib/auditLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

type ParalegalRole = 'admin' | 'paralegal' | 'read_only';
type ParalegalStatus = 'active' | 'inactive' | 'on_leave';

interface ParalegalProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  role: ParalegalRole;
  status: ParalegalStatus;
  can_view_cases: boolean;
  can_edit_cases: boolean;
  can_upload_documents: boolean;
  can_send_messages: boolean;
  can_manage_invoices: boolean;
  can_log_hours: boolean;
  can_view_billing: boolean;
  can_manage_clients: boolean;
  target_weekly_hours: number;
  hourly_rate: number | null;
  notes: string | null;
  avatar_url: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UtilizationData {
  paralegal_id: string;
  total_hours: number;
  billable_hours: number;
  case_count: number;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  title: string;
  role: ParalegalRole;
  status: ParalegalStatus;
  can_view_cases: boolean;
  can_edit_cases: boolean;
  can_upload_documents: boolean;
  can_send_messages: boolean;
  can_manage_invoices: boolean;
  can_log_hours: boolean;
  can_view_billing: boolean;
  can_manage_clients: boolean;
  target_weekly_hours: string;
  hourly_rate: string;
  notes: string;
  start_date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<ParalegalRole, { label: string; color: string; description: string }> = {
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Full access — manage cases, billing, clients, and team',
  },
  paralegal: {
    label: 'Paralegal',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Standard access — work on assigned cases and documents',
  },
  read_only: {
    label: 'Read-only',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    description: 'View-only access — no edits or uploads permitted',
  },
};

const STATUS_CONFIG: Record<ParalegalStatus, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', color: 'text-gray-500', dot: 'bg-gray-400' },
  on_leave: { label: 'On Leave', color: 'text-amber-700', dot: 'bg-amber-500' },
};

const ROLE_PERMISSION_PRESETS: Record<ParalegalRole, Partial<FormState>> = {
  admin: {
    can_view_cases: true, can_edit_cases: true, can_upload_documents: true,
    can_send_messages: true, can_manage_invoices: true, can_log_hours: true,
    can_view_billing: true, can_manage_clients: true,
  },
  paralegal: {
    can_view_cases: true, can_edit_cases: true, can_upload_documents: true,
    can_send_messages: true, can_manage_invoices: false, can_log_hours: true,
    can_view_billing: false, can_manage_clients: false,
  },
  read_only: {
    can_view_cases: true, can_edit_cases: false, can_upload_documents: false,
    can_send_messages: false, can_manage_invoices: false, can_log_hours: false,
    can_view_billing: false, can_manage_clients: false,
  },
};

const PERMISSION_LABELS: { key: keyof FormState; label: string; description: string }[] = [
  { key: 'can_view_cases', label: 'View Cases', description: 'Read case details and status' },
  { key: 'can_edit_cases', label: 'Edit Cases', description: 'Update case info and notes' },
  { key: 'can_upload_documents', label: 'Upload Documents', description: 'Add files to cases' },
  { key: 'can_send_messages', label: 'Send Messages', description: 'Message clients via portal' },
  { key: 'can_log_hours', label: 'Log Hours', description: 'Record billable time entries' },
  { key: 'can_view_billing', label: 'View Billing', description: 'See invoices and payments' },
  { key: 'can_manage_invoices', label: 'Manage Invoices', description: 'Create and send invoices' },
  { key: 'can_manage_clients', label: 'Manage Clients', description: 'Invite and manage client access' },
];

const EMPTY_FORM: FormState = {
  full_name: '', email: '', phone: '', title: '', role: 'paralegal', status: 'active',
  can_view_cases: true, can_edit_cases: true, can_upload_documents: true,
  can_send_messages: true, can_manage_invoices: false, can_log_hours: true,
  can_view_billing: false, can_manage_clients: false,
  target_weekly_hours: '40', hourly_rate: '', notes: '', start_date: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-3xl font-semibold text-foreground" style={accent ? { color: accent } : {}}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function PermissionToggle({
  checked, onChange, label, description, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${checked ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/20'}`}>
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${checked ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParalegalRosterDashboard() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<ParalegalProfile[]>([]);
  const [utilization, setUtilization] = useState<Record<string, UtilizationData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [filterRole, setFilterRole] = useState<'all' | ParalegalRole>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ParalegalStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ParalegalProfile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'permissions' | 'utilization'>('overview');

  // Form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('paralegal_profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (err) throw err;
      setProfiles(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load paralegal profiles');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchUtilization = useCallback(async () => {
    try {
      // Aggregate billable hours from retainer_time_logs by logged_by name
      const { data } = await supabase
        .from('retainer_time_logs')
        .select('logged_by, hours, inquiry_id')
        .not('logged_by', 'is', null);

      if (!data) return;

      const map: Record<string, UtilizationData> = {};
      data.forEach((row) => {
        const key = row.logged_by ?? '';
        if (!map[key]) {
          map[key] = { paralegal_id: key, total_hours: 0, billable_hours: 0, case_count: 0 };
        }
        map[key].total_hours += Number(row.hours ?? 0);
        map[key].billable_hours += Number(row.hours ?? 0);
        if (row.inquiry_id && !map[key + '_cases']?.includes?.(row.inquiry_id)) {
          map[key].case_count += 1;
        }
      });
      setUtilization(map);
    } catch {
      // Non-blocking
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfiles();
    fetchUtilization();
  }, [fetchProfiles, fetchUtilization]);

  // ─── Filtered List ──────────────────────────────────────────────────────────

  const filtered = profiles.filter((p) => {
    if (filterRole !== 'all' && p.role !== filterRole) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.title ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const activeCount = profiles.filter((p) => p.status === 'active').length;
  const adminCount = profiles.filter((p) => p.role === 'admin').length;
  const totalBillableHours = Object.values(utilization).reduce((s, u) => s + u.billable_hours, 0);
  const avgUtilization = profiles.length > 0
    ? Math.round(profiles.reduce((s, p) => {
        const u = Object.values(utilization).find((u) => u.paralegal_id === p.full_name);
        const target = p.target_weekly_hours * 4; // monthly
        return s + (u ? Math.min(100, Math.round((u.total_hours / target) * 100)) : 0);
      }, 0) / profiles.length)
    : 0;

  // ─── Form Helpers ────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setSaveError(null);
    setSelectedProfile(null);
  }

  function openEdit(p: ParalegalProfile) {
    setForm({
      full_name: p.full_name,
      email: p.email,
      phone: p.phone ?? '',
      title: p.title ?? '',
      role: p.role,
      status: p.status,
      can_view_cases: p.can_view_cases,
      can_edit_cases: p.can_edit_cases,
      can_upload_documents: p.can_upload_documents,
      can_send_messages: p.can_send_messages,
      can_manage_invoices: p.can_manage_invoices,
      can_log_hours: p.can_log_hours,
      can_view_billing: p.can_view_billing,
      can_manage_clients: p.can_manage_clients,
      target_weekly_hours: String(p.target_weekly_hours),
      hourly_rate: p.hourly_rate != null ? String(p.hourly_rate) : '',
      notes: p.notes ?? '',
      start_date: p.start_date ?? '',
    });
    setEditingId(p.id);
    setShowForm(true);
    setSaveError(null);
  }

  function applyRolePreset(role: ParalegalRole) {
    const preset = ROLE_PERMISSION_PRESETS[role];
    setForm((prev) => ({ ...prev, role, ...preset }));
  }

  async function handleSave() {
    if (!form.full_name.trim() || !form.email.trim()) {
      setSaveError('Full name and email are required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        title: form.title.trim() || null,
        role: form.role,
        status: form.status,
        can_view_cases: form.can_view_cases,
        can_edit_cases: form.can_edit_cases,
        can_upload_documents: form.can_upload_documents,
        can_send_messages: form.can_send_messages,
        can_manage_invoices: form.can_manage_invoices,
        can_log_hours: form.can_log_hours,
        can_view_billing: form.can_view_billing,
        can_manage_clients: form.can_manage_clients,
        target_weekly_hours: parseFloat(form.target_weekly_hours) || 40,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        notes: form.notes.trim() || null,
        start_date: form.start_date || null,
      };

      if (editingId) {
        // Capture previous state for diff
        const prevProfile = profiles.find((p) => p.id === editingId);

        const { error: err } = await supabase
          .from('paralegal_profiles')
          .update(payload)
          .eq('id', editingId);
        if (err) throw err;

        // Audit: role change
        if (prevProfile && prevProfile.role !== form.role) {
          const { email: actorEmail, id: actorId } = await getAdminEmail();
          await logAuditEvent({
            action_type: 'role_changed',
            actor_email: actorEmail,
            actor_id: actorId,
            target_type: 'paralegal_profile',
            target_id: editingId,
            target_label: form.full_name.trim(),
            description: `Role changed for ${form.full_name.trim()} from "${prevProfile.role}" to "${form.role}"`,
            metadata: {
              paralegal_email: form.email.trim().toLowerCase(),
              previous_role: prevProfile.role,
              new_role: form.role,
            },
          });
        }

        // Audit: permission changes
        if (prevProfile) {
          const permissionKeys: Array<keyof typeof payload & keyof ParalegalProfile> = [
            'can_view_cases', 'can_edit_cases', 'can_upload_documents',
            'can_send_messages', 'can_manage_invoices', 'can_log_hours',
            'can_view_billing', 'can_manage_clients',
          ];
          const changedPerms: string[] = [];
          permissionKeys.forEach((key) => {
            if (prevProfile[key] !== payload[key as keyof typeof payload]) {
              const label = key.replace('can_', '').replace(/_/g, ' ');
              changedPerms.push(`${label}: ${prevProfile[key] ? 'granted' : 'revoked'} → ${payload[key as keyof typeof payload] ? 'granted' : 'revoked'}`);
            }
          });
          if (changedPerms.length > 0) {
            const { email: actorEmail, id: actorId } = await getAdminEmail();
            await logAuditEvent({
              action_type: 'permission_changed',
              actor_email: actorEmail,
              actor_id: actorId,
              target_type: 'paralegal_profile',
              target_id: editingId,
              target_label: form.full_name.trim(),
              description: `Permissions updated for ${form.full_name.trim()}: ${changedPerms.join('; ')}`,
              metadata: {
                paralegal_email: form.email.trim().toLowerCase(),
                role: form.role,
                changes: changedPerms,
              },
            });
          }
        }
      } else {
        const { error: err } = await supabase
          .from('paralegal_profiles')
          .insert(payload);
        if (err) throw err;

        // Audit: new profile created
        const { email: actorEmail, id: actorId } = await getAdminEmail();
        await logAuditEvent({
          action_type: 'role_changed',
          actor_email: actorEmail,
          actor_id: actorId,
          target_type: 'paralegal_profile',
          target_label: form.full_name.trim(),
          description: `New paralegal profile created for ${form.full_name.trim()} with role "${form.role}"`,
          metadata: {
            paralegal_email: form.email.trim().toLowerCase(),
            role: form.role,
            status: form.status,
          },
        });
      }

      setShowForm(false);
      setEditingId(null);
      await fetchProfiles();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error: err } = await supabase
        .from('paralegal_profiles')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setDeleteConfirm(null);
      if (selectedProfile?.id === id) setSelectedProfile(null);
      await fetchProfiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete profile');
    }
  }

  // ─── Utilization for a profile ───────────────────────────────────────────────

  function getProfileUtilization(p: ParalegalProfile) {
    const u = Object.values(utilization).find((u) => u.paralegal_id === p.full_name);
    const hours = u?.total_hours ?? 0;
    const target = p.target_weekly_hours * 4; // approx monthly
    const pct = target > 0 ? Math.min(100, Math.round((hours / target) * 100)) : 0;
    return { hours, target, pct, caseCount: u?.case_count ?? 0 };
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Staff" value={activeCount} sub={`of ${profiles.length} total`} accent="#355E3B" />
        <StatCard label="Admin Roles" value={adminCount} sub="full-access accounts" />
        <StatCard label="Billable Hours" value={totalBillableHours.toFixed(1)} sub="logged this period" />
        <StatCard label="Avg Utilization" value={`${avgUtilization}%`} sub="vs. target hours" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
            className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="paralegal">Paralegal</option>
            <option value="read_only">Read-only</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
          </select>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Paralegal
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div className={`grid gap-6 ${selectedProfile ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>

        {/* Roster Table */}
        <div className={selectedProfile ? 'lg:col-span-3' : 'col-span-1'}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="border-b border-border bg-secondary/40 px-5 py-3 grid grid-cols-12 gap-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              <span className="col-span-4">Name / Title</span>
              <span className="col-span-2 hidden sm:block">Role</span>
              <span className="col-span-2 hidden md:block">Status</span>
              <span className="col-span-2 hidden lg:block">Utilization</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            {loading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="w-36 h-4 bg-muted/60 rounded animate-pulse mb-1.5" />
                      <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-6 bg-muted/40 rounded-full animate-pulse hidden sm:block" />
                    <div className="w-16 h-6 bg-muted/40 rounded-full animate-pulse hidden md:block" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No paralegals found</p>
                <p className="text-xs text-muted-foreground">
                  {profiles.length === 0 ? 'Add your first paralegal to get started.' : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((p) => {
                  const util = getProfileUtilization(p);
                  const roleConf = ROLE_CONFIG[p.role];
                  const statusConf = STATUS_CONFIG[p.status];
                  const isSelected = selectedProfile?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProfile(isSelected ? null : p); setActiveDetailTab('overview'); }}
                      className={`px-5 py-4 grid grid-cols-12 gap-3 items-center cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/30'}`}
                    >
                      {/* Name */}
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: p.status === 'active' ? '#355E3B' : '#9ca3af' }}
                        >
                          {getInitials(p.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.title ?? p.email}</p>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="col-span-2 hidden sm:block">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${roleConf.color}`}>
                          {roleConf.label}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 hidden md:flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dot}`} />
                        <span className={`text-xs font-medium ${statusConf.color}`}>{statusConf.label}</span>
                      </div>

                      {/* Utilization bar */}
                      <div className="col-span-2 hidden lg:block">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${util.pct}%`,
                                background: util.pct >= 90 ? '#ef4444' : util.pct >= 70 ? '#355E3B' : '#f59e0b',
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{util.pct}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{util.hours.toFixed(1)}h logged</p>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(p)}
                          className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center hover:border-accent/50 hover:text-foreground text-muted-foreground transition-all"
                          title="Edit profile"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(p.id)}
                          className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center hover:border-red-300 hover:text-red-600 text-muted-foreground transition-all"
                          title="Delete profile"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer count */}
            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} of {profiles.length} staff member{profiles.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={fetchProfiles}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedProfile && (() => {
          const p = selectedProfile;
          const util = getProfileUtilization(p);
          const roleConf = ROLE_CONFIG[p.role];
          const statusConf = STATUS_CONFIG[p.status];
          const permCount = PERMISSION_LABELS.filter((pl) => p[pl.key as keyof ParalegalProfile]).length;

          return (
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl overflow-hidden sticky top-4">
                {/* Header */}
                <div className="p-5 border-b border-border">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: p.status === 'active' ? '#355E3B' : '#9ca3af' }}
                      >
                        {getInitials(p.full_name)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-base">{p.full_name}</h3>
                        <p className="text-xs text-muted-foreground">{p.title ?? 'No title set'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProfile(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${roleConf.color}`}>
                      {roleConf.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      {statusConf.label}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground">
                      {permCount}/{PERMISSION_LABELS.length} permissions
                    </span>
                  </div>
                </div>

                {/* Detail Tabs */}
                <div className="flex border-b border-border">
                  {(['overview', 'permissions', 'utilization'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveDetailTab(tab)}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${activeDetailTab === tab ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab === 'overview' ? 'Profile' : tab === 'permissions' ? 'Access' : 'Hours'}
                    </button>
                  ))}
                </div>

                <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
                  {/* Overview Tab */}
                  {activeDetailTab === 'overview' && (
                    <>
                      <div className="space-y-3">
                        {[
                          { label: 'Email', value: p.email, icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' },
                          { label: 'Phone', value: p.phone ?? '—', icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.18 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.91 6.91l.38-.38a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
                          { label: 'Start Date', value: formatDate(p.start_date), icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
                          { label: 'Hourly Rate', value: p.hourly_rate != null ? `$${p.hourly_rate}/hr` : '—', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
                          { label: 'Target Hours/wk', value: `${p.target_weekly_hours}h`, icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2' },
                        ].map(({ label, value, icon }) => (
                          <div key={label} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d={icon} />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="text-sm text-foreground font-medium">{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {p.notes && (
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Notes</p>
                          <p className="text-sm text-foreground leading-relaxed">{p.notes}</p>
                        </div>
                      )}
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Profile created {formatDate(p.created_at)} · Last updated {formatDate(p.updated_at)}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Permissions Tab */}
                  {activeDetailTab === 'permissions' && (
                    <>
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{roleConf.label} Role</p>
                        <p className="text-xs text-muted-foreground">{roleConf.description}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {PERMISSION_LABELS.map(({ key, label, description }) => {
                          const granted = p[key as keyof ParalegalProfile] as boolean;
                          return (
                            <div key={key} className={`flex items-center gap-3 p-2.5 rounded-lg border ${granted ? 'border-primary/20 bg-primary/5' : 'border-border bg-card opacity-60'}`}>
                              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${granted ? 'bg-primary' : 'bg-muted/40 border border-border'}`}>
                                {granted && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground">{description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Utilization Tab */}
                  {activeDetailTab === 'utilization' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Hours Logged', value: util.hours.toFixed(1) + 'h' },
                          { label: 'Target (Monthly)', value: util.target.toFixed(0) + 'h' },
                          { label: 'Utilization', value: util.pct + '%' },
                          { label: 'Cases Worked', value: util.caseCount },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-secondary/30 rounded-xl p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{label}</p>
                            <p className="text-xl font-semibold text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Utilization bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-widest">Utilization Rate</p>
                          <span className={`text-xs font-semibold ${util.pct >= 90 ? 'text-red-600' : util.pct >= 70 ? 'text-emerald-700' : 'text-amber-600'}`}>
                            {util.pct >= 90 ? 'Over capacity' : util.pct >= 70 ? 'On track' : 'Under target'}
                          </span>
                        </div>
                        <div className="h-3 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${util.pct}%`,
                              background: util.pct >= 90 ? '#ef4444' : util.pct >= 70 ? '#355E3B' : '#f59e0b',
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-muted-foreground">0h</span>
                          <span className="text-xs text-muted-foreground">{util.target}h target</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Utilization calculated from retainer time logs. Target based on {p.target_weekly_hours}h/week × 4 weeks.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Edit button */}
                <div className="p-4 border-t border-border">
                  <button
                    onClick={() => openEdit(p)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Create / Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h2 className="font-serif text-xl text-foreground">{editingId ? 'Edit Paralegal Profile' : 'Add Paralegal'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingId ? 'Update profile details, role, and permissions' : 'Create a new paralegal profile and set access permissions'}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {saveError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{saveError}</div>
              )}

              {/* Basic Info */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'full_name', label: 'Full Name *', placeholder: 'Jane Smith', type: 'text' },
                    { key: 'email', label: 'Email Address *', placeholder: 'jane@firm.com', type: 'email' },
                    { key: 'phone', label: 'Phone', placeholder: '(504) 555-0100', type: 'tel' },
                    { key: 'title', label: 'Job Title', placeholder: 'Senior Paralegal', type: 'text' },
                    { key: 'start_date', label: 'Start Date', placeholder: '', type: 'date' },
                    { key: 'hourly_rate', label: 'Hourly Rate ($)', placeholder: '65.00', type: 'number' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
                      <input
                        type={type}
                        value={form[key as keyof FormState] as string}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-foreground mb-1.5">Target Weekly Hours</label>
                  <input
                    type="number"
                    value={form.target_weekly_hours}
                    onChange={(e) => setForm((prev) => ({ ...prev, target_weekly_hours: e.target.value }))}
                    placeholder="40"
                    min="1"
                    max="80"
                    className="w-full sm:w-40 px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
              </div>

              {/* Role & Status */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Role & Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Role</label>
                    <div className="space-y-2">
                      {(Object.entries(ROLE_CONFIG) as [ParalegalRole, typeof ROLE_CONFIG[ParalegalRole]][]).map(([roleKey, conf]) => (
                        <label key={roleKey} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.role === roleKey ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'}`}>
                          <input
                            type="radio"
                            name="role"
                            value={roleKey}
                            checked={form.role === roleKey}
                            onChange={() => applyRolePreset(roleKey)}
                            className="mt-0.5 accent-primary"
                          />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{conf.label}</p>
                            <p className="text-xs text-muted-foreground">{conf.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ParalegalStatus }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Selecting a role above auto-applies recommended permissions. You can customize below.
                    </p>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Permissions</p>
                  <button
                    type="button"
                    onClick={() => applyRolePreset(form.role)}
                    className="text-xs text-primary hover:underline"
                  >
                    Reset to role defaults
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERMISSION_LABELS.map(({ key, label, description }) => (
                    <PermissionToggle
                      key={key}
                      checked={form[key as keyof FormState] as boolean}
                      onChange={(v) => setForm((prev) => ({ ...prev, [key]: v }))}
                      label={label}
                      description={description}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Internal Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this paralegal's specialties, assignments, or status…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/40 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {saving ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Saving…
                  </>
                ) : editingId ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </div>
            <h3 className="font-serif text-lg text-foreground text-center mb-2">Remove Paralegal?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              This will permanently delete the profile and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/40 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
