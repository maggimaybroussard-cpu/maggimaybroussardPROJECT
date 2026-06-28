'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  client_email: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_at: string;
  completed_at: string | null;
  notes: string | null;
  case_id: string | null;
}

interface NewTaskForm {
  title: string;
  description: string;
  client_name: string;
  client_email: string;
  priority: TaskPriority;
  due_date: string;
  notes: string;
  case_id: string;
  notify_client: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-500' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

const EMPTY_FORM: NewTaskForm = {
  title: '',
  description: '',
  client_name: '',
  client_email: '',
  priority: 'medium',
  due_date: '',
  notes: '',
  case_id: '',
  notify_client: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDueDateStatus(dueDate: string | null, status: TaskStatus): { label: string; color: string } {
  if (status === 'completed') return { label: 'Done', color: 'text-emerald-600' };
  if (!dueDate) return { label: 'No due date', color: 'text-muted-foreground' };
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600' };
  if (diffDays === 0) return { label: 'Due today', color: 'text-amber-600' };
  if (diffDays === 1) return { label: 'Due tomorrow', color: 'text-amber-500' };
  return { label: `Due in ${diffDays}d`, color: 'text-muted-foreground' };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientTaskPortal() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [clientOptions, setClientOptions] = useState<{ name: string; email: string }[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('case_file_tasks')
        .select('*')
        .order('assigned_at', { ascending: false })
        .limit(100);

      if (data) {
        // Auto-mark overdue
        const now = new Date();
        const enriched = data.map((t) => ({
          ...t,
          status: (t.status !== 'completed' && t.due_date && new Date(t.due_date) < now)
            ? 'overdue' as TaskStatus
            : t.status as TaskStatus,
        }));
        setTasks(enriched);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('contact_inquiries')
        .select('name, email')
        .in('booking_stage', ['active_client', 'consultation_booked', 'proposal_sent'])
        .order('name', { ascending: true })
        .limit(100);
      if (data) {
        const unique = Array.from(new Map(data.map((c) => [c.email, c])).values());
        setClientOptions(unique);
      }
    } catch {
      // Silent fail
    }
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
    fetchClients();
  }, [fetchTasks, fetchClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.client_email.trim()) {
      setSubmitMsg({ type: 'error', text: 'Title and client email are required.' });
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const { error } = await supabase.from('case_file_tasks').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim().toLowerCase(),
        priority: form.priority,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        case_id: form.case_id.trim() || null,
        status: 'pending',
        assigned_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Send Resend admin alert
      if (form.notify_client) {
        await fetch('/api/admin/resend-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_submission',
            clientName: form.client_name,
            clientEmail: form.client_email,
            service: `Task Assigned: ${form.title}`,
            message: form.description || form.notes || undefined,
          }),
        });
      }

      setSubmitMsg({ type: 'success', text: `Task "${form.title}" assigned successfully.` });
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      setSubmitMsg({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingId(taskId);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'completed') updates.completed_at = new Date().toISOString();
      await supabase.from('case_file_tasks').update(updates).eq('id', taskId);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } as ClientTask : t));
    } catch {
      // Silent fail
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.client_name.toLowerCase().includes(q) || t.client_email.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Client Task Portal</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Assign and track tasks for active clients</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setSubmitMsg(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#355E3B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {showForm ? 'Cancel' : 'Assign Task'}
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['all', 'pending', 'in_progress', 'completed', 'overdue'] as const).filter((s) => s !== 'all').map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            className={`bg-card border rounded-xl p-4 text-left transition-all hover:border-primary/30 ${filterStatus === status ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[status].dot}`} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{STATUS_CONFIG[status].label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statusCounts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* New Task Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Assign New Task
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Task Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Complete intake questionnaire"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Client Name *</label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                placeholder="Client full name"
                list="client-names-list"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                required
              />
              <datalist id="client-names-list">
                {clientOptions.map((c) => <option key={c.email} value={c.name} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Client Email *</label>
              <input
                type="email"
                value={form.client_email}
                onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                placeholder="client@example.com"
                list="client-emails-list"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                required
              />
              <datalist id="client-emails-list">
                {clientOptions.map((c) => <option key={c.email} value={c.email} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what the client needs to do…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Internal Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Admin-only notes…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify_client}
                  onChange={(e) => setForm((f) => ({ ...f, notify_client: e.target.checked }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Send admin alert via Resend when task is assigned</span>
              </label>
            </div>

            {submitMsg && (
              <div className={`sm:col-span-2 px-4 py-3 rounded-xl text-sm font-medium ${submitMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {submitMsg.text}
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#355E3B' }}
              >
                {submitting ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Assigning…
                  </>
                ) : 'Assign Task'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setSubmitMsg(null); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search tasks or clients…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'in_progress', 'completed', 'overdue'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filterStatus === s ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              {s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-secondary animate-pulse rounded" />
                  <div className="h-3 w-32 bg-secondary animate-pulse rounded" />
                </div>
                <div className="h-6 w-20 bg-secondary animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No tasks found</p>
            <p className="text-xs text-muted-foreground">
              {filterStatus !== 'all' ? `No ${STATUS_CONFIG[filterStatus].label.toLowerCase()} tasks.` : 'Assign your first client task above.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => {
              const sc = STATUS_CONFIG[task.status];
              const pc = PRIORITY_CONFIG[task.priority];
              const dueInfo = getDueDateStatus(task.due_date, task.status);
              return (
                <div key={task.id} className="px-5 py-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${sc.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{task.client_name}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-xs text-muted-foreground">{task.client_email}</span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pc.color}`}>{pc.label}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                        <span className={`text-xs font-medium ${dueInfo.color}`}>{dueInfo.label}</span>
                        <span className="text-xs text-muted-foreground">Assigned {formatDate(task.assigned_at)}</span>
                        {task.completed_at && (
                          <span className="text-xs text-emerald-600">Completed {formatDate(task.completed_at)}</span>
                        )}
                        {/* Status change buttons */}
                        {task.status !== 'completed' && (
                          <div className="flex gap-1.5 ml-auto">
                            {task.status === 'pending' && (
                              <button
                                onClick={() => handleStatusChange(task.id, 'in_progress')}
                                disabled={updatingId === task.id}
                                className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50"
                              >
                                Start
                              </button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue') && (
                              <button
                                onClick={() => handleStatusChange(task.id, 'completed')}
                                disabled={updatingId === task.id}
                                className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                              >
                                {updatingId === task.id ? '…' : 'Complete'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredTasks.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
      )}
    </div>
  );
}
