'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  case_id: string | null;
  case_name: string | null;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseOption {
  id: string;
  name: string;
  firm: string;
  service: string;
}

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type FilterStatus = 'all' | TaskStatus;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  todo: {
    label: 'To Do',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    ),
  },
  review: {
    label: 'In Review',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  done: {
    label: 'Done',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && true;
}

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormProps {
  task?: Task | null;
  cases: CaseOption[];
  onSave: (data: Partial<Task>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function TaskFormModal({ task, cases, onSave, onClose, saving }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [caseId, setCaseId] = useState(task?.case_id ?? '');
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split('T')[0] : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const selectedCase = cases.find((c) => c.id === caseId);
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      case_id: caseId || null,
      case_name: selectedCase ? `${selectedCase.name} — ${selectedCase.service}` : null,
      assigned_to: assignedTo.trim() || null,
      priority,
      status,
      due_date: dueDate ? new Date(dueDate + 'T23:59:59').toISOString() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-serif text-lg text-foreground">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Draft engagement letter"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details or notes..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Linked Case</label>
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="">— No case —</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.service})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Assigned To</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Name or email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#355E3B' }}
            >
              {saving ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = task.status !== 'done' && isOverdue(task.due_date);
  const dueSoon = task.status !== 'done' && isDueSoon(task.due_date);
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];

  return (
    <div className={`bg-card border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-sm ${overdue ? 'border-red-200' : 'border-border'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <button
            onClick={() => onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              task.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border hover:border-primary/50'
            }`}
          >
            {task.status === 'done' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
          <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
              <button onClick={() => { onEdit(task); setMenuOpen(false); }} className="w-full text-left px-3.5 py-2 text-sm text-foreground hover:bg-secondary/60 transition-colors flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button onClick={() => { onDelete(task.id); setMenuOpen(false); }} className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground leading-relaxed pl-7">{task.description}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.color}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${priorityCfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
          {priorityCfg.label}
        </span>
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            overdue ? 'bg-red-100 text-red-700 border-red-200' : dueSoon ?'bg-amber-100 text-amber-700 border-amber-200': 'bg-secondary/60 text-muted-foreground border-border'
          }`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {overdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pl-7 pt-1 border-t border-border/50">
        {task.case_name ? (
          <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {task.case_name}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">No case linked</span>
        )}
        {task.assigned_to && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {task.assigned_to}
          </span>
        )}
      </div>

      {/* Quick status change */}
      {task.status !== 'done' && (
        <div className="flex items-center gap-1 pl-7">
          {(['todo', 'in_progress', 'review', 'done'] as TaskStatus[]).filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(task.id, s)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent hover:border-border transition-all"
            >
              → {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TasksDashboard() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>('all');
  const [filterCase, setFilterCase] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setTasks(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchCases = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('contact_inquiries')
        .select('id, name, firm, service')
        .order('name');
      setCases(data ?? []);
    } catch {
      // Non-blocking
    }
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
    fetchCases();
  }, [fetchTasks, fetchCases]);

  const handleSave = async (data: Partial<Task>) => {
    setSaving(true);
    try {
      if (editingTask) {
        const { error: err } = await supabase
          .from('admin_tasks')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingTask.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('admin_tasks')
          .insert([{ ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
        if (err) throw err;

        // Fire task-assigned notification if assigned_to looks like an email
        if (data.assigned_to && data.assigned_to.includes('@')) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
          const assigneeName = data.assigned_to.split('@')[0];
          const firstName = assigneeName.charAt(0).toUpperCase() + assigneeName.slice(1);
          const caseName = data.case_name ?? 'your matter';
          const dueDate = data.due_date
            ? new Date(data.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'No due date set';
          const priority = data.priority ?? 'medium';
          const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);

          fetch('/api/notifications/send-transactional', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: data.assigned_to,
              toName: firstName,
              subject: `Action required on your case — ${data.title}`,
              badge: 'Action Required',
              heading: `You Have a New Action Item, ${firstName}`,
              body: `Hi ${firstName},\n\nThere is a new action item that requires your attention on your ${caseName} matter.\n\nTask: ${data.title}\nDue: ${dueDate}\nPriority: ${priorityLabel}\n\n${data.description ?? ''}\n\nPlease complete this as soon as possible. Log in to your client portal to view the full details and mark it complete when done.`,
              ctaLabel: 'View Task in Portal',
              ctaUrl: `${siteUrl}/portal/dashboard`,
              eventType: 'task',
              templateId: 'task_assigned',
              variables: {
                '{{firstName}}': firstName,
                '{{caseName}}': caseName,
                '{{taskTitle}}': data.title ?? '',
                '{{taskDueDate}}': dueDate,
                '{{taskPriority}}': priorityLabel,
                '{{taskDescription}}': data.description ?? '',
                '{{siteUrl}}': siteUrl,
              },
            }),
          }).catch((e) => console.warn('[task-assigned notification]', e));
        }
      }
      setShowForm(false);
      setEditingTask(null);
      await fetchTasks();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const { error: err } = await supabase.from('admin_tasks').delete().eq('id', id);
      if (err) throw err;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete task');
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    try {
      const { error: err } = await supabase
        .from('admin_tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
    } catch {
      await fetchTasks();
    }
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterCase !== 'all' && t.case_id !== filterCase) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q) && !(t.assigned_to ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && isOverdue(t.due_date)).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: total, sub: `${completionRate}% complete`, color: 'text-foreground' },
          { label: 'In Progress', value: inProgress, sub: 'active work', color: 'text-blue-600' },
          { label: 'Completed', value: done, sub: 'this period', color: 'text-emerald-600' },
          { label: 'Overdue', value: overdueTasks, sub: 'need attention', color: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{stat.label}</p>
            <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">In Review</option>
            <option value="done">Done</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as 'all' | TaskPriority)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterCase}
            onChange={(e) => setFilterCase(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => { setEditingTask(null); setShowForm(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Task
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Overall Completion</span>
              <span className="text-sm font-semibold text-foreground">{done}/{total} tasks</span>
            </div>
            <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${completionRate}%`, background: '#355E3B' }}
              />
            </div>
          </div>
          <span className="text-2xl font-semibold text-foreground flex-shrink-0">{completionRate}%</span>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-muted/40 animate-pulse flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="h-4 bg-muted/40 rounded animate-pulse mb-2 w-3/4" />
                  <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
                </div>
              </div>
              <div className="flex gap-1.5 pl-7">
                <div className="h-5 w-16 bg-muted/30 rounded-full animate-pulse" />
                <div className="h-5 w-14 bg-muted/30 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <button onClick={fetchTasks} className="mt-3 text-xs text-red-600 underline hover:no-underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {tasks.length === 0 ? 'Create your first task to start tracking deliverables.' : 'Try adjusting your filters.'}
          </p>
          {tasks.length === 0 && (
            <button
              onClick={() => { setEditingTask(null); setShowForm(true); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#355E3B' }}
            >
              Create First Task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <TaskFormModal
          task={editingTask}
          cases={cases}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
