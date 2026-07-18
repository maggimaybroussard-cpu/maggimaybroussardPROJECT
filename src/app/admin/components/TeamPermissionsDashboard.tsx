'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: TeamRole;
  permissions: string[];
  status: 'active' | 'pending' | 'suspended';
  created_at: string;
  last_login?: string;
}

type TeamRole = 'admin' | 'attorney' | 'paralegal' | 'legal_assistant' | 'billing' | 'receptionist' | 'readonly';

const ROLE_DEFINITIONS: Record<TeamRole, { label: string; color: string; description: string; defaultPermissions: string[] }> = {
  admin: {
    label: 'Admin',
    color: 'bg-red-100 text-red-700',
    description: 'Full access to all features and settings',
    defaultPermissions: ['all'],
  },
  attorney: {
    label: 'Attorney',
    color: 'bg-purple-100 text-purple-700',
    description: 'Full case management, billing, and client access',
    defaultPermissions: ['cases', 'clients', 'billing', 'documents', 'ai_secretary', 'contracts', 'reports'],
  },
  paralegal: {
    label: 'Paralegal',
    color: 'bg-blue-100 text-blue-700',
    description: 'Case support, document prep, research access',
    defaultPermissions: ['cases', 'clients', 'documents', 'ai_secretary', 'research', 'time_tracking'],
  },
  legal_assistant: {
    label: 'Legal Assistant',
    color: 'bg-cyan-100 text-cyan-700',
    description: 'Intake, scheduling, and client communication',
    defaultPermissions: ['intake', 'scheduling', 'clients', 'messages'],
  },
  billing: {
    label: 'Billing',
    color: 'bg-green-100 text-green-700',
    description: 'Invoices, payments, and financial reporting',
    defaultPermissions: ['billing', 'invoices', 'reports', 'clients'],
  },
  receptionist: {
    label: 'Receptionist',
    color: 'bg-yellow-100 text-yellow-700',
    description: 'Scheduling, intake, and basic client info',
    defaultPermissions: ['scheduling', 'intake', 'messages'],
  },
  readonly: {
    label: 'Read Only',
    color: 'bg-gray-100 text-gray-600',
    description: 'View-only access to assigned areas',
    defaultPermissions: ['readonly'],
  },
};

const ALL_PERMISSIONS = [
  { id: 'cases', label: 'Case Management', icon: '📁', group: 'Core' },
  { id: 'clients', label: 'Client Profiles', icon: '👤', group: 'Core' },
  { id: 'documents', label: 'Documents & Files', icon: '📄', group: 'Core' },
  { id: 'messages', label: 'Messaging Hub', icon: '💬', group: 'Core' },
  { id: 'intake', label: 'Intake Forms', icon: '📝', group: 'Operations' },
  { id: 'scheduling', label: 'Scheduling', icon: '📅', group: 'Operations' },
  { id: 'time_tracking', label: 'Time Tracking', icon: '⏱️', group: 'Operations' },
  { id: 'billing', label: 'Billing & Payments', icon: '💰', group: 'Finance' },
  { id: 'invoices', label: 'Invoice Management', icon: '🧾', group: 'Finance' },
  { id: 'reports', label: 'Reports & Analytics', icon: '📊', group: 'Finance' },
  { id: 'ai_secretary', label: 'AI Secretary (Lexi)', icon: '🤖', group: 'AI Tools' },
  { id: 'research', label: 'Legal Research', icon: '🔍', group: 'AI Tools' },
  { id: 'contracts', label: 'Contracts & Templates', icon: '📋', group: 'Legal' },
  { id: 'legislation', label: 'Legislation Access', icon: '⚖️', group: 'Legal' },
  { id: 'audit', label: 'Audit Trail', icon: '🔒', group: 'Admin' },
  { id: 'team_admin', label: 'Team Administration', icon: '👥', group: 'Admin' },
  { id: 'settings', label: 'System Settings', icon: '⚙️', group: 'Admin' },
  { id: 'readonly', label: 'Read Only Mode', icon: '👁️', group: 'Access' },
];

const PERMISSION_GROUPS = ['Core', 'Operations', 'Finance', 'AI Tools', 'Legal', 'Admin', 'Access'];

export default function TeamPermissionsDashboard() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'paralegal' as TeamRole });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  const supabase = createClient();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Table may not exist yet — show empty state
        setMembers([]);
      } else {
        setMembers(data || []);
      }
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      setInviteError('Email and full name are required.');
      return;
    }
    setInviteLoading(true);
    setInviteError('');
    try {
      const roleDef = ROLE_DEFINITIONS[inviteForm.role];
      const { error } = await supabase.from('team_members').insert({
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        permissions: roleDef.defaultPermissions,
        status: 'pending',
      });
      if (error) throw error;

      // Send invite email
      await fetch('/api/admin/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.full_name,
          role: roleDef.label,
          type: 'team_invite',
        }),
      });

      setInviteSuccess(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: '', full_name: '', role: 'paralegal' });
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
        loadMembers();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to invite team member.';
      setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    setSaveLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: editingMember.role, permissions: editingMember.permissions })
        .eq('id', editingMember.id);
      if (error) throw error;
      setSaveSuccess('Permissions saved successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
      loadMembers();
    } catch {
      // silent
    } finally {
      setSaveLoading(false);
    }
  };

  const handleStatusChange = async (memberId: string, status: 'active' | 'suspended') => {
    await supabase.from('team_members').update({ status }).eq('id', memberId);
    loadMembers();
  };

  const togglePermission = (permId: string) => {
    if (!editingMember) return;
    const current = editingMember.permissions || [];
    const updated = current.includes(permId)
      ? current.filter((p) => p !== permId)
      : [...current, permId];
    setEditingMember({ ...editingMember, permissions: updated });
  };

  const applyRoleDefaults = (role: TeamRole) => {
    if (!editingMember) return;
    setEditingMember({
      ...editingMember,
      role,
      permissions: ROLE_DEFINITIONS[role].defaultPermissions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            👥 Team Administration
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage team members, roles, and access permissions</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all flex items-center gap-2"
        >
          <span>+</span> Invite Team Member
        </button>
      </div>

      {/* Role Legend */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3">Role Definitions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(ROLE_DEFINITIONS) as [TeamRole, typeof ROLE_DEFINITIONS[TeamRole]][]).map(([role, def]) => (
            <div key={role} className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${def.color}`}>{def.label}</span>
              <p className="text-xs text-muted-foreground leading-snug">{def.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Team Members ({members.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading team members...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm mb-4">No team members yet. Invite your first team member to get started.</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all"
            >
              + Invite Team Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Permissions</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{member.full_name}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_DEFINITIONS[member.role]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_DEFINITIONS[member.role]?.label || member.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        member.status === 'active' ? 'bg-green-100 text-green-700' :
                        member.status === 'pending'? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(member.permissions || []).slice(0, 3).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded text-xs">{p}</span>
                        ))}
                        {(member.permissions || []).length > 3 && (
                          <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-xs">+{member.permissions.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingMember(member)}
                          className="px-3 py-1.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded-lg text-xs font-semibold hover:bg-[#1B2A4A]/20 transition-all"
                        >
                          Edit
                        </button>
                        {member.status === 'active' ? (
                          <button
                            onClick={() => handleStatusChange(member.id, 'suspended')}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(member.id, 'active')}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl text-[#1B2A4A]">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="jane@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as TeamRole })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                >
                  {(Object.entries(ROLE_DEFINITIONS) as [TeamRole, typeof ROLE_DEFINITIONS[TeamRole]][]).map(([role, def]) => (
                    <option key={role} value={role}>{def.label} — {def.description}</option>
                  ))}
                </select>
              </div>

              {/* Role preview */}
              <div className="bg-secondary/40 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Default Permissions for {ROLE_DEFINITIONS[inviteForm.role].label}:</p>
                <div className="flex flex-wrap gap-1">
                  {ROLE_DEFINITIONS[inviteForm.role].defaultPermissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded text-xs">{p}</span>
                  ))}
                </div>
              </div>

              {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}
              {inviteSuccess && <p className="text-green-600 text-sm font-medium">{inviteSuccess}</p>}

              <button
                onClick={handleInvite}
                disabled={inviteLoading}
                className="w-full py-3 bg-[#1B2A4A] text-white rounded-xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all disabled:opacity-60"
              >
                {inviteLoading ? 'Sending Invitation...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif text-xl text-[#1B2A4A]">Edit Permissions</h3>
                <p className="text-sm text-muted-foreground">{editingMember.full_name} · {editingMember.email}</p>
              </div>
              <button onClick={() => setEditingMember(null)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Role Selector */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Role</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(ROLE_DEFINITIONS) as [TeamRole, typeof ROLE_DEFINITIONS[TeamRole]][]).map(([role, def]) => (
                  <button
                    key={role}
                    onClick={() => applyRoleDefaults(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      editingMember.role === role
                        ? `${def.color} border-current`
                        : 'bg-secondary/40 text-muted-foreground border-border hover:border-current'
                    }`}
                  >
                    {def.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions Grid */}
            <div className="space-y-4 mb-5">
              {PERMISSION_GROUPS.map((group) => {
                const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group);
                return (
                  <div key={group}>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {groupPerms.map((perm) => {
                        const isChecked = editingMember.permissions?.includes(perm.id) || editingMember.permissions?.includes('all');
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked ? 'bg-[#1B2A4A]/10 border-[#1B2A4A]/30' : 'bg-secondary/30 border-border hover:border-[#1B2A4A]/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.id)}
                              className="rounded border-border text-[#1B2A4A] focus:ring-[#1B2A4A]/30"
                            />
                            <span className="text-sm">{perm.icon}</span>
                            <span className="text-xs font-medium text-foreground">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {saveSuccess && <p className="text-green-600 text-sm font-medium mb-3">{saveSuccess}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSavePermissions}
                disabled={saveLoading}
                className="flex-1 py-3 bg-[#1B2A4A] text-white rounded-xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all disabled:opacity-60"
              >
                {saveLoading ? 'Saving...' : 'Save Permissions'}
              </button>
              <button
                onClick={() => setEditingMember(null)}
                className="px-5 py-3 bg-secondary text-foreground rounded-xl font-semibold text-sm hover:bg-secondary/80 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
