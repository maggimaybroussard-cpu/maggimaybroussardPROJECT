'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = 'client_meeting' | 'research_task' | 'filing_deadline' | 'admin_note' | 'court_date' | 'document_review';
type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface CaseAction {
  id: string;
  case_id: string;
  case_name: string;
  action_type: ActionType;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: Priority;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_role: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  sequence_order: number;
}

interface CaseGroup {
  case_id: string;
  case_name: string;
  actions: CaseAction[];
}

// ── Static mock data (used when DB table not yet available) ───────────────────

const MOCK_ACTIONS: CaseAction[] = [
  {
    id: '1', case_id: 'c1', case_name: 'Johnson v. Meridian Corp', action_type: 'client_meeting',
    title: 'Initial Consultation & Case Review', description: 'Review all case documents with client, discuss strategy and timeline expectations.',
    status: 'completed', priority: 'high', due_date: '2026-06-10T10:00:00Z', completed_at: '2026-06-10T11:30:00Z',
    assigned_to: 'Atty. Broussard', assigned_role: 'Attorney', created_by: 'admin', created_at: '2026-06-08T09:00:00Z', updated_at: '2026-06-10T11:30:00Z', sequence_order: 1,
  },
  {
    id: '2', case_id: 'c1', case_name: 'Johnson v. Meridian Corp', action_type: 'research_task',
    title: 'Precedent Research — Employment Discrimination', description: 'Research relevant case law for Title VII claims in the 5th Circuit. Focus on recent 2023–2025 rulings.',
    status: 'completed', priority: 'high', due_date: '2026-06-14T17:00:00Z', completed_at: '2026-06-13T16:00:00Z',
    assigned_to: 'Sarah M.', assigned_role: 'Paralegal', created_by: 'admin', created_at: '2026-06-10T12:00:00Z', updated_at: '2026-06-13T16:00:00Z', sequence_order: 2,
  },
  {
    id: '3', case_id: 'c1', case_name: 'Johnson v. Meridian Corp', action_type: 'filing_deadline',
    title: 'File Motion to Compel Discovery', description: 'Defendant has not responded to discovery requests. File motion with supporting brief.',
    status: 'in_progress', priority: 'urgent', due_date: '2026-06-20T17:00:00Z', completed_at: null,
    assigned_to: 'Atty. Broussard', assigned_role: 'Attorney', created_by: 'admin', created_at: '2026-06-14T09:00:00Z', updated_at: '2026-06-17T10:00:00Z', sequence_order: 3,
  },
  {
    id: '4', case_id: 'c1', case_name: 'Johnson v. Meridian Corp', action_type: 'admin_note',
    title: 'Client Follow-Up — Settlement Discussion', description: 'Client called re: settlement offer from opposing counsel. Advised to decline current offer. Schedule follow-up meeting.',
    status: 'pending', priority: 'medium', due_date: '2026-06-22T10:00:00Z', completed_at: null,
    assigned_to: 'Atty. Broussard', assigned_role: 'Attorney', created_by: 'admin', created_at: '2026-06-17T14:00:00Z', updated_at: '2026-06-17T14:00:00Z', sequence_order: 4,
  },
  {
    id: '5', case_id: 'c2', case_name: 'Estate of Williams — Probate', action_type: 'client_meeting',
    title: 'Beneficiary Meeting — Asset Distribution Review', description: 'Meet with all beneficiaries to review proposed asset distribution plan and address objections.',
    status: 'completed', priority: 'high', due_date: '2026-06-12T14:00:00Z', completed_at: '2026-06-12T15:45:00Z',
    assigned_to: 'Atty. Broussard', assigned_role: 'Attorney', created_by: 'admin', created_at: '2026-06-09T10:00:00Z', updated_at: '2026-06-12T15:45:00Z', sequence_order: 1,
  },
  {
    id: '6', case_id: 'c2', case_name: 'Estate of Williams — Probate', action_type: 'filing_deadline',
    title: 'File Inventory & Appraisement', description: 'Submit complete inventory of estate assets with certified appraisals to the probate court.',
    status: 'overdue', priority: 'urgent', due_date: '2026-06-15T17:00:00Z', completed_at: null,
    assigned_to: 'Marcus T.', assigned_role: 'Paralegal', created_by: 'admin', created_at: '2026-06-09T10:00:00Z', updated_at: '2026-06-15T18:00:00Z', sequence_order: 2,
  },
  {
    id: '7', case_id: 'c2', case_name: 'Estate of Williams — Probate', action_type: 'research_task',
    title: 'Review Tax Implications — Estate Transfer', description: 'Analyze federal and state tax obligations for estate transfer. Coordinate with CPA if needed.',
    status: 'in_progress', priority: 'high', due_date: '2026-06-25T17:00:00Z', completed_at: null,
    assigned_to: 'Sarah M.', assigned_role: 'Paralegal', created_by: 'admin', created_at: '2026-06-13T09:00:00Z', updated_at: '2026-06-17T11:00:00Z', sequence_order: 3,
  },
  {
    id: '8', case_id: 'c3', case_name: 'Rivera Business Formation', action_type: 'admin_note',
    title: 'LLC Operating Agreement — Draft Sent', description: 'Sent initial draft of operating agreement to client for review. Awaiting redlines and approval.',
    status: 'pending', priority: 'medium', due_date: '2026-06-21T17:00:00Z', completed_at: null,
    assigned_to: 'Atty. Broussard', assigned_role: 'Attorney', created_by: 'admin', created_at: '2026-06-16T10:00:00Z', updated_at: '2026-06-16T10:00:00Z', sequence_order: 1,
  },
  {
    id: '9', case_id: 'c3', case_name: 'Rivera Business Formation', action_type: 'filing_deadline',
    title: 'File Articles of Organization — Secretary of State', description: 'Submit LLC formation documents with filing fee. Expedited processing requested.',
    status: 'pending', priority: 'high', due_date: '2026-06-28T17:00:00Z', completed_at: null,
    assigned_to: 'Marcus T.', assigned_role: 'Paralegal', created_by: 'admin', created_at: '2026-06-16T10:00:00Z', updated_at: '2026-06-16T10:00:00Z', sequence_order: 2,
  },
];

// ── Config maps ───────────────────────────────────────────────────────────────

const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; color: string; dotColor: string; iconBg: string }> = {
  client_meeting: { label: 'Client Meeting', color: 'text-blue-700 bg-blue-50 border-blue-200', dotColor: 'bg-blue-500', iconBg: 'bg-blue-100' },
  research_task: { label: 'Research Task', color: 'text-violet-700 bg-violet-50 border-violet-200', dotColor: 'bg-violet-500', iconBg: 'bg-violet-100' },
  filing_deadline: { label: 'Filing Deadline', color: 'text-rose-700 bg-rose-50 border-rose-200', dotColor: 'bg-rose-500', iconBg: 'bg-rose-100' },
  admin_note: { label: 'Admin Note', color: 'text-amber-700 bg-amber-50 border-amber-200', dotColor: 'bg-amber-500', iconBg: 'bg-amber-100' },
  court_date: { label: 'Court Date', color: 'text-slate-700 bg-slate-100 border-slate-200', dotColor: 'bg-slate-600', iconBg: 'bg-slate-100' },
  document_review: { label: 'Document Review', color: 'text-teal-700 bg-teal-50 border-teal-200', dotColor: 'bg-teal-500', iconBg: 'bg-teal-100' },
};

const STATUS_CONFIG: Record<ActionStatus, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pending', color: 'text-slate-600 bg-slate-100 border-slate-200', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-100 border-gray-200', dot: 'bg-gray-400' },
  overdue: { label: 'Overdue', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-slate-500' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600 font-semibold' },
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function MeetingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function ResearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function FilingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function CourtIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function ActionTypeIcon({ type }: { type: ActionType }) {
  if (type === 'client_meeting') return <MeetingIcon />;
  if (type === 'research_task') return <ResearchIcon />;
  if (type === 'filing_deadline') return <FilingIcon />;
  if (type === 'admin_note') return <NoteIcon />;
  if (type === 'court_date') return <CourtIcon />;
  return <NoteIcon />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isOverdue(action: CaseAction): boolean {
  if (action.status === 'completed' || action.status === 'cancelled') return false;
  if (!action.due_date) return false;
  return new Date(action.due_date) < new Date();
}

function isDueSoon(action: CaseAction): boolean {
  if (action.status === 'completed' || action.status === 'cancelled') return false;
  if (!action.due_date) return false;
  const diff = new Date(action.due_date).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────

interface ActionModalProps {
  action: Partial<CaseAction> | null;
  cases: { id: string; name: string }[];
  onClose: () => void;
  onSave: (action: Partial<CaseAction>) => void;
}

function ActionModal({ action, cases, onClose, onSave }: ActionModalProps) {
  const [form, setForm] = useState<Partial<CaseAction>>(action || {
    action_type: 'client_meeting', status: 'pending', priority: 'medium', sequence_order: 1,
  });

  const set = (key: keyof CaseAction, val: string | number) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground text-base">{action?.id ? 'Edit Action' : 'Add Case Action'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Case */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Case</label>
            <select value={form.case_id || ''} onChange={e => { set('case_id', e.target.value); set('case_name', cases.find(c => c.id === e.target.value)?.name || ''); }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select case…</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Action Title</label>
            <input value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. File Motion to Compel Discovery"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Action Type</label>
              <select value={form.action_type || 'client_meeting'} onChange={e => set('action_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(Object.keys(ACTION_TYPE_CONFIG) as ActionType[]).map(t => (
                  <option key={t} value={t}>{ACTION_TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
              <select value={form.priority || 'medium'} onChange={e => set('priority', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Status + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select value={form.status || 'pending'} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(Object.keys(STATUS_CONFIG) as ActionStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Due Date</label>
              <input type="datetime-local" value={form.due_date ? form.due_date.slice(0, 16) : ''} onChange={e => set('due_date', e.target.value + ':00Z')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          {/* Assigned to + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assigned To</label>
              <input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="Name"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role</label>
              <select value={form.assigned_role || ''} onChange={e => set('assigned_role', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select role…</option>
                <option value="Attorney">Attorney</option>
                <option value="Paralegal">Paralegal</option>
                <option value="Legal Secretary">Legal Secretary</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
          {/* Sequence order */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sequence Order</label>
            <input type="number" min={1} value={form.sequence_order || 1} onChange={e => set('sequence_order', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes / Description</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Additional context, instructions, or notes…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: '#355E3B' }}>
            {action?.id ? 'Save Changes' : 'Add Action'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Action Card ──────────────────────────────────────────────────────

interface ActionCardProps {
  action: CaseAction;
  index: number;
  isLast: boolean;
  onEdit: (a: CaseAction) => void;
  onStatusChange: (id: string, status: ActionStatus) => void;
}

function ActionCard({ action, index, isLast, onEdit, onStatusChange }: ActionCardProps) {
  const typeConf = ACTION_TYPE_CONFIG[action.action_type];
  const statusConf = STATUS_CONFIG[action.status];
  const priorityConf = PRIORITY_CONFIG[action.priority];
  const overdue = isOverdue(action);
  const dueSoon = isDueSoon(action);

  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 36 }}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 shrink-0 ${
          action.status === 'completed'
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : action.status === 'overdue'|| overdue ?'bg-red-500 border-red-500 text-white'
            : action.status === 'in_progress' ?'border-blue-400 bg-blue-50 text-blue-600' :'border-border bg-card text-muted-foreground'
        }`}>
          {action.status === 'completed' ? (
            <CheckIcon />
          ) : (
            <span className="text-xs font-bold">{index + 1}</span>
          )}
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 24 }} />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-5 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${
        overdue && action.status !== 'completed' ? 'border-red-200' : dueSoon ? 'border-amber-200' : 'border-border'
      }`}>
        {/* Card header */}
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeConf.iconBg}`}>
              <span className={typeConf.color.split(' ')[0]}><ActionTypeIcon type={action.action_type} /></span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeConf.color}`}>
                  {typeConf.label}
                </span>
                {(overdue && action.status !== 'completed') && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">⚠ Overdue</span>
                )}
                {dueSoon && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Due Soon</span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-foreground leading-snug">{action.title}</h4>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={action.status}
              onChange={e => onStatusChange(action.id, e.target.value as ActionStatus)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${statusConf.color}`}
            >
              {(Object.keys(STATUS_CONFIG) as ActionStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <button onClick={() => onEdit(action)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        {action.description && (
          <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">{action.description}</p>
        )}

        {/* Footer meta */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-border/60 bg-secondary/20 rounded-b-xl">
          {action.assigned_to && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserIcon />
              <span className="font-medium text-foreground">{action.assigned_to}</span>
              {action.assigned_role && <span className="text-muted-foreground">· {action.assigned_role}</span>}
            </div>
          )}
          {action.due_date && (
            <div className={`flex items-center gap-1.5 text-xs ${overdue && action.status !== 'completed' ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
              <ClockIcon />
              <span>{action.status === 'completed' && action.completed_at ? `Completed ${formatDate(action.completed_at)}` : `Due ${formatDateTime(action.due_date)}`}</span>
            </div>
          )}
          <div className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${priorityConf.color}`}>
            {priorityConf.label} Priority
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseActionsTimeline() {
  const supabase = createClient();
  const [actions, setActions] = useState<CaseAction[]>(MOCK_ACTIONS);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all');
  const [filterCase, setFilterCase] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalAction, setModalAction] = useState<Partial<CaseAction> | null | false>(false);
  const [cases, setCases] = useState<{ id: string; name: string }[]>([]);

  // Try to load from DB; fall back to mock data gracefully
  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('case_actions')
        .select('*')
        .order('case_id')
        .order('sequence_order');
      if (!error && data && data.length > 0) {
        setActions(data as CaseAction[]);
      }
      // else keep mock data
    } catch {
      // keep mock data
    }
    setLoading(false);
  }, [supabase]);

  const loadCases = useCallback(async () => {
    try {
      const { data } = await supabase.from('contact_inquiries').select('id, name').limit(50);
      if (data && data.length > 0) {
        setCases(data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
      } else {
        setCases([
          { id: 'c1', name: 'Johnson v. Meridian Corp' },
          { id: 'c2', name: 'Estate of Williams — Probate' },
          { id: 'c3', name: 'Rivera Business Formation' },
        ]);
      }
    } catch {
      setCases([
        { id: 'c1', name: 'Johnson v. Meridian Corp' },
        { id: 'c2', name: 'Estate of Williams — Probate' },
        { id: 'c3', name: 'Rivera Business Formation' },
      ]);
    }
  }, [supabase]);

  useEffect(() => {
    loadActions();
    loadCases();
  }, [loadActions, loadCases]);

  const handleStatusChange = async (id: string, status: ActionStatus) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status, completed_at: status === 'completed' ? new Date().toISOString() : a.completed_at } : a));
    try {
      await supabase.from('case_actions').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id);
    } catch { /* local update already applied */ }
  };

  const handleSave = async (form: Partial<CaseAction>) => {
    const now = new Date().toISOString();
    if (form.id) {
      setActions(prev => prev.map(a => a.id === form.id ? { ...a, ...form, updated_at: now } : a));
      try { await supabase.from('case_actions').update({ ...form, updated_at: now }).eq('id', form.id); } catch { /* local */ }
    } else {
      const newAction: CaseAction = {
        id: `local-${Date.now()}`,
        case_id: form.case_id || '',
        case_name: form.case_name || cases.find(c => c.id === form.case_id)?.name || 'Unknown Case',
        action_type: form.action_type || 'admin_note',
        title: form.title || 'Untitled Action',
        description: form.description || null,
        status: form.status || 'pending',
        priority: form.priority || 'medium',
        due_date: form.due_date || null,
        completed_at: null,
        assigned_to: form.assigned_to || null,
        assigned_role: form.assigned_role || null,
        created_by: 'admin',
        created_at: now,
        updated_at: now,
        sequence_order: form.sequence_order || 1,
      };
      setActions(prev => [...prev, newAction]);
      try { await supabase.from('case_actions').insert(newAction); } catch { /* local */ }
    }
    setModalAction(false);
  };

  // Filter & group
  const filtered = actions.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterType !== 'all' && a.action_type !== filterType) return false;
    if (filterCase !== 'all' && a.case_id !== filterCase) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !(a.description || '').toLowerCase().includes(q) && !a.case_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped: CaseGroup[] = Object.values(
    filtered.reduce<Record<string, CaseGroup>>((acc, a) => {
      if (!acc[a.case_id]) acc[a.case_id] = { case_id: a.case_id, case_name: a.case_name, actions: [] };
      acc[a.case_id].actions.push(a);
      return acc;
    }, {})
  ).map(g => ({ ...g, actions: g.actions.sort((a, b) => a.sequence_order - b.sequence_order) }));

  // Summary stats
  const total = actions.length;
  const completed = actions.filter(a => a.status === 'completed').length;
  const overdue = actions.filter(a => isOverdue(a)).length;
  const inProgress = actions.filter(a => a.status === 'in_progress').length;
  const pending = actions.filter(a => a.status === 'pending').length;

  const uniqueCases = Array.from(new Map(actions.map(a => [a.case_id, a.case_name])).entries());

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Actions', value: total, color: 'text-foreground', bg: 'bg-card' },
          { label: 'In Progress', value: inProgress, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Overdue', value: overdue, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Completed', value: completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Add button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search actions…"
              className="pl-7 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-44" />
          </div>
          {/* Case filter */}
          <select value={filterCase} onChange={e => setFilterCase(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All Cases</option>
            {uniqueCases.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {/* Type filter */}
          <select value={filterType} onChange={e => setFilterType(e.target.value as ActionType | 'all')}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All Types</option>
            {(Object.keys(ACTION_TYPE_CONFIG) as ActionType[]).map(t => (
              <option key={t} value={t}>{ACTION_TYPE_CONFIG[t].label}</option>
            ))}
          </select>
          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ActionStatus | 'all')}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_CONFIG) as ActionStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setModalAction({})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shrink-0"
          style={{ background: '#355E3B' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Action
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
            <span className="text-xs font-semibold text-foreground">{Math.round((completed / total) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completed / total) * 100}%`, background: '#355E3B' }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: 'Pending', count: pending, color: 'bg-slate-400' },
              { label: 'In Progress', count: inProgress, color: 'bg-blue-500' },
              { label: 'Overdue', count: overdue, color: 'bg-red-500' },
              { label: 'Completed', count: completed, color: 'bg-emerald-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[10px] text-muted-foreground">{item.count} {item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline grouped by case */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading actions…</div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-30"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm">No actions match your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => {
            const groupCompleted = group.actions.filter(a => a.status === 'completed').length;
            const groupTotal = group.actions.length;
            return (
              <div key={group.case_id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Case header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#355E3B20' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{group.case_name}</h3>
                      <p className="text-[10px] text-muted-foreground">{groupTotal} action{groupTotal !== 1 ? 's' : ''} · {groupCompleted} completed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mini progress */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${groupTotal > 0 ? (groupCompleted / groupTotal) * 100 : 0}%`, background: '#355E3B' }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0}%</span>
                    </div>
                    {/* Team avatars */}
                    <div className="flex -space-x-1.5">
                      {Array.from(new Set(group.actions.map(a => a.assigned_to).filter(Boolean))).slice(0, 3).map((name, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: ['#355E3B', '#4a7c59', '#6b9e7a'][i % 3] }}>
                          {(name || '?').charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-5 pt-6">
                  {group.actions.map((action, idx) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      index={idx}
                      isLast={idx === group.actions.length - 1}
                      onEdit={a => setModalAction(a)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalAction !== false && (
        <ActionModal
          action={modalAction}
          cases={cases}
          onClose={() => setModalAction(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
