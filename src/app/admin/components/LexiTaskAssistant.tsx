'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const LEXI_SYSTEM_PROMPT = `You are Lexi, an intelligent legal practice assistant for Maggi May Broussard's law firm. You help manage tasks, track priorities, and keep the admin organized.

Your capabilities:
- Help create, organize, and prioritize tasks
- Suggest follow-up actions for cases and clients
- Remind about deadlines and important dates
- Draft task descriptions and action items
- Provide practice management advice
- Summarize what needs attention

Be concise, professional, and proactive. When the user asks you to create a task, respond with a JSON block in this format:
{"action":"create_task","title":"...","description":"...","priority":"low|medium|high","due_date":"YYYY-MM-DD or null"}

Always be helpful and keep responses focused on legal practice management.`;

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LexiTaskAssistant() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'tasks'>('chat');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium' as Task['priority'], due_date: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', false);

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const { data } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setTasks(data || []);
    } catch {
      // table may not exist yet — silently ignore
    } finally {
      setLoadingTasks(false);
    }
  }, [supabase]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Handle AI response
  useEffect(() => {
    if (!response || isLoading) return;

    // Check if response contains a task creation action
    const jsonMatch = response.match(/\{"action":"create_task"[^}]+\}/);
    if (jsonMatch) {
      try {
        const taskData = JSON.parse(jsonMatch[0]);
        if (taskData.action === 'create_task') {
          setTaskForm({
            title: taskData.title || '',
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            due_date: taskData.due_date || '',
          });
          setShowTaskForm(true);
        }
      } catch {
        // not valid JSON, ignore
      }
    }

    setChatHistory(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') return prev;
      return [...prev, { role: 'assistant', content: response }];
    });
  }, [response, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);

    const messages = [
      { role: 'system' as const, content: LEXI_SYSTEM_PROMPT },
      ...newHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    sendMessage(messages, { max_completion_tokens: 600 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const { data, error } = await supabase.from('admin_tasks').insert({
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        status: 'pending',
      }).select().single();

      if (error) throw error;
      setTasks(prev => [data, ...prev]);
      setShowTaskForm(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
      toast.success('Task created!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    try {
      await supabase.from('admin_tasks').update({ status }).eq('id', id);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch {
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await supabase.from('admin_tasks').delete().eq('id', id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="flex flex-col h-full min-h-[600px]" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--accent)' }}>
            L
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Lexi — Task Assistant</h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>AI-powered practice management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('chat')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeView === 'chat' ? 'var(--accent)' : 'var(--muted)',
              color: activeView === 'chat' ? 'white' : 'var(--muted-foreground)',
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveView('tasks')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
            style={{
              background: activeView === 'tasks' ? 'var(--accent)' : 'var(--muted)',
              color: activeView === 'tasks' ? 'white' : 'var(--muted-foreground)',
            }}
          >
            Tasks
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Task creation form modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-xl" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Create Task</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowTaskForm(false)}
                className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={saveTask}
                disabled={savingTask || !taskForm.title.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {savingTask ? 'Saving…' : 'Save Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat View */}
      {activeView === 'chat' && (
        <div className="flex flex-col flex-1">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0, maxHeight: '500px' }}>
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4" style={{ background: 'var(--accent)' }}>
                  L
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Hi, I'm Lexi!</h3>
                <p className="text-sm max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                  I'm your AI practice assistant. Ask me to create tasks, prioritize your day, or help manage your caseload.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    'What tasks need attention today?',
                    'Create a follow-up task for a client',
                    'Help me prioritize my week',
                    'Draft a task for court deadline',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); }}
                      className="px-3 py-1.5 rounded-full text-xs border transition-colors hover:opacity-80"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--muted)' }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5" style={{ background: 'var(--accent)' }}>
                    L
                  </div>
                )}
                <div
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--muted)',
                    color: msg.role === 'user' ? 'white' : 'var(--foreground)',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  }}
                >
                  {msg.content.replace(/\{"action":"create_task"[^}]+\}/g, '').trim() || msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0" style={{ background: 'var(--accent)' }}>
                  L
                </div>
                <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--muted)', borderRadius: '18px 18px 18px 4px' }}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--muted-foreground)', animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex gap-2 items-end">
              <button
                onClick={() => setShowTaskForm(true)}
                className="p-2.5 rounded-xl border flex-shrink-0 transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--muted)' }}
                title="Create task manually"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Lexi to help with tasks, deadlines, or practice management…"
                rows={1}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  minHeight: '42px',
                  maxHeight: '120px',
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2.5 rounded-xl flex-shrink-0 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
              Press Enter to send · Shift+Enter for new line · + button to create task manually
            </p>
          </div>
        </div>
      )}

      {/* Tasks View */}
      {activeView === 'tasks' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {pendingCount} task{pendingCount !== 1 ? 's' : ''} pending
              </h3>
            </div>
            <button
              onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Task
            </button>
          </div>

          {loadingTasks ? (
            <div className="flex items-center justify-center py-12">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ color: 'var(--accent)' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No tasks yet. Ask Lexi to create one!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="rounded-xl border p-4"
                  style={{
                    background: task.status === 'completed' ? 'var(--muted)' : 'var(--card)',
                    borderColor: 'var(--border)',
                    opacity: task.status === 'completed' ? 0.7 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: task.status === 'completed' ? '#22c55e' : 'var(--border)',
                        background: task.status === 'completed' ? '#22c55e' : 'transparent',
                      }}
                    >
                      {task.status === 'completed' && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through' : ''}`} style={{ color: 'var(--foreground)' }}>
                          {task.title}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {task.due_date && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Due {fmtDate(task.due_date)}
                          </span>
                        )}
                        {task.status !== 'completed' && task.status !== 'in_progress' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            className="text-xs hover:underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            Start
                          </button>
                        )}
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-xs hover:underline ml-auto"
                          style={{ color: '#ef4444' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
