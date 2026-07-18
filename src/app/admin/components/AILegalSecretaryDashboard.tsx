'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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

// ── AI Provider Configuration ─────────────────────────────────────────────────

interface AIProvider {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
  strengths: string[];
  bestFor: string[];
  models: Array<{ id: string; label: string; description: string; recommended?: boolean }>;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'OPEN_AI',
    label: 'OpenAI GPT-4o',
    shortLabel: 'GPT-4o',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: '🟢',
    description: 'Versatile, fast, and reliable for most legal tasks',
    strengths: ['Speed', 'Instruction following', 'Structured output', 'Code generation'],
    bestFor: ['Invoice drafting', 'Time entry logging', 'Email drafting', 'General Q&A'],
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast & cost-efficient', recommended: true },
      { id: 'openai/gpt-4o', label: 'GPT-4o', description: 'Most capable OpenAI model' },
    ],
  },
  {
    id: 'ANTHROPIC',
    label: 'Claude Sonnet',
    shortLabel: 'Claude',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: '🟠',
    description: 'Deep reasoning, nuanced analysis, and long documents',
    strengths: ['Long-form analysis', 'Nuanced reasoning', 'Document review', 'Safety'],
    bestFor: ['Contract analysis', 'Legal research', 'Document review', 'Complex briefs'],
    models: [
      { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4', description: 'Best reasoning & analysis', recommended: true },
      { id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku', description: 'Fast responses' },
    ],
  },
  {
    id: 'GEMINI',
    label: 'Gemini Flash',
    shortLabel: 'Gemini',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '🔵',
    description: 'Multimodal intelligence with large context window',
    strengths: ['Large context', 'Multimodal', 'Speed', 'Document processing'],
    bestFor: ['Case file review', 'Deposition prep', 'Multi-document analysis', 'Research'],
    models: [
      { id: 'gemini/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast & multimodal', recommended: true },
      { id: 'gemini/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most capable Gemini' },
    ],
  },
  {
    id: 'PERPLEXITY',
    label: 'Perplexity Sonar',
    shortLabel: 'Perplexity',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: '🟣',
    description: 'Real-time web search + AI for current legal information',
    strengths: ['Real-time search', 'Current case law', 'Citations', 'Up-to-date statutes'],
    bestFor: ['Louisiana statute lookup', 'Recent case law', 'Regulatory updates', 'Legal news'],
    models: [
      { id: 'perplexity/llama-3.1-sonar-small-128k-online', label: 'Sonar Small (Online)', description: 'Fast with web search', recommended: true },
      { id: 'perplexity/llama-3.1-sonar-large-128k-online', label: 'Sonar Large (Online)', description: 'Deep web search' },
    ],
  },
];

const AI_CONTEXTS = [
  { id: 'billable_hours', label: 'Billable Hours', icon: '⏱️', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', description: 'Log time, analyze billing patterns, suggest entries' },
  { id: 'case_management', label: 'Case Management', icon: '⚖️', color: 'bg-blue-50 text-blue-700 border-blue-200', description: 'Case summaries, deadlines, next steps' },
  { id: 'billing', label: 'Billing & Invoices', icon: '💰', color: 'bg-amber-50 text-amber-700 border-amber-200', description: 'Invoice drafting, payment tracking, retainer analysis' },
  { id: 'document', label: 'Document Drafting', icon: '📄', color: 'bg-violet-50 text-violet-700 border-violet-200', description: 'Draft motions, letters, contracts, briefs' },
  { id: 'research', label: 'Legal Research', icon: '🔍', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', description: 'Louisiana law, case law, statute lookup' },
  { id: 'intake', label: 'Client Intake', icon: '📋', color: 'bg-teal-50 text-teal-700 border-teal-200', description: 'Intake screening, conflict checks, matter setup' },
  { id: 'settlement', label: 'Settlement Analysis', icon: '🤝', color: 'bg-rose-50 text-rose-700 border-rose-200', description: 'Settlement valuation, negotiation strategy, risk analysis' },
  { id: 'court_prep', label: 'Court Prep', icon: '🏛️', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', description: 'Hearing prep, argument outlines, exhibit lists' },
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
  { label: 'Intake Checklist', prompt: 'Create a comprehensive new client intake checklist for a business law matter, including conflict check items and required documents.', context: 'intake' },
  { label: 'Conflict Check', prompt: 'Walk me through the conflict of interest check process for a new potential client in a business dispute matter.', context: 'intake' },
  { label: 'Settlement Value', prompt: 'Help me analyze the settlement value for a business contract dispute. What factors should I consider and how should I structure the analysis?', context: 'settlement' },
  { label: 'Negotiation Strategy', prompt: 'Outline a negotiation strategy for a settlement discussion in a Louisiana employment dispute matter.', context: 'settlement' },
  { label: 'Hearing Outline', prompt: 'Create a hearing preparation outline for a Louisiana civil court motion hearing, including argument structure and key points.', context: 'court_prep' },
  { label: 'Exhibit List', prompt: 'Help me create a structured exhibit list template for a Louisiana civil trial, including proper labeling and organization.', context: 'court_prep' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
  provider?: string;
  model?: string;
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
  seat_email?: string;
}

// ── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(context: string, provider: string): string {
  const base = `You are an AI Legal Secretary at Broussard Legal Services, a boutique Louisiana law firm specializing in business law, contracts, employment law, real estate, estate planning, and litigation support.

You assist the attorney and staff with:
- Billable hours tracking and time entry suggestions
- Invoice drafting and billing analysis
- Case management, deadlines, and next steps
- Legal document drafting (motions, letters, contracts)
- Louisiana law research and statute references
- Client communication drafting
- Retainer agreement review
- Client intake and conflict checks
- Settlement analysis and negotiation strategy
- Court preparation and hearing outlines

Communication style: Professional, precise, and efficient. Use legal terminology correctly. Always note when the attorney should review or approve your work.

Primary jurisdiction: Louisiana. Key authorities: Louisiana Civil Code, La. C.C.P., La. R.S. Federal law (Title VII, ADA, FMLA, FLSA, FRCP) where applicable. Use Bluebook citation format.

IMPORTANT: You are an internal tool for the law firm staff only — not client-facing. Be direct and detailed in your responses.`;

  const providerNote = provider === 'PERPLEXITY' ?'\n\nNOTE: You have access to real-time web search. When researching Louisiana statutes, case law, or regulatory updates, search for the most current information and provide citations.'
    : provider === 'ANTHROPIC' ?'\n\nNOTE: Apply deep analytical reasoning for complex legal analysis. When reviewing documents or analyzing legal issues, provide thorough, nuanced analysis with careful attention to detail.'
    : provider === 'GEMINI' ?'\n\nNOTE: Leverage your large context window for comprehensive document analysis. When working with case files or multi-document matters, synthesize information across all provided materials.' :'';

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

    intake: `\n\nCURRENT CONTEXT: Client Intake Assistant
- Guide through new client intake process
- Assist with conflict of interest checks (check against existing clients, adverse parties, related matters)
- Create matter setup checklists and required document lists
- Draft engagement letter terms and retainer structures
- Screen potential clients for case viability and practice area fit
- Flag red flags: statute of limitations concerns, jurisdictional issues, fee disputes`,

    settlement: `\n\nCURRENT CONTEXT: Settlement Analysis Assistant
- Analyze settlement value based on case facts, damages, and liability
- Outline negotiation strategy and BATNA (Best Alternative to Negotiated Agreement)
- Draft settlement demand letters and counter-offer language
- Assess litigation risk vs. settlement benefit
- Calculate net recovery after fees and costs
- Reference Louisiana settlement precedents and comparable verdicts`,

    court_prep: `\n\nCURRENT CONTEXT: Court Preparation Assistant
- Create hearing preparation outlines and argument structures
- Draft witness examination questions (direct and cross)
- Organize exhibit lists with proper Louisiana court labeling
- Summarize key case law and statutory authority for oral argument
- Prepare trial notebooks and hearing binders
- Draft proposed orders and judgments
- Flag procedural requirements under La. C.C.P.`,

    general: `\n\nCURRENT CONTEXT: General Legal Secretary
- Handle general administrative and legal secretary tasks
- Answer questions about firm procedures and workflows
- Help with scheduling, correspondence, and organization
- Provide general legal information (not legal advice)`,
  };

  return base + providerNote + (contextInstructions[context] || contextInstructions.general);
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

// ── Provider Selector Component ───────────────────────────────────────────────

interface ProviderSelectorProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string, model: string) => void;
}

function ProviderSelector({ selectedProvider, selectedModel, onProviderChange }: ProviderSelectorProps) {
  const provider = AI_PROVIDERS.find(p => p.id === selectedProvider)!;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">AI Provider</p>
      <div className="grid grid-cols-2 gap-1.5">
        {AI_PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => onProviderChange(p.id, p.models.find(m => m.recommended)?.id ?? p.models[0].id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
              selectedProvider === p.id
                ? `${p.bgColor} ${p.borderColor} ${p.color}`
                : 'bg-card border-border text-muted-foreground hover:border-accent/40 hover:text-foreground'
            }`}
          >
            <span className="text-sm">{p.icon}</span>
            <span className="text-xs font-semibold">{p.shortLabel}</span>
          </button>
        ))}
      </div>
      {/* Model selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Model</p>
        <select
          value={selectedModel}
          onChange={e => onProviderChange(selectedProvider, e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 transition-all"
        >
          {provider.models.map(m => (
            <option key={m.id} value={m.id}>{m.label}{m.recommended ? ' ★' : ''}</option>
          ))}
        </select>
      </div>
      {/* Provider strength badge */}
      <div className={`p-2.5 rounded-xl border ${provider.bgColor} ${provider.borderColor}`}>
        <p className={`text-xs font-semibold ${provider.color} mb-1`}>Best for:</p>
        <div className="flex flex-wrap gap-1">
          {provider.bestFor.slice(0, 3).map(b => (
            <span key={b} className={`text-xs px-1.5 py-0.5 rounded-md border ${provider.bgColor} ${provider.borderColor} ${provider.color} opacity-80`}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Provider Intelligence Tab ─────────────────────────────────────────────────

function ProviderIntelligenceTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-serif text-lg text-foreground mb-1">AI Provider Intelligence</h3>
        <p className="text-sm text-muted-foreground">All four AI providers are connected and available. Each excels at different legal tasks — choose the right tool for the job.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AI_PROVIDERS.map(provider => (
          <div key={provider.id} className={`rounded-2xl border p-5 ${provider.bgColor} ${provider.borderColor}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <p className={`font-semibold text-sm ${provider.color}`}>{provider.label}</p>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${provider.bgColor} ${provider.borderColor} ${provider.color}`}>
                Connected ✓
              </span>
            </div>

            <div className="mb-3">
              <p className={`text-xs font-semibold ${provider.color} mb-1.5`}>Core Strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.strengths.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/60 border border-white/80 text-foreground">{s}</span>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <p className={`text-xs font-semibold ${provider.color} mb-1.5`}>Best Legal Use Cases</p>
              <ul className="space-y-1">
                {provider.bestFor.map(b => (
                  <li key={b} className="text-xs text-foreground flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${provider.color.replace('text-', 'bg-')}`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className={`text-xs font-semibold ${provider.color} mb-1.5`}>Available Models</p>
              <div className="flex flex-col gap-1">
                {provider.models.map(m => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.description}{m.recommended ? ' · Recommended' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h4 className="font-semibold text-sm text-foreground mb-3">🎯 Provider Recommendation Guide</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { task: 'Draft a motion or brief', provider: 'Claude Sonnet', reason: 'Deep reasoning + long-form writing' },
            { task: 'Look up current Louisiana statutes', provider: 'Perplexity Sonar', reason: 'Real-time web search with citations' },
            { task: 'Log billable hours quickly', provider: 'GPT-4o Mini', reason: 'Fast, structured, cost-efficient' },
            { task: 'Review a large case file', provider: 'Gemini Flash', reason: 'Largest context window' },
            { task: 'Settlement value analysis', provider: 'Claude Sonnet', reason: 'Nuanced multi-factor reasoning' },
            { task: 'Client intake screening', provider: 'GPT-4o Mini', reason: 'Structured checklists, fast responses' },
            { task: 'Recent case law research', provider: 'Perplexity Sonar', reason: 'Up-to-date with citations' },
            { task: 'Court prep & argument outline', provider: 'Claude Sonnet', reason: 'Strategic reasoning + structure' },
          ].map(rec => (
            <div key={rec.task} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{rec.task}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
              </div>
              <span className="text-xs font-semibold text-foreground bg-card border border-border px-2 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0">{rec.provider}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-1">🔄 Automatic Fallback</p>
        <p className="text-xs text-amber-700">
          If your selected provider hits a rate limit or is temporarily unavailable, the system automatically falls back to the next available provider — ensuring uninterrupted access to your AI Legal Secretary.
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
  const [activeView, setActiveView] = useState<'chat' | 'providers' | 'hours_queue' | 'action_log' | 'seats'>('chat');
  const [activeContext, setActiveContext] = useState('billable_hours');

  // Provider state
  const [selectedProvider, setSelectedProvider] = useState('OPEN_AI');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');

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

  // ── Provider change ────────────────────────────────────────────────────────
  const handleProviderChange = useCallback((provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || isStreaming) return;

    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
      context: activeContext,
      provider: selectedProvider,
      model: selectedModel,
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);

    const systemPrompt = buildSystemPrompt(activeContext, selectedProvider);
    const history = messages.slice(-16).map(m => ({ role: m.role, content: m.content }));
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content },
    ];

    let assistantContent = '';
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      context: activeContext,
      provider: selectedProvider,
      model: selectedModel,
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const response = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          messages: apiMessages,
          stream: true,
          parameters: { max_completion_tokens: 1800, temperature: 0.3 },
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
          action_data: { prompt_length: content.length, context: activeContext, provider: selectedProvider, model: selectedModel },
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
  }, [inputValue, isStreaming, messages, activeContext, selectedProvider, selectedModel, currentEmail, supabase]);

  // ── Export conversation ────────────────────────────────────────────────────
  const handleExportConversation = useCallback(() => {
    if (messages.length === 0) return;
    const lines = messages.map(m => {
      const role = m.role === 'user' ? 'You' : 'AI Secretary';
      const time = m.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `[${time}] ${role}:\n${m.content}\n`;
    });
    const text = `AI Legal Secretary Conversation\nDate: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\nContext: ${AI_CONTEXTS.find(c => c.id === activeContext)?.label}\nProvider: ${AI_PROVIDERS.find(p => p.id === selectedProvider)?.label}\n\n${'─'.repeat(60)}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-secretary-${activeContext}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, activeContext, selectedProvider]);

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
  const currentProviderConfig = AI_PROVIDERS.find(p => p.id === selectedProvider)!;

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
          <p className="text-sm text-muted-foreground">Powered by OpenAI, Anthropic, Gemini & Perplexity — intelligent legal secretary across your entire practice.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Provider badges */}
          <div className="flex items-center gap-1">
            {AI_PROVIDERS.map(p => (
              <span key={p.id} title={p.label} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${p.bgColor} ${p.borderColor}`}>
                {p.icon}
              </span>
            ))}
          </div>
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
      <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
        {[
          { id: 'chat', label: 'AI Chat', icon: '🤖' },
          { id: 'providers', label: 'Provider Intelligence', icon: '🧠' },
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

      {/* ── Provider Intelligence Tab ── */}
      {activeView === 'providers' && <ProviderIntelligenceTab />}

      {/* ── AI Chat View ── */}
      {activeView === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Provider Selector */}
            <ProviderSelector
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={handleProviderChange}
            />

            {/* Context Selector */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Context Mode</p>
              <div className="flex flex-col gap-1">
                {AI_CONTEXTS.map(ctx => (
                  <button
                    key={ctx.id}
                    onClick={() => setActiveContext(ctx.id)}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      activeContext === ctx.id
                        ? ctx.color + 'border-current' :'bg-card border-border hover:border-accent/40'
                    }`}
                  >
                    <span className="text-sm mt-0.5 flex-shrink-0">{ctx.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${activeContext === ctx.id ? '' : 'text-foreground'}`}>{ctx.label}</p>
                      <p className={`text-xs mt-0.5 leading-relaxed hidden sm:block ${activeContext === ctx.id ? 'opacity-80' : 'text-muted-foreground'}`}>{ctx.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Quick Actions</p>
              <div className="flex flex-col gap-1">
                {QUICK_ACTIONS.filter(a => a.context === activeContext).slice(0, 3).map(action => (
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
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl overflow-hidden" style={{ minHeight: '560px' }}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/20">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 border ${currentProviderConfig.bgColor} ${currentProviderConfig.borderColor}`}>
                {currentProviderConfig.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">AI Legal Secretary</p>
                <p className="text-xs text-muted-foreground truncate">
                  {AI_CONTEXTS.find(c => c.id === activeContext)?.icon} {AI_CONTEXTS.find(c => c.id === activeContext)?.label} · {currentProviderConfig.shortLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg border border-border hover:border-accent/40"
                  >
                    Clear
                  </button>
                )}
                {messages.length > 0 && (
                  <button
                    onClick={handleExportConversation}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg border border-border hover:border-accent/40"
                    title="Export conversation"
                  >
                    Export
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{ maxHeight: '420px' }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${currentProviderConfig.bgColor} ${currentProviderConfig.borderColor}`}>
                    <span className="text-2xl">{AI_CONTEXTS.find(c => c.id === activeContext)?.icon}</span>
                  </div>
                  <div>
                    <p className="font-serif text-lg text-foreground mb-1">Ready to assist</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      I&apos;m your AI Legal Secretary in <strong>{AI_CONTEXTS.find(c => c.id === activeContext)?.label}</strong> mode, powered by <strong>{currentProviderConfig.label}</strong>.
                    </p>
                  </div>
                  {/* Suggested prompts for new contexts */}
                  {QUICK_ACTIONS.filter(a => a.context === activeContext).length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                      {QUICK_ACTIONS.filter(a => a.context === activeContext).slice(0, 2).map(action => (
                        <button
                          key={action.label}
                          onClick={() => handleSend(action.prompt)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
                        >
                          {action.label} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 border ${
                      AI_PROVIDERS.find(p => p.id === msg.provider)?.bgColor ?? 'bg-secondary'
                    } ${AI_PROVIDERS.find(p => p.id === msg.provider)?.borderColor ?? 'border-border'}`}>
                      {AI_PROVIDERS.find(p => p.id === msg.provider)?.icon ?? '🤖'}
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user' ?'text-white rounded-tr-sm' :'bg-secondary/50 text-foreground border border-border rounded-tl-sm'
                  }`} style={msg.role === 'user' ? { background: '#355E3B' } : {}}>
                    {msg.content ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                    {msg.role === 'assistant' && msg.provider && msg.content && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        {AI_PROVIDERS.find(p => p.id === msg.provider)?.shortLabel} · {AI_CONTEXTS.find(c => c.id === msg.context)?.label}
                      </p>
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
                  placeholder={`Ask your AI Legal Secretary… (${AI_CONTEXTS.find(c => c.id === activeContext)?.label} · ${currentProviderConfig.shortLabel})`}
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
                AI Legal Secretary · Admin-only · <strong>{currentProviderConfig.shortLabel}</strong> · Logged in as <strong>{currentEmail}</strong>
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
                          s.ai_confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'
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
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Provider</th>
                    <th className="text-right px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {actionLogs.map((log, i) => {
                    const providerUsed = (log.action_data as any)?.provider as string | undefined;
                    const providerConfig = AI_PROVIDERS.find(p => p.id === providerUsed);
                    return (
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
                          {providerConfig ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${providerConfig.bgColor} ${providerConfig.borderColor} ${providerConfig.color}`}>
                              {providerConfig.icon} {providerConfig.shortLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">AI Providers</p>
              <div className="flex items-center gap-1.5 mt-2">
                {AI_PROVIDERS.map(p => (
                  <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full border ${p.bgColor} ${p.borderColor} ${p.color} font-semibold`}>
                    {p.icon} {p.shortLabel}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">All 4 providers connected</p>
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
