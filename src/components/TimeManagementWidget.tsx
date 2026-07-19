'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeTask {
  id: string;
  title: string;
  client: string;
  category: 'meeting' | 'drafting' | 'research' | 'review' | 'filing' | 'other';
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  estimatedMinutes: number;
  loggedSeconds: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
  lexiLinked?: boolean;
}

interface TimerState {
  taskId: string | null;
  startTs: number | null;
  elapsed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function uid(): string {
  return `tm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  meeting: 'bg-emerald-100 text-emerald-700',
  drafting: 'bg-violet-100 text-violet-700',
  research: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  filing: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-green-600',
};

const STORAGE_KEY = 'bls_time_management_tasks';
const TIMER_KEY = 'bls_time_management_timer';

function loadTasks(): TimeTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTasks(tasks: TimeTask[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TimeManagementWidgetProps {
  /** When true, renders as a compact floating widget */
  floating?: boolean;
  /** When true, shows Lexi integration panel */
  lexiMode?: boolean;
  /** Called when widget requests to send a task to Lexi */
  onSendToLexi?: (task: TimeTask) => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeManagementWidget({
  floating = false,
  lexiMode = false,
  onSendToLexi,
  className = '',
}: TimeManagementWidgetProps) {
  const [tasks, setTasks] = useState<TimeTask[]>([]);
  const [timer, setTimer] = useState<TimerState>({ taskId: null, startTs: null, elapsed: 0 });
  const [view, setView] = useState<'tasks' | 'add' | 'stats'>('tasks');
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // New task form
  const [form, setForm] = useState({
    title: '',
    client: '',
    category: 'other' as TimeTask['category'],
    priority: 'medium' as TimeTask['priority'],
    deadline: '',
    estimatedMinutes: 60,
  });

  // Load from localStorage
  useEffect(() => {
    const stored = loadTasks();
    setTasks(stored);
    try {
      const timerRaw = localStorage.getItem(TIMER_KEY);
      if (timerRaw) {
        const t = JSON.parse(timerRaw) as TimerState;
        if (t.taskId && t.startTs) {
          setTimer({ ...t, elapsed: Math.floor((Date.now() - t.startTs) / 1000) });
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Timer tick
  useEffect(() => {
    if (timer.taskId && timer.startTs) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => ({ ...prev, elapsed: Math.floor((Date.now() - (prev.startTs ?? Date.now())) / 1000) }));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer.taskId, timer.startTs]);

  const updateTasks = useCallback((updated: TimeTask[]) => {
    setTasks(updated);
    saveTasks(updated);
  }, []);

  const handleAddTask = () => {
    if (!form.title.trim()) return;
    const newTask: TimeTask = {
      id: uid(),
      title: form.title.trim(),
      client: form.client.trim(),
      category: form.category,
      priority: form.priority,
      deadline: form.deadline || undefined,
      estimatedMinutes: form.estimatedMinutes,
      loggedSeconds: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      lexiLinked: false,
    };
    updateTasks([newTask, ...tasks]);
    setForm({ title: '', client: '', category: 'other', priority: 'medium', deadline: '', estimatedMinutes: 60 });
    setView('tasks');
  };

  const handleStartTimer = (taskId: string) => {
    const ts = Date.now();
    const newTimer = { taskId, startTs: ts, elapsed: 0 };
    setTimer(newTimer);
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(newTimer)); } catch { /* ignore */ }
    updateTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t));
  };

  const handleStopTimer = () => {
    if (!timer.taskId) return;
    const elapsed = timer.elapsed;
    updateTasks(tasks.map(t =>
      t.id === timer.taskId
        ? { ...t, loggedSeconds: t.loggedSeconds + elapsed }
        : t
    ));
    setTimer({ taskId: null, startTs: null, elapsed: 0 });
    try { localStorage.removeItem(TIMER_KEY); } catch { /* ignore */ }
  };

  const handleComplete = (taskId: string) => {
    if (timer.taskId === taskId) handleStopTimer();
    updateTasks(tasks.map(t =>
      t.id === taskId
        ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
        : t
    ));
  };

  const handleDelete = (taskId: string) => {
    if (timer.taskId === taskId) handleStopTimer();
    updateTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleSendToLexi = (task: TimeTask) => {
    updateTasks(tasks.map(t => t.id === task.id ? { ...t, lexiLinked: true } : t));
    onSendToLexi?.(task);
  };

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter);
  const totalLoggedToday = tasks.reduce((sum, t) => {
    const today = new Date().toDateString();
    const created = new Date(t.createdAt).toDateString();
    return created === today ? sum + t.loggedSeconds : sum;
  }, 0);
  const completedToday = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed').length;

  // ── Floating collapsed state ──────────────────────────────────────────────
  if (floating && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-24 right-4 z-[150] w-12 h-12 rounded-full bg-amber-500 text-white shadow-lg flex items-center justify-center hover:bg-amber-600 transition-colors"
        aria-label="Open time management"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {timer.taskId && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white animate-pulse" />
        )}
      </button>
    );
  }

  const containerClass = floating
    ? `fixed bottom-24 right-4 z-[150] w-80 bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`
    : `bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${className}`;

  return (
    <div className={containerClass} style={{ maxHeight: floating ? '520px' : undefined }}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">⏰</span>
          <div>
            <p className="text-xs font-bold text-foreground">Time Management</p>
            <p className="text-[10px] text-muted-foreground">
              {timer.taskId ? `⏱ ${fmt(timer.elapsed)} running` : `${tasks.filter(t => t.status !== 'completed').length} active tasks`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {lexiMode && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              Lexi
            </span>
          )}
          {floating && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-lg hover:bg-border/50 transition-colors text-muted-foreground"
              aria-label="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 px-4 py-2 bg-secondary/30 border-b border-border shrink-0">
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground">Today</p>
          <p className="text-[11px] font-bold text-foreground">{fmt(totalLoggedToday)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground">Done</p>
          <p className="text-[11px] font-bold text-green-600">{completedToday}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground">Overdue</p>
          <p className={`text-[11px] font-bold ${overdue > 0 ? 'text-red-600' : 'text-foreground'}`}>{overdue}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground">Total</p>
          <p className="text-[11px] font-bold text-foreground">{tasks.length}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(['tasks', 'add', 'stats'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              view === v ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-500' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'add' ? '+ Add' : v}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tasks view */}
        {view === 'tasks' && (
          <div className="p-3 space-y-2">
            {/* Filter */}
            <div className="flex gap-1 flex-wrap">
              {(['all', 'pending', 'in_progress', 'completed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                    filter === f ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-xs">
                No tasks yet. Click &quot;+ Add&quot; to create one.
              </div>
            )}

            {filtered.map(task => {
              const isRunning = timer.taskId === task.id;
              const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
              return (
                <div
                  key={task.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isRunning ? 'border-green-400 bg-green-50' : isOverdue ? 'border-red-200 bg-red-50/30' : 'border-border bg-secondary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[task.category]}`}>
                          {task.category}
                        </span>
                        <span className={`text-[9px] font-bold ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} {task.priority}
                        </span>
                        {task.lexiLinked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Lexi</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground mt-1 truncate">{task.title}</p>
                      {task.client && <p className="text-[10px] text-muted-foreground">{task.client}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {fmt(isRunning ? task.loggedSeconds + timer.elapsed : task.loggedSeconds)} / {fmt(task.estimatedMinutes * 60)}
                        </span>
                        {task.deadline && (
                          <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                            Due: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isRunning ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, ((isRunning ? task.loggedSeconds + timer.elapsed : task.loggedSeconds) / (task.estimatedMinutes * 60)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {task.status !== 'completed' && (
                        <>
                          {isRunning ? (
                            <button
                              onClick={handleStopTimer}
                              className="w-7 h-7 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors"
                              title="Stop timer"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartTimer(task.id)}
                              className="w-7 h-7 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center transition-colors"
                              title="Start timer"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleComplete(task.id)}
                            className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-colors"
                            title="Mark complete"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                        </>
                      )}
                      {(lexiMode || onSendToLexi) && !task.lexiLinked && task.status !== 'completed' && (
                        <button
                          onClick={() => handleSendToLexi(task)}
                          className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200 flex items-center justify-center transition-colors"
                          title="Send to Lexi"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
                        title="Delete"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add task view */}
        {view === 'add' && (
          <div className="p-4 space-y-3">
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Task title *"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            />
            <input
              type="text"
              value={form.client}
              onChange={e => setForm(p => ({ ...p, client: e.target.value }))}
              placeholder="Client / matter"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as TimeTask['category'] }))}
                  className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                >
                  {['meeting', 'drafting', 'research', 'review', 'filing', 'other'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.value as TimeTask['priority'] }))}
                  className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                  className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Est. Minutes</label>
                <input
                  type="number"
                  value={form.estimatedMinutes}
                  onChange={e => setForm(p => ({ ...p, estimatedMinutes: Number(e.target.value) }))}
                  min={1}
                  className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
              </div>
            </div>
            <button
              onClick={handleAddTask}
              disabled={!form.title.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Task
            </button>
          </div>
        )}

        {/* Stats view */}
        {view === 'stats' && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Tasks', value: tasks.length, color: 'text-foreground' },
                { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: 'text-green-600' },
                { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: 'text-blue-600' },
                { label: 'Overdue', value: overdue, color: overdue > 0 ? 'text-red-600' : 'text-foreground' },
              ].map(stat => (
                <div key={stat.label} className="bg-secondary/40 rounded-xl p-3 text-center border border-border">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-secondary/40 rounded-xl p-3 border border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Time by Category</p>
              {['meeting', 'drafting', 'research', 'review', 'filing', 'other'].map(cat => {
                const catTasks = tasks.filter(t => t.category === cat);
                const total = catTasks.reduce((s, t) => s + t.loggedSeconds, 0);
                if (total === 0) return null;
                return (
                  <div key={cat} className="flex items-center justify-between py-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                    <span className="text-[10px] text-foreground font-mono">{fmt(total)}</span>
                  </div>
                );
              })}
              {tasks.every(t => t.loggedSeconds === 0) && (
                <p className="text-[10px] text-muted-foreground text-center py-2">No time logged yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
