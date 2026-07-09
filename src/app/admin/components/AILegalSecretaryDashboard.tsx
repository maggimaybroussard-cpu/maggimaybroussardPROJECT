'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChat } from '@/lib/hooks/useChat';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_EMAILS = [
  'maggimaybroussard@gmail.com',
  'maggimay@broussardlegalservices.com',
];

const SEAT_PLANS = [
  { id: 'admin_free', label: 'Admin (Free)', price: 0, description: 'Owner/admin access — no charge' },
  { id: 'attorney', label: 'Attorney', price: 79, description: 'Full AI secretary access for attorneys' },
  { id: 'paralegal', label: 'Paralegal', price: 49, description: 'Billable hours + document AI for paralegals' },
  { id: 'legal_assistant', label: 'Legal Assistant', price: 29, description: 'Basic AI assistant for legal assistants' },
];

const AI_CONTEXTS = [
  { id: 'billable_hours', label: 'Billable Hours', icon: '⏱️', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', description: 'Log time, analyze billing patterns, suggest entries' },
  { id: 'case_management', label: 'Case Management', icon: '⚖️', color: 'bg-blue-50 text-blue-700 border-blue-200', description: 'Case summaries, deadlines, next steps' },
  { id: 'billing', label: 'Billing & Invoices', icon: '💰', color: 'bg-amber-50 text-amber-700 border-amber-200', description: 'Invoice drafting, payment tracking, retainer analysis' },
  { id: 'document', label: 'Document Drafting', icon: '📄', color: 'bg-violet-50 text-violet-700 border-violet-200', description: 'Draft motions, letters, contracts, briefs' },
  { id: 'research', label: 'Legal Research', icon: '🔍', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', description: 'Louisiana law, case law, statute lookup' },
  { id: 'general', label: 'General Secretary', icon: '🤖', color: 'bg-gray-100 text-gray-700 border-gray-200', description: 'General legal secretary tasks and questions' },
];

const QUICK_ACTIONS = [
  { label: 'Log Billable Hours', prompt: 'I need to log billable hours for a client. Help me create a time entry with the right task type and description.', context: 'billable_hours' },
  { label: 'Analyze Billing', prompt: 'Analyze my current billable hours and identify any unbilled time or billing gaps I should address.', context: 'billing' },
  { label: 'Draft Invoice', prompt: 'Help me draft an invoice for a client based on recent billable hours logged.', context: 'billing' },
  { label: 'Case Summary', prompt: 'Give me a structured summary template for a new case intake — what key information should I capture?', context: 'case_management' },
  { label: 'Deadline Check', prompt: 'What are the standard Louisiana court deadlines I should track for a new civil litigation matter?', context: 'case_management' },
  { label: 'Draft Motion', prompt: 'Help me draft a motion template for a Louisiana civil court filing.', context: 'document' },
  { label: 'Retainer Review', prompt: 'Review the standard retainer agreement terms and flag any clauses that need attention for a new client.', context: 'document' },
  { label: 'Research LA Law', prompt: 'What are the key Louisiana statutes I should know for a business contract dispute matter?', context: 'research' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
}

interface Seat {
  id: string;
  email: string;
  display_name: string;
  role: string;
  seat_type: string;
  is_active: boolean;
  billing_plan: string;
  monthly_seat_cost: number;
  stripe_subscription_id: string | null;
  seat_activated_at: string;
}

interface HoursSuggestion {
  id: string;
  client_name: string | null;
  task_description: string;
  task_type: string;
  suggested_hours: number;
  hourly_rate: number;
  work_date: string;
  ai_confidence: string;
  approval_status: string;
  created_at: string;
}

interface ActionLog {
  id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  related_client: string | null;
  success: boolean;
  created_at: string;
}

// ── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(context: string): string {
  const base = `You are an AI Legal Secretary at Broussard Legal Services, a boutique Louisiana law firm specializing in business law, contracts, employment law, real estate, estate planning, and litigation support.

You assist the attorney and staff with:
- Billable hours tracking and time entry suggestions
- Invoice drafting and billing analysis
- Case management, deadlines, and next steps
- Legal document drafting (motions, letters, contracts)
- Louisiana law research and statute references
- Client communication drafting
- Retainer agreement review

Communication style: Professional, precise, and efficient. Use legal terminology correctly. Always note when the attorney should review or approve your work.

Primary jurisdiction: Louisiana. Key authorities: Louisiana Civil Code, La. C.C.P., La. R.S. Federal law (Title VII, ADA, FMLA, FLSA, FRCP) where applicable. Use Bluebook citation format.

IMPORTANT: You are an internal tool for the law firm staff only — not client-facing. Be direct and detailed in your responses.`;

  const contextInstructions: Record<string, string> = {
    billable_hours: `\n\nCURRENT CONTEXT: Billable Hours Assistant
- Help log time entries with accurate task descriptions
- Suggest appropriate work categories: research, drafting, review, meetings, filing, other
- Recommend hourly rates based on task type
- Flag potential billing gaps or unbilled work
- Format time entries professionally for invoicing
- When suggesting hours, always ask for: client/matter, task description, duration, date`,

    case_management: `\n\nCURRENT CONTEXT: Case Management Assistant
- Help organize case information and next steps
- Track Louisiana court deadlines and statutes of limitations
- Suggest case milestones and workflow steps
- Draft case summaries and status updates
- Flag urgent deadlines or missing information`,

    billing: `\n\nCURRENT CONTEXT: Billing & Invoice Assistant
- Help draft professional invoices from time entries
- Analyze retainer balances and billing patterns
- Draft payment reminder language
- Review billing for completeness and accuracy
- Suggest billing descriptions that are clear and defensible`,

    document: `\n\nCURRENT CONTEXT: Document Drafting Assistant
- Draft legal documents, motions, letters, and contracts
- Use Louisiana-specific legal language and formatting
- Reference applicable Louisiana statutes and rules
- Always note that attorney review is required before filing or sending
- Format documents professionally with proper headings and structure`,

    research: `\n\nCURRENT CONTEXT: Legal Research Assistant
- Research Louisiana statutes, case law, and regulations
- Provide Bluebook citations
- Summarize key legal principles and their application
- Flag recent changes in law that may affect the matter
- Always recommend attorney verification of research`,

    general: `\n\nCURRENT CONTEXT: General Legal Secretary
- Handle general administrative and legal secretary tasks
- Answer questions about firm procedures and workflows
- Help with scheduling, correspondence, and organization
- Provide general legal information (not legal advice)`,
  };

  return base + (contextInstructions[context] || contextInstructions.general);
}

// ── Access Gate ───────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div className="text-center max-w-sm">
        <h2 className="font-serif text-xl text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          The AI Legal Secretary is restricted to authorized admin accounts only.
          Contact the firm administrator to request access.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AILegalSecretaryDashboard() {
  const supabase = createClient();

  // Auth state
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // View state
  const [activeView, setActiveView] = useState<'chat' | 'hours_queue' | 'action_log' | 'seats'>('chat');
  const [activeContext, setActiveContext] = useState('billable_hours');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Data state
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hoursSuggestions, setHoursSuggestions] = useState<HoursSuggestion[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Seat management
  const [showAddSeat, setShowAddSeat] = useState(false);
  const [newSeatEmail, setNewSeatEmail] = useState('');
  const [newSeatName, setNewSeatName] = useState('');
  const [newSeatPlan, setNewSeatPlan] = useState('paralegal');
  const [savingSeat, setSavingSeat] = useState(false);
  const [seatMsg, setSeatMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI hook
  const { sendMessage, isLoading: aiLoading } = useChat('OPEN_AI', 'openai/gpt-4o-mini', true);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email ?? null;
        setCurrentEmail(email);
        setHasAccess(email ? ALLOWED_EMAILS.includes(email.toLowerCase()) : false);
      } catch {
        setHasAccess(false);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [supabase]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [seatsRes, suggestionsRes, actionsRes] = await Promise.all([
        supabase.from('ai_secretary_seats').select('*').order('created_at'),
        supabase.from('ai_hours_suggestions').select('*').eq('approval_status', 'pending').order('created_at', { ascending: false }).limit(20),
        supabase.from('ai_secretary_actions').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      if (seatsRes.data) setSeats(seatsRes.data);
      if (suggestionsRes.data) setHoursSuggestions(suggestionsRes.data);
      if (actionsRes.data) setActionLogs(actionsRes.data as ActionLog[]);
    } catch {
      // silently handle
    } finally {
      setLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (hasAccess) fetchData();
  }, [hasAccess, fetchData]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || isStreaming) return;

    const userMsg: Message = { role: 'user', content, timestamp: new Date(), context: activeContext };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    const systemPrompt = buildSystemPrompt(activeContext);
    const history = messages.slice(-16).map(m => ({ role: m.role, content: m.content }));
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content },
    ];

    let assistantContent = '';
    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: new Date(), context: activeContext };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await sendMessage(apiMessages, {
        max_completion_tokens: 1500,
        temperature: 0.3,
      });
      // The hook updates response via streaming — we capture via a different approach
      // Since useChat streams internally, we use a manual fetch for streaming display
      const response = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OPEN_AI',
          model: 'openai/gpt-4o-mini',
          messages: apiMessages,
          stream: true,
          parameters: { max_completion_tokens: 1500, temperature: 0.3 },
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk') {
                  const chunk = data.chunk?.choices?.[0]?.delta?.content;
                  if (chunk) {
                    assistantContent += chunk;
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { ...assistantMsg, content: assistantContent };
                      return updated;
                    });
                  }
                }
              } catch { /* skip */ }
            }
          }
        }
      }

      // Log action
      if (currentEmail) {
        await supabase.from('ai_secretary_actions').insert({
          seat_email: currentEmail,
          action_type: `chat_${activeContext}`,
          action_data: { prompt_length: content.length, context: activeContext },
          success: true,
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'AI error';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...assistantMsg, content: `⚠️ ${errMsg}` };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, messages, activeContext, currentEmail, supabase, sendMessage]);

  // ── Approve/reject hours suggestion ───────────────────────────────────────
  const handleSuggestionAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await supabase.from('ai_hours_suggestions').update({
        approval_status: action,
        approved_by: currentEmail,
        approved_at: new Date().toISOString(),
      }).eq('id', id);

      if (action === 'approved') {
        const suggestion = hoursSuggestions.find(s => s.id === id);
        if (suggestion) {
          await supabase.from('paralegal_billable_hours').insert({
            paralegal_name: 'AI Secretary',
            paralegal_email: currentEmail,
            task_description: suggestion.task_description,
            task_type: suggestion.task_type,
            duration_hours: suggestion.suggested_hours,
            hourly_rate: suggestion.hourly_rate,
            work_date: suggestion.work_date,
            billing_status: 'unbilled',
            notes: 'Auto-logged from AI Secretary suggestion',
          });
        }
      }
      setHoursSuggestions(prev => prev.filter(s => s.id !== id));
    } catch { /* silently handle */ }
  };

  // ── Add seat ───────────────────────────────────────────────────────────────
  const handleAddSeat = async () => {
    if (!newSeatEmail.trim() || !newSeatName.trim()) {
      setSeatMsg({ type: 'error', text: 'Email and name are required' });
      return;
    }
    setSavingSeat(true);
    try {
      const plan = SEAT_PLANS.find(p => p.id === newSeatPlan);
      const { error } = await supabase.from('ai_secretary_seats').insert({
        email: newSeatEmail.trim().toLowerCase(),
        display_name: newSeatName.trim(),
        role: 'employee',
        seat_type: newSeatPlan,
        billing_plan: newSeatPlan,
        monthly_seat_cost: plan?.price ?? 49,
        is_active: true,
      });
      if (error) throw error;
      setSeatMsg({ type: 'success', text: `Seat added for ${newSeatEmail}. Connect Stripe to activate billing.` });
      setNewSeatEmail('');
      setNewSeatName('');
      setShowAddSeat(false);
      await fetchData();
    } catch (err) {
      setSeatMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add seat' });
    } finally {
      setSavingSeat(false);
      setTimeout(() => setSeatMsg(null), 5000);
    }
  };

  // ── Toggle seat active ─────────────────────────────────────────────────────
  const handleToggleSeat = async (id: string, current: boolean) => {
    await supabase.from('ai_secretary_seats').update({ is_active: !current }).eq('id', id);
    setSeats(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
  };

  // ── Loading / Access states ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Verifying access…
        </div>
      </div>
    );
  }

  if (!hasAccess) return <AccessDenied />;

  const pendingCount = hoursSuggestions.length;
  const totalMonthlyCost = seats.filter(s => s.is_active && s.monthly_seat_cost > 0).reduce((sum, s) => sum + Number(s.monthly_seat_cost), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#355E3B' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2 12 12"/><path d="m17 2 5 5-5 5"/>
              </svg>
            </div>
            <h2 className="font-serif text-xl text-foreground">AI Legal Secretary</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Admin Only</span>
          </div>
          <p className="text-sm text-muted-foreground">Intelligent legal secretary integrated throughout your practice — billable hours, case management, billing, and document drafting.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{seats.filter(s => s.is_active).length}</span> active seats
          </div>
          {totalMonthlyCost > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ${totalMonthlyCost}/mo billed
            </div>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {[
          { id: 'chat', label: 'AI Chat', icon: '🤖' },
          { id: 'hours_queue', label: `Hours Queue${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: '⏱️' },
          { id: 'action_log', label: 'Action Log', icon: '📋' },
          { id: 'seats', label: 'Seat Management', icon: '👥' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as typeof activeView)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all whitespace-nowrap rounded-t-lg relative ${
              activeView === tab.id
                ? 'text-foreground bg-secondary/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {activeView === tab.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: '#355E3B' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── AI Chat View ── */}
      {activeView === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Context Selector */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Context Mode</p>
            <div className="flex flex-col gap-1.5">
              {AI_CONTEXTS.map(ctx => (
                <button
                  key={ctx.id}
                  onClick={() => setActiveContext(ctx.id)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    activeContext === ctx.id
                      ? ctx.color + 'border-current' :'bg-card border-border hover:border-accent/40'
                  }`}
                >
                  <span className="text-base mt-0.5">{ctx.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${activeContext === ctx.id ? '' : 'text-foreground'}`}>{ctx.label}</p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${activeContext === ctx.id ? 'opacity-80' : 'text-muted-foreground'}`}>{ctx.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-2">Quick Actions</p>
            <div className="flex flex-col gap-1">
              {QUICK_ACTIONS.filter(a => a.context === activeContext || activeContext === 'general').slice(0, 4).map(action => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  disabled={isStreaming}
                  className="text-left px-3 py-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl overflow-hidden" style={{ minHeight: '560px' }}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/20">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#355E3B' }}>AI</div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Legal Secretary</p>
                <p className="text-xs text-muted-foreground">
                  {AI_CONTEXTS.find(c => c.id === activeContext)?.icon} {AI_CONTEXTS.find(c => c.id === activeContext)?.label} mode
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{ maxHeight: '420px' }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#355E3B15' }}>
                    <span className="text-2xl">{AI_CONTEXTS.find(c => c.id === activeContext)?.icon}</span>
                  </div>
                  <div>
                    <p className="font-serif text-lg text-foreground mb-1">Ready to assist</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      I&apos;m your AI Legal Secretary in <strong>{AI_CONTEXTS.find(c => c.id === activeContext)?.label}</strong> mode.
                      Ask me anything or use a quick action to get started.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: '#355E3B' }}>AI</div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user' ?'text-white rounded-tr-sm' :'bg-secondary/50 text-foreground border border-border rounded-tl-sm'
                  }`} style={msg.role === 'user' ? { background: '#355E3B' } : {}}>
                    {msg.content || (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0 mt-0.5">
                      {currentEmail?.[0]?.toUpperCase() ?? 'A'}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Ask your AI Legal Secretary… (${AI_CONTEXTS.find(c => c.id === activeContext)?.label} mode)`}
                  rows={2}
                  disabled={isStreaming}
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none disabled:opacity-60"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isStreaming}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40 flex-shrink-0"
                  style={{ background: '#355E3B' }}
                >
                  {isStreaming ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                AI Legal Secretary · Admin-only · Logged in as <strong>{currentEmail}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hours Queue View ── */}
      {activeView === 'hours_queue' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-foreground">AI Hours Suggestions Queue</h3>
              <p className="text-sm text-muted-foreground">Review and approve AI-suggested time entries before they are logged to billable hours.</p>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
              {pendingCount} pending
            </span>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading suggestions…</div>
          ) : hoursSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card border border-border rounded-2xl">
              <span className="text-3xl">✅</span>
              <p className="text-sm text-muted-foreground">No pending hours suggestions. The AI will suggest entries as you work.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hoursSuggestions.map(s => (
                <div key={s.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          s.ai_confidence === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.ai_confidence === 'medium'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {s.ai_confidence} confidence
                        </span>
                        <span className="text-xs text-muted-foreground">{s.task_type}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">{s.task_description}</p>
                      {s.client_name && <p className="text-xs text-muted-foreground">Client: {s.client_name}</p>}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm font-semibold text-foreground">{s.suggested_hours}h</span>
                        <span className="text-xs text-muted-foreground">@ ${s.hourly_rate}/hr</span>
                        <span className="text-xs font-semibold text-foreground">${(s.suggested_hours * s.hourly_rate).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">{new Date(s.work_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleSuggestionAction(s.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-red-600 hover:border-red-200 transition-all"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleSuggestionAction(s.id, 'approved')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#355E3B' }}
                      >
                        Approve & Log
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Action Log View ── */}
      {activeView === 'action_log' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-serif text-lg text-foreground">AI Secretary Action Log</h3>
            <p className="text-sm text-muted-foreground">All actions taken by the AI Legal Secretary — hours logged, documents drafted, research completed.</p>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading logs…</div>
          ) : actionLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card border border-border rounded-2xl">
              <span className="text-3xl">📋</span>
              <p className="text-sm text-muted-foreground">No actions logged yet. Start using the AI secretary to see activity here.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Action</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">User</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Client</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {actionLogs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-mono text-foreground">{log.action_type.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{log.seat_email ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{log.related_client ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Seat Management View ── */}
      {activeView === 'seats' && (
        <div className="flex flex-col gap-6">
          {/* Seat overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Active Seats</p>
              <p className="text-3xl font-semibold text-foreground">{seats.filter(s => s.is_active).length}</p>
              <p className="text-xs text-muted-foreground mt-1">{seats.filter(s => s.seat_type === 'admin').length} admin · {seats.filter(s => s.seat_type !== 'admin').length} employee</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Monthly Revenue</p>
              <p className="text-3xl font-semibold text-foreground">${totalMonthlyCost.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">from employee seats</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Billing Status</p>
              <p className="text-sm font-semibold text-foreground mt-2">Ready for Stripe</p>
              <p className="text-xs text-muted-foreground mt-1">Connect Stripe to activate seat billing</p>
            </div>
          </div>

          {/* Pricing plans */}
          <div>
            <h3 className="font-serif text-lg text-foreground mb-3">Seat Plans</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SEAT_PLANS.map(plan => (
                <div key={plan.id} className={`bg-card border rounded-2xl p-4 ${plan.price === 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-border'}`}>
                  <p className="text-sm font-semibold text-foreground">{plan.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{plan.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seats table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg text-foreground">Current Seats</h3>
              <button
                onClick={() => setShowAddSeat(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Employee Seat
              </button>
            </div>

            {seatMsg && (
              <div className={`mb-3 p-3 rounded-xl text-sm ${seatMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {seatMsg.text}
              </div>
            )}

            {showAddSeat && (
              <div className="mb-4 bg-card border border-border rounded-2xl p-5">
                <h4 className="text-sm font-semibold text-foreground mb-4">Add New Employee Seat</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
                    <input
                      type="email"
                      value={newSeatEmail}
                      onChange={e => setNewSeatEmail(e.target.value)}
                      placeholder="employee@firm.com"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                    <input
                      type="text"
                      value={newSeatName}
                      onChange={e => setNewSeatName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Seat Plan</label>
                    <select
                      value={newSeatPlan}
                      onChange={e => setNewSeatPlan(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                    >
                      {SEAT_PLANS.filter(p => p.price > 0).map(p => (
                        <option key={p.id} value={p.id}>{p.label} — ${p.price}/mo</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddSeat}
                    disabled={savingSeat}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#355E3B' }}
                  >
                    {savingSeat ? 'Adding…' : 'Add Seat'}
                  </button>
                  <button
                    onClick={() => setShowAddSeat(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <p className="text-xs text-muted-foreground ml-2">
                    💡 Billing activates when you connect Stripe and set up subscription webhooks.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">User</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Plan</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Monthly</th>
                    <th className="text-center px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seats.map((seat, i) => (
                    <tr key={seat.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground text-sm">{seat.display_name}</p>
                        <p className="text-xs text-muted-foreground">{seat.email}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          seat.seat_type === 'admin' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {SEAT_PLANS.find(p => p.id === seat.billing_plan)?.label ?? seat.billing_plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right hidden md:table-cell">
                        <span className="text-sm font-medium text-foreground">
                          {seat.monthly_seat_cost > 0 ? `$${seat.monthly_seat_cost}/mo` : 'Free'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          seat.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {seat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {seat.seat_type !== 'admin' && (
                          <button
                            onClick={() => handleToggleSeat(seat.id, seat.is_active)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {seat.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {seat.seat_type === 'admin' && (
                          <span className="text-xs text-muted-foreground italic">Owner</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-semibold text-amber-800 mb-1">💳 Future Billing Setup</p>
              <p className="text-xs text-amber-700">
                Employee seats are ready for Stripe billing. When you add employees, connect your Stripe account and set up subscription webhooks to automatically charge per seat per month.
                Admin seats (maggimaybroussard@gmail.com and maggimay@broussardlegalservices.com) are always free.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
