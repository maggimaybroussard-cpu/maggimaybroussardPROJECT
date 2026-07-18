'use client';

import React, { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'paralegal' | 'billing' | 'viewer';
type PermissionKey =
  | 'view_cases' | 'edit_cases' | 'delete_cases'
  | 'view_clients'| 'edit_clients' | 'invite_clients' |'view_invoices'| 'create_invoices' | 'send_invoices' | 'void_invoices' |'view_documents' | 'upload_documents' | 'delete_documents'
  | 'view_analytics' | 'export_reports'
  | 'manage_team'| 'manage_integrations' | 'manage_billing' |'use_lexi'| 'lexi_research' | 'lexi_drafting' |'view_audit_log' | 'send_sms' | 'send_emails';

interface Permission {
  key: PermissionKey;
  label: string;
  category: string;
  description: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  status: 'active' | 'invited' | 'suspended';
  lastActive: string;
  permissions: PermissionKey[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; description: string }> = {
  owner: { label: 'Owner', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', description: 'Full access to everything' },
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', description: 'Manage team, cases, billing' },
  paralegal: { label: 'Paralegal', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', description: 'Cases, documents, Lexi' },
  billing: { label: 'Billing', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', description: 'Invoices and payments only' },
  viewer: { label: 'Viewer', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', description: 'Read-only access' },
};

const ALL_PERMISSIONS: Permission[] = [
  // Cases
  { key: 'view_cases', label: 'View Cases', category: 'Cases', description: 'See all case files and matter details' },
  { key: 'edit_cases', label: 'Edit Cases', category: 'Cases', description: 'Update case status, notes, and details' },
  { key: 'delete_cases', label: 'Delete Cases', category: 'Cases', description: 'Permanently remove case records' },
  // Clients
  { key: 'view_clients', label: 'View Clients', category: 'Clients', description: 'Access client profiles and contact info' },
  { key: 'edit_clients', label: 'Edit Clients', category: 'Clients', description: 'Update client records and profiles' },
  { key: 'invite_clients', label: 'Invite Clients', category: 'Clients', description: 'Send portal invitations to clients' },
  // Invoices
  { key: 'view_invoices', label: 'View Invoices', category: 'Billing', description: 'See all invoices and payment history' },
  { key: 'create_invoices', label: 'Create Invoices', category: 'Billing', description: 'Generate new invoices for clients' },
  { key: 'send_invoices', label: 'Send Invoices', category: 'Billing', description: 'Email invoices and payment links' },
  { key: 'void_invoices', label: 'Void Invoices', category: 'Billing', description: 'Cancel or void existing invoices' },
  // Documents
  { key: 'view_documents', label: 'View Documents', category: 'Documents', description: 'Access case documents and files' },
  { key: 'upload_documents', label: 'Upload Documents', category: 'Documents', description: 'Add new files to case folders' },
  { key: 'delete_documents', label: 'Delete Documents', category: 'Documents', description: 'Remove documents from the system' },
  // Analytics
  { key: 'view_analytics', label: 'View Analytics', category: 'Analytics', description: 'See dashboards and KPI reports' },
  { key: 'export_reports', label: 'Export Reports', category: 'Analytics', description: 'Download CSV and PDF reports' },
  // Admin
  { key: 'manage_team', label: 'Manage Team', category: 'Admin', description: 'Invite, edit, and remove team members' },
  { key: 'manage_integrations', label: 'Manage Integrations', category: 'Admin', description: 'Configure Clio, Stripe, Notion, etc.' },
  { key: 'manage_billing', label: 'Manage Billing', category: 'Admin', description: 'Update subscription and payment methods' },
  // Lexi
  { key: 'use_lexi', label: 'Use Lexi', category: 'Lexi AI', description: 'Access the Lexi AI assistant' },
  { key: 'lexi_research', label: 'Legal Research', category: 'Lexi AI', description: 'Run case law and statute research' },
  { key: 'lexi_drafting', label: 'Document Drafting', category: 'Lexi AI', description: 'Draft briefs, motions, and letters' },
  // Communications
  { key: 'view_audit_log', label: 'View Audit Log', category: 'Communications', description: 'See system activity and audit trail' },
  { key: 'send_sms', label: 'Send SMS', category: 'Communications', description: 'Send text messages to clients' },
  { key: 'send_emails', label: 'Send Emails', category: 'Communications', description: 'Send emails and notifications' },
];

const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
  owner: ALL_PERMISSIONS.map((p) => p.key),
  admin: [
    'view_cases', 'edit_cases', 'view_clients', 'edit_clients', 'invite_clients',
    'view_invoices', 'create_invoices', 'send_invoices', 'void_invoices',
    'view_documents', 'upload_documents', 'delete_documents',
    'view_analytics', 'export_reports', 'manage_team',
    'use_lexi', 'lexi_research', 'lexi_drafting',
    'view_audit_log', 'send_sms', 'send_emails',
  ],
  paralegal: [
    'view_cases', 'edit_cases', 'view_clients', 'edit_clients',
    'view_documents', 'upload_documents',
    'view_analytics',
    'use_lexi', 'lexi_research', 'lexi_drafting',
    'send_emails',
  ],
  billing: [
    'view_clients', 'view_invoices', 'create_invoices', 'send_invoices', 'void_invoices',
    'view_analytics', 'export_reports',
    'send_emails',
  ],
  viewer: ['view_cases', 'view_clients', 'view_invoices', 'view_documents', 'view_analytics'],
};

const MOCK_TEAM: TeamMember[] = [
  {
    id: '1',
    name: 'Maggi May Broussard',
    email: 'maggi@maggimaybroussard.com',
    role: 'owner',
    avatar: 'MM',
    status: 'active',
    lastActive: 'Now',
    permissions: ROLE_DEFAULT_PERMISSIONS.owner,
  },
  {
    id: '2',
    name: 'Sarah Thibodaux',
    email: 'sarah@maggimaybroussard.com',
    role: 'paralegal',
    avatar: 'ST',
    status: 'active',
    lastActive: '2 hours ago',
    permissions: ROLE_DEFAULT_PERMISSIONS.paralegal,
  },
  {
    id: '3',
    name: 'Jordan Fontenot',
    email: 'jordan@maggimaybroussard.com',
    role: 'billing',
    avatar: 'JF',
    status: 'active',
    lastActive: 'Yesterday',
    permissions: ROLE_DEFAULT_PERMISSIONS.billing,
  },
  {
    id: '4',
    name: 'Alex Broussard',
    email: 'alex@maggimaybroussard.com',
    role: 'viewer',
    avatar: 'AB',
    status: 'invited',
    lastActive: 'Never',
    permissions: ROLE_DEFAULT_PERMISSIONS.viewer,
  },
];

const PERMISSION_CATEGORIES = ['Cases', 'Clients', 'Billing', 'Documents', 'Analytics', 'Admin', 'Lexi AI', 'Communications'];

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (name: string, email: string, role: Role) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('paralegal');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="font-serif text-lg text-foreground">Invite Team Member</h3>
            <p className="text-xs text-muted-foreground mt-0.5">They'll receive an email to set up their account</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@yourfirm.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_CONFIG) as Role[]).filter((r) => r !== 'owner').map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    role === r ? `${ROLE_CONFIG[r].bg} border-current` : 'border-border hover:border-accent/40'
                  }`}
                >
                  <span className={`text-xs font-semibold ${role === r ? ROLE_CONFIG[r].color : 'text-foreground'}`}>{ROLE_CONFIG[r].label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{ROLE_CONFIG[r].description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
              Cancel
            </button>
            <button
              onClick={() => { if (name && email) { onInvite(name, email, role); onClose(); } }}
              disabled={!name || !email}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#355E3B' }}
            >
              Send Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Permission Editor ─────────────────────────────────────────────────────────

function PermissionEditor({ member, onSave, onClose }: {
  member: TeamMember;
  onSave: (id: string, permissions: PermissionKey[], role: Role) => void;
  onClose: () => void;
}) {
  const [permissions, setPermissions] = useState<PermissionKey[]>(member.permissions);
  const [role, setRole] = useState<Role>(member.role);

  const toggle = (key: PermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const applyRoleDefaults = (r: Role) => {
    setRole(r);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[r]);
  };

  const categoryPerms = (cat: string) => ALL_PERMISSIONS.filter((p) => p.category === cat);
  const categoryChecked = (cat: string) => categoryPerms(cat).every((p) => permissions.includes(p.key));
  const toggleCategory = (cat: string) => {
    const keys = categoryPerms(cat).map((p) => p.key);
    if (categoryChecked(cat)) {
      setPermissions((prev) => prev.filter((p) => !keys.includes(p)));
    } else {
      setPermissions((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#355E3B' }}>
              {member.avatar}
            </div>
            <div>
              <h3 className="font-serif text-lg text-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Role selector */}
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Role Template</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLE_CONFIG) as Role[]).filter((r) => r !== 'owner').map((r) => (
              <button
                key={r}
                onClick={() => applyRoleDefaults(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  role === r ? `${ROLE_CONFIG[r].bg} ${ROLE_CONFIG[r].color}` : 'border-border text-muted-foreground hover:border-accent/40'
                }`}
              >
                {ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Selecting a role applies its default permissions. You can then customize individually below.</p>
        </div>

        {/* Permissions grid */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="flex flex-col gap-5">
            {PERMISSION_CATEGORIES.map((cat) => {
              const catPerms = categoryPerms(cat);
              if (!catPerms.length) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        categoryChecked(cat) ? 'border-transparent' : 'border-border bg-transparent'
                      }`}
                      style={categoryChecked(cat) ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                    >
                      {categoryChecked(cat) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                    <span className="text-xs font-bold text-foreground uppercase tracking-widest">{cat}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                    {catPerms.map((perm) => {
                      const checked = permissions.includes(perm.key);
                      return (
                        <button
                          key={perm.key}
                          onClick={() => toggle(perm.key)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                            checked ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-accent/30'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              checked ? 'border-transparent' : 'border-border bg-transparent'
                            }`}
                            style={checked ? { background: '#355E3B', borderColor: '#355E3B' } : {}}
                          >
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{perm.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{perm.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border shrink-0">
          <span className="text-xs text-muted-foreground">{permissions.length} of {ALL_PERMISSIONS.length} permissions enabled</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
              Cancel
            </button>
            <button
              onClick={() => { onSave(member.id, permissions, role); onClose(); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#355E3B' }}
            >
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TeamPermissionsAdmin() {
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [activeView, setActiveView] = useState<'members' | 'roles' | 'activity'>('members');
  const [savedMsg, setSavedMsg] = useState('');

  const handleInvite = (name: string, email: string, role: Role) => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name,
      email,
      role,
      avatar: name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      status: 'invited',
      lastActive: 'Never',
      permissions: ROLE_DEFAULT_PERMISSIONS[role],
    };
    setTeam((prev) => [...prev, newMember]);
    setSavedMsg(`Invitation sent to ${email}`);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleSavePermissions = (id: string, permissions: PermissionKey[], role: Role) => {
    setTeam((prev) => prev.map((m) => m.id === id ? { ...m, permissions, role } : m));
    setSavedMsg('Permissions saved successfully');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleSuspend = (id: string) => {
    setTeam((prev) => prev.map((m) => m.id === id ? { ...m, status: m.status === 'suspended' ? 'active' : 'suspended' } : m));
  };

  const handleRemove = (id: string) => {
    setTeam((prev) => prev.filter((m) => m.id !== id));
  };

  const activeCount = team.filter((m) => m.status === 'active').length;
  const invitedCount = team.filter((m) => m.status === 'invited').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-foreground">Team & Permissions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage who has access to what across your practice</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 shrink-0"
          style={{ background: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite Member
        </button>
      </div>

      {/* Save message */}
      {savedMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {savedMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: team.length, icon: '👥', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Active', value: activeCount, icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Pending Invite', value: invitedCount, icon: '📧', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Roles Defined', value: Object.keys(ROLE_CONFIG).length, icon: '🔑', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{stat.icon}</span>
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl w-fit">
        {(['members', 'roles', 'activity'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeView === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'members' ? 'Team Members' : v === 'roles' ? 'Role Definitions' : 'Activity Log'}
          </button>
        ))}
      </div>

      {/* Members view */}
      {activeView === 'members' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/30 border-b border-border">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Role</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Permissions</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Active</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member, i) => (
                  <tr key={member.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: member.role === 'owner' ? '#b45309' : '#355E3B' }}
                        >
                          {member.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_CONFIG[member.role].bg} ${ROLE_CONFIG[member.role].color}`}>
                        {ROLE_CONFIG[member.role].label}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-secondary/60 rounded-full h-1.5 max-w-[80px]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(member.permissions.length / ALL_PERMISSIONS.length) * 100}%`, background: '#355E3B' }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{member.permissions.length}/{ALL_PERMISSIONS.length}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs text-muted-foreground">{member.lastActive}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        member.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        member.status === 'invited'? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          member.status === 'active' ? 'bg-emerald-500' :
                          member.status === 'invited'? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                        }`} />
                        {member.status === 'active' ? 'Active' : member.status === 'invited' ? 'Invited' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {member.role !== 'owner' && (
                          <>
                            <button
                              onClick={() => setEditingMember(member)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Permissions
                            </button>
                            <button
                              onClick={() => handleSuspend(member.id)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                member.status === 'suspended' ?'border-emerald-200 text-emerald-700 hover:bg-emerald-50' :'border-amber-200 text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              {member.status === 'suspended' ? 'Restore' : 'Suspend'}
                            </button>
                            <button
                              onClick={() => handleRemove(member.id)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                              title="Remove member"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </>
                        )}
                        {member.role === 'owner' && (
                          <span className="text-xs text-muted-foreground italic">Owner — full access</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles view */}
      {activeView === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, config]) => {
            const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role];
            const memberCount = team.filter((m) => m.role === role).length;
            return (
              <div key={role} className={`rounded-2xl border p-5 ${config.bg}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground bg-white/60 px-2 py-1 rounded-full border border-white/40">
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-white/40 rounded-full h-1.5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(defaultPerms.length / ALL_PERMISSIONS.length) * 100}%`, background: '#355E3B' }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{defaultPerms.length} perms</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PERMISSION_CATEGORIES.map((cat) => {
                    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === cat);
                    const enabled = catPerms.filter((p) => defaultPerms.includes(p.key)).length;
                    if (!enabled) return null;
                    return (
                      <span key={cat} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/50 text-foreground/70 border border-white/40">
                        {cat} ({enabled})
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity view */}
      {activeView === 'activity' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Recent Permission Changes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Audit log of team access modifications</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { actor: 'Maggi May Broussard', action: 'Updated permissions for Sarah Thibodaux', detail: 'Added: lexi_drafting, lexi_research', time: '2 hours ago', icon: '🔑' },
              { actor: 'Maggi May Broussard', action: 'Invited Jordan Fontenot', detail: 'Role: Billing', time: 'Yesterday', icon: '📧' },
              { actor: 'Maggi May Broussard', action: 'Changed role for Alex Broussard', detail: 'Admin → Viewer', time: '3 days ago', icon: '🔄' },
              { actor: 'System', action: 'Alex Broussard accepted invitation', detail: 'Status: Active', time: '3 days ago', icon: '✅' },
              { actor: 'Maggi May Broussard', action: 'Suspended temp contractor', detail: 'Status: Suspended', time: '1 week ago', icon: '⏸️' },
            ].map((entry, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <span className="text-lg shrink-0 mt-0.5">{entry.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{entry.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{entry.actor} · {entry.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}
      {editingMember && (
        <PermissionEditor
          member={editingMember}
          onSave={handleSavePermissions}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
