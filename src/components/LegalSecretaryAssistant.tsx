'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { lsSet } from '@/lib/localPersistence';

// ── Lazy-loaded Lexi tab components ──────────────────────────────────────────
const LexiBillableHoursTracker = dynamic(() => import('@/components/LexiBillableHoursTracker'), { ssr: false });
const LexiPaymentsTab = dynamic(() => import('@/components/LexiPaymentsTab'), { ssr: false });
const LexiAppointmentsTab = dynamic(() => import('@/components/LexiAppointmentsTab'), { ssr: false });
const LexiDocumentDrafter = dynamic(() => import('@/components/LexiDocumentDrafter'), { ssr: false });
const LexiBriefAssembly = dynamic(() => import('@/components/LexiBriefAssembly'), { ssr: false });
const LexiDeadlineEngine = dynamic(() => import('@/components/LexiDeadlineEngine'), { ssr: false });
const LexiTemplateLibrary = dynamic(() => import('@/components/LexiTemplateLibrary'), { ssr: false });
const LexiDocumentReview = dynamic(() => import('@/components/LexiDocumentReview'), { ssr: false });
const LexiClientComm = dynamic(() => import('@/components/LexiClientComm'), { ssr: false });
const LexiIntakeManager = dynamic(() => import('@/components/LexiIntakeManager'), { ssr: false });
const LexiBillingClock = dynamic(() => import('@/components/LexiBillingClock'), { ssr: false });
const LexiAudioRecorder = dynamic(() => import('@/components/LexiAudioRecorder'), { ssr: false });
const LexiFolders = dynamic(() => import('@/components/LexiFolders'), { ssr: false });
const LexiSearch = dynamic(() => import('@/components/LexiSearch'), { ssr: false });
const LexiDashboard = dynamic(() => import('@/components/LexiDashboard'), { ssr: false });
const LexiInvoiceTab = dynamic(() => import('@/components/LexiInvoiceTab'), { ssr: false });
const LexiCaseFiles = dynamic(() => import('@/components/LexiCaseFiles'), { ssr: false });
const LexiSettlementEstimator = dynamic(() => import('@/components/LexiSettlementEstimator'), { ssr: false });
const LexiDepoPrep = dynamic(() => import('@/components/LexiDepoPrep'), { ssr: false });
const LexiResearchHistory = dynamic(() => import('@/components/LexiResearchHistory'), { ssr: false });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface LegalSecretaryAssistantProps {
  onClose: () => void;
  floatingMode?: boolean;
}

// ── Session Types ─────────────────────────────────────────────────────────────

interface LexiSession {
  id?: string;
  session_key: string;
  client_name: string;
  case_ref?: string;
  conversation_history: Array<{ role: string; content: string }>;
  case_summary?: string;
  total_hours_logged?: number;
  alert_history?: LexiAlert[];
  last_activity_at?: string;
}

// ── Email Panel Types ─────────────────────────────────────────────────────────

type EmailTemplate = 'discovery_request' | 'settlement_offer' | 'case_update' | 'motion_draft' | 'brief_summary' | 'deposition_summary';
type EmailPanelStep = 'compose' | 'review' | 'sent';

interface EmailDraft {
  templateType: EmailTemplate;
  clientName: string;
  clientEmail: string;
  caseDetails: string;
  customInstructions: string;
  draftedBody: string;
  subject: string;
}

const EMAIL_TEMPLATES: Array<{ id: EmailTemplate; label: string; icon: string; description: string }> = [
  { id: 'discovery_request', label: 'Discovery Request', icon: '🔍', description: 'Request documents or information from opposing party' },
  { id: 'settlement_offer', label: 'Settlement Offer', icon: '🤝', description: 'Present or respond to a settlement proposal' },
  { id: 'case_update', label: 'Case Update', icon: '📋', description: 'Send a status update to the client' },
  { id: 'motion_draft', label: 'Motion', icon: '⚖️', description: 'Transmit or summarize a motion filing' },
  { id: 'brief_summary', label: 'Brief', icon: '📄', description: 'Transmit or summarize a legal brief' },
  { id: 'deposition_summary', label: 'Deposition Summary', icon: '🎙️', description: 'Summarize key deposition testimony and next steps' },
];

// ── MAX HISTORY CAP ───────────────────────────────────────────────────────────
const MAX_HISTORY_MESSAGES = 20;

function capHistory(history: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return history.slice(-MAX_HISTORY_MESSAGES);
}

// ── AI Provider Routing ───────────────────────────────────────────────────────

interface ProviderRoute {
  provider: string;
  model: string;
  label: string;
  icon: string;
}

const TAB_PROVIDER_MAP: Record<string, ProviderRoute> = {
  // Research tasks → Perplexity for real-time web search
  research_history: { provider: 'PERPLEXITY', model: 'perplexity/llama-3.1-sonar-small-128k-online', label: 'Perplexity', icon: '🟣' },
  // Document drafting & analysis → Claude for deep reasoning
  docs: { provider: 'ANTHROPIC', model: 'anthropic/claude-sonnet-4-6', label: 'Claude', icon: '🟠' },
  brief: { provider: 'ANTHROPIC', model: 'anthropic/claude-sonnet-4-6', label: 'Claude', icon: '🟠' },
  review: { provider: 'ANTHROPIC', model: 'anthropic/claude-sonnet-4-6', label: 'Claude', icon: '🟠' },
  depoproep: { provider: 'ANTHROPIC', model: 'anthropic/claude-sonnet-4-6', label: 'Claude', icon: '🟠' },
  settlement: { provider: 'ANTHROPIC', model: 'anthropic/claude-sonnet-4-6', label: 'Claude', icon: '🟠' },
  // Case files & large document analysis → Gemini for large context
  casefiles: { provider: 'GEMINI', model: 'gemini/gemini-2.5-flash', label: 'Gemini', icon: '🔵' },
  // Fast tasks → GPT-4o Mini (default)
  chat: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
  hours: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
  invoice: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
  intake: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
  deadline: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
  comm: { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' },
};

function getProviderForTab(tab: string): ProviderRoute {
  return TAB_PROVIDER_MAP[tab] ?? { provider: 'OPEN_AI', model: 'openai/gpt-4o-mini', label: 'GPT-4o', icon: '🟢' };
}

function buildSystemPrompt(caseSummary?: string, clientName?: string, caseRef?: string) {
  const base = `You are Lexi, a professional legal secretary at Broussard Legal Services, a boutique law firm specializing in business law, contracts, employment law, real estate, estate planning, and litigation support.

Your role: Help clients understand their legal documents, explain legal processes and timelines, answer questions about court filings and deadlines, clarify invoices and retainer agreements, assist with scheduling, and provide document preparation guidance.

Communication style: Professional, warm, and reassuring. Use plain language. Never give specific legal advice — always recommend consulting the attorney for strategy. Sign off as "Lexi."

Disclaimers: You provide general information, not legal advice. Deadlines and court dates must be confirmed with the attorney.

Primary jurisdiction: Louisiana. Key authorities include Louisiana Civil Code Arts. 1994, 2315, 2317; La. C.C.P. Art. 966; La. R.S. § 9:2800.6, § 23:301 (employment), § 51:1401 (LUTPA). Apply federal law (Title VII, ADA, FMLA, FLSA, FRCP, FRE) where applicable. Use Bluebook citation format. Always note clients should verify current law with their attorney.`;

  const contextParts: string[] = [];
  if (clientName) contextParts.push(`Current client: ${clientName}`);
  if (caseRef) contextParts.push(`Matter/Case: ${caseRef}`);
  if (caseSummary) {
    contextParts.push(`\nCase history summary (from prior conversations):\n${caseSummary}`);
  }

  if (contextParts.length === 0) return base;

  return `${base}\n\n--- PERSISTENT CASE CONTEXT ---\n${contextParts.join('\n')}\n\nUse this context to provide accurate, consistent responses. Reference prior history when relevant to avoid asking the client to repeat themselves.`;
}

const QUICK_PROMPTS = [
  { label: 'Document Help', text: 'Can you explain what a retainer agreement means and what I should look for?' },
  { label: 'Case Timeline', text: 'What is the typical timeline for a business contract dispute?' },
  { label: 'Court Filing', text: 'What documents do I need to prepare for a court filing?' },
  { label: 'Invoice Question', text: 'Can you explain how legal billing and retainer hours work?' },
  { label: 'Next Steps', text: 'What should I do to prepare for my upcoming consultation?' },
  { label: 'Legal Terms', text: 'Can you explain common legal terms I might see in my documents?' },
  { label: 'LA Statute Lookup', text: 'How do I find the relevant Louisiana statute for a business contract dispute? What are the key provisions I should know?' },
  { label: 'Case Law Research', text: 'How do I research case law for a Louisiana employment discrimination matter? What sources should I use?' },
  { label: 'Matter Organization', text: 'What is the best way to organize a new client matter file? Give me a checklist for case management setup.' },
  { label: 'Deadline Tracking', text: 'What are the key deadlines I need to track for a Louisiana civil litigation matter from filing through trial?' },
];

// ── Lexi Alert Detection ──────────────────────────────────────────────────────

interface LexiAlert {
  title: string;
  body: string;
  priority: 'urgent' | 'high' | 'normal';
  topic: string;
}

const ALERT_PATTERNS: Array<{
  regex: RegExp;
  topic: string;
  priority: 'urgent' | 'high' | 'normal';
  titleFn: (match: RegExpMatchArray) => string;
}> = [
  {
    regex: /\b(deadline|due date|filing deadline|statute of limitations|response due|answer due)\b/i,
    topic: 'Deadline Alert',
    priority: 'urgent',
    titleFn: () => 'Lexi: Deadline mentioned in conversation',
  },
  {
    regex: /\b(court date|hearing|trial|deposition|mediation|arbitration)\b/i,
    topic: 'Court / Hearing',
    priority: 'high',
    titleFn: () => 'Lexi: Court or hearing date discussed',
  },
  {
    regex: /\b(urgent|emergency|immediately|asap|time.sensitive|critical)\b/i,
    topic: 'Urgent Matter',
    priority: 'urgent',
    titleFn: () => 'Lexi: Urgent matter flagged by client',
  },
  {
    regex: /\b(overdue|past due|late payment|unpaid invoice|collections)\b/i,
    topic: 'Billing Issue',
    priority: 'high',
    titleFn: () => 'Lexi: Billing or payment issue raised',
  },
  {
    regex: /\b(complaint|lawsuit|sued|summons|served|legal action)\b/i,
    topic: 'Legal Action',
    priority: 'urgent',
    titleFn: () => 'Lexi: Client mentioned legal action or lawsuit',
  },
  {
    regex: /\b(contract.*sign|sign.*contract|agreement.*sign|retainer.*sign)\b/i,
    topic: 'Contract Signing',
    priority: 'normal',
    titleFn: () => 'Lexi: Client asking about contract signing',
  },
  {
    regex: /\b(new client|potential client|referral|hire.*attorney|need.*lawyer)\b/i,
    topic: 'New Lead',
    priority: 'normal',
    titleFn: () => 'Lexi: Potential new client inquiry detected',
  },
];

async function pushLexiNotification(alert: LexiAlert, userMessage: string) {
  try {
    const supabase = createClient();
    await supabase.from('notifications').insert({
      audience: 'admin',
      user_id: null,
      inquiry_id: null,
      notification_type: 'system',
      title: alert.title,
      body: alert.body,
      link: '/admin',
      is_read: false,
      is_dismissed: false,
      is_archived: false,
      metadata: {
        source: 'lexi',
        priority: alert.priority,
        topic: alert.topic,
        user_message_snippet: userMessage.slice(0, 120),
      },
    });
  } catch {
    // silently fail — don't disrupt the chat
  }
}

function detectAndPushAlerts(userMessage: string, assistantResponse: string): LexiAlert[] {
  const combined = `${userMessage} ${assistantResponse}`;
  const triggered = new Set<string>();
  const firedAlerts: LexiAlert[] = [];

  for (const pattern of ALERT_PATTERNS) {
    if (pattern.regex.test(combined) && !triggered.has(pattern.topic)) {
      triggered.add(pattern.topic);
      const match = combined.match(pattern.regex)!;
      const alert: LexiAlert = {
        title: pattern.titleFn(match),
        body: `Client said: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? '…' : ''}"`,
        priority: pattern.priority,
        topic: pattern.topic,
      };
      pushLexiNotification(alert, userMessage);
      firedAlerts.push(alert);
    }
  }
  return firedAlerts;
}

// ── Legal Symbols Panel ───────────────────────────────────────────────────────

const LEGAL_SYMBOLS: Array<{ symbol: string; name: string; category: string }> = [
  // Section & Paragraph
  { symbol: '§', name: 'Section', category: 'Section & Paragraph' },
  { symbol: '§§', name: 'Sections (plural)', category: 'Section & Paragraph' },
  { symbol: '¶', name: 'Paragraph', category: 'Section & Paragraph' },
  { symbol: '¶¶', name: 'Paragraphs (plural)', category: 'Section & Paragraph' },
  // Legal Latin
  { symbol: 'et al.', name: 'Et al. (and others)', category: 'Latin Abbreviations' },
  { symbol: 'et seq.', name: 'Et seq. (and following)', category: 'Latin Abbreviations' },
  { symbol: 'id.', name: 'Id. (same source)', category: 'Latin Abbreviations' },
  { symbol: 'ibid.', name: 'Ibid. (same place)', category: 'Latin Abbreviations' },
  { symbol: 'supra', name: 'Supra (above)', category: 'Latin Abbreviations' },
  { symbol: 'infra', name: 'Infra (below)', category: 'Latin Abbreviations' },
  { symbol: 'inter alia', name: 'Inter alia (among others)', category: 'Latin Abbreviations' },
  { symbol: 'i.e.,', name: 'I.e. (that is)', category: 'Latin Abbreviations' },
  { symbol: 'e.g.,', name: 'E.g. (for example)', category: 'Latin Abbreviations' },
  { symbol: 'v.', name: 'Versus', category: 'Latin Abbreviations' },
  { symbol: 'cf.', name: 'Cf. (compare)', category: 'Latin Abbreviations' },
  { symbol: 'viz.', name: 'Viz. (namely)', category: 'Latin Abbreviations' },
  // Currency & Numbers
  { symbol: '$', name: 'Dollar', category: 'Currency & Numbers' },
  { symbol: '¢', name: 'Cent', category: 'Currency & Numbers' },
  { symbol: '№', name: 'Number', category: 'Currency & Numbers' },
  { symbol: '#', name: 'Number sign', category: 'Currency & Numbers' },
  // Legal Marks
  { symbol: '©', name: 'Copyright', category: 'IP & Marks' },
  { symbol: '®', name: 'Registered Trademark', category: 'IP & Marks' },
  { symbol: '™', name: 'Trademark', category: 'IP & Marks' },
  { symbol: '℠', name: 'Service Mark', category: 'IP & Marks' },
  // Punctuation & Formatting
  { symbol: '—', name: 'Em Dash', category: 'Punctuation' },
  { symbol: '–', name: 'En Dash', category: 'Punctuation' },
  { symbol: '…', name: 'Ellipsis', category: 'Punctuation' },
  { symbol: '"', name: 'Open Quote', category: 'Punctuation' },
  { symbol: '"', name: 'Close Quote', category: 'Punctuation' },
  { symbol: '\'', name: 'Open Single Quote', category: 'Punctuation' },
  { symbol: '\'', name: 'Close Single Quote', category: 'Punctuation' },
  { symbol: '«', name: 'Left Guillemet', category: 'Punctuation' },
  { symbol: '»', name: 'Right Guillemet', category: 'Punctuation' },
  // Math / Logic
  { symbol: '≥', name: 'Greater than or equal', category: 'Math & Logic' },
  { symbol: '≤', name: 'Less than or equal', category: 'Math & Logic' },
  { symbol: '≠', name: 'Not equal', category: 'Math & Logic' },
  { symbol: '±', name: 'Plus or minus', category: 'Math & Logic' },
  { symbol: '×', name: 'Multiplication', category: 'Math & Logic' },
  { symbol: '÷', name: 'Division', category: 'Math & Logic' },
  { symbol: '%', name: 'Percent', category: 'Math & Logic' },
  { symbol: '‰', name: 'Per mille', category: 'Math & Logic' },
  // Dagger / Reference
  { symbol: '†', name: 'Dagger (footnote)', category: 'Reference Marks' },
  { symbol: '‡', name: 'Double Dagger', category: 'Reference Marks' },
  { symbol: '*', name: 'Asterisk', category: 'Reference Marks' },
  { symbol: '**', name: 'Double Asterisk', category: 'Reference Marks' },
];

function LexiSymbolsPanel() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['All', ...Array.from(new Set(LEGAL_SYMBOLS.map(s => s.category)))];

  const filtered = LEGAL_SYMBOLS.filter(s => {
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    const matchesSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.symbol.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  const handleCopy = async (symbol: string) => {
    try {
      await navigator.clipboard.writeText(symbol);
      setCopied(symbol);
      toast.success(`Copied: ${symbol}`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed — please copy manually');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">⚖️</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Legal Symbols</p>
            <p className="text-[10px] text-muted-foreground">Click any symbol to copy for documents & briefings</p>
          </div>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search symbols…"
          className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(({ symbol, name }) => (
            <button
              key={`${symbol}-${name}`}
              onClick={() => handleCopy(symbol)}
              title={name}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group ${
                copied === symbol
                  ? 'border-green-400 bg-green-50 text-green-700' :'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <span className="text-lg font-serif leading-none mb-1 text-foreground group-hover:text-primary transition-colors">
                {symbol}
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight line-clamp-2">{name}</span>
              {copied === symbol && (
                <span className="text-[9px] text-green-600 font-semibold mt-0.5">Copied!</span>
              )}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">No symbols match your search.</div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border bg-secondary/30 shrink-0">
        <p className="text-[10px] text-muted-foreground text-center">
          Click any symbol to copy it to your clipboard, then paste into your document or briefing.
        </p>
      </div>
    </div>
  );
}

// ── Session Panel Component ───────────────────────────────────────────────────

interface SessionPanelProps {
  clientName: string;
  caseRef: string;
  session: LexiSession | null;
  recentSessions: LexiSession[];
  onClientNameChange: (v: string) => void;
  onCaseRefChange: (v: string) => void;
  onLoadSession: (s: LexiSession) => void;
  onStartNew: () => void;
  isLoading: boolean;
}

function SessionPanel({
  clientName,
  caseRef,
  session,
  recentSessions,
  onClientNameChange,
  onCaseRefChange,
  onLoadSession,
  onStartNew,
  isLoading,
}: SessionPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* Active session banner */}
      {session && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
          <span className="text-green-600 text-sm shrink-0">✅</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-800">Session Active</p>
            <p className="text-[11px] text-green-700 mt-0.5 truncate">
              {session.client_name}{session.case_ref ? ` · ${session.case_ref}` : ''}
            </p>
            {session.case_summary && (
              <p className="text-[10px] text-green-600 mt-1 line-clamp-2 italic">"{session.case_summary}"</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {(session.total_hours_logged ?? 0) > 0 && (
                <span className="text-[10px] text-green-700 font-medium">⏱ {session.total_hours_logged?.toFixed(1)}h logged</span>
              )}
              {(session.alert_history?.length ?? 0) > 0 && (
                <span className="text-[10px] text-amber-700 font-medium">🔔 {session.alert_history?.length} alert{(session.alert_history?.length ?? 0) !== 1 ? 's' : ''}</span>
              )}
              {session.conversation_history?.length > 0 && (
                <span className="text-[10px] text-green-700 font-medium">💬 {session.conversation_history.length} messages</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client / case input */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Load or Start a Session</p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={clientName}
            onChange={e => onClientNameChange(e.target.value)}
            placeholder="Client name (e.g. John Smith)"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
          <input
            type="text"
            value={caseRef}
            onChange={e => onCaseRefChange(e.target.value)}
            placeholder="Matter / case ref (optional)"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
          <button
            onClick={onStartNew}
            disabled={!clientName.trim() || isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Loading…</>
            ) : (
              <>{session ? '🔄 Switch Session' : '▶ Start Session'}</>
            )}
          </button>
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Sessions</p>
          <div className="flex flex-col gap-2">
            {recentSessions.map(s => (
              <button
                key={s.session_key}
                onClick={() => onLoadSession(s)}
                className="text-left p-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{s.client_name}</p>
                    {s.case_ref && <p className="text-[10px] text-muted-foreground truncate">{s.case_ref}</p>}
                    {s.case_summary && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic">"{s.case_summary}"</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-muted-foreground">
                      {s.last_activity_at ? new Date(s.last_activity_at).toLocaleDateString() : ''}
                    </p>
                    {(s.total_hours_logged ?? 0) > 0 && (
                      <p className="text-[10px] text-primary font-medium mt-0.5">{(s.total_hours_logged ?? 0).toFixed(1)}h</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Email Panel Component ─────────────────────────────────────────────────────

function LexiEmailPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<EmailPanelStep>('compose');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState<EmailDraft>({
    templateType: 'case_update',
    clientName: '',
    clientEmail: '',
    caseDetails: '',
    customInstructions: '',
    draftedBody: '',
    subject: '',
  });

  const selectedTemplate = EMAIL_TEMPLATES.find(t => t.id === draft.templateType)!;

  const handleDraft = async () => {
    if (!draft.clientName.trim()) {
      toast.error('Please enter the client name');
      return;
    }
    setIsDrafting(true);
    try {
      const res = await fetch('/api/lexi/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          templateType: draft.templateType,
          clientName: draft.clientName,
          clientEmail: draft.clientEmail,
          caseDetails: draft.caseDetails,
          customInstructions: draft.customInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft failed');
      setDraft(prev => ({ ...prev, draftedBody: data.draft, subject: data.suggestedSubject }));
      setStep('review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to draft email');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSend = async () => {
    if (!draft.clientEmail.trim()) {
      toast.error('Please enter the client email address');
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch('/api/lexi/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          clientEmail: draft.clientEmail,
          clientName: draft.clientName,
          draftedBody: draft.draftedBody,
          subject: draft.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setStep('sent');
      toast.success('Email sent successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setDraft({
      templateType: 'case_update',
      clientName: '',
      clientEmail: '',
      caseDetails: '',
      customInstructions: '',
      draftedBody: '',
      subject: '',
    });
    setStep('compose');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Email Panel Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">✉️</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Draft & Send Email</p>
              <p className="text-[10px] text-muted-foreground">Lexi · Powered by AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            ← Back to Chat
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {(['compose', 'review', 'sent'] as EmailPanelStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 ${step === s ? 'text-primary' : step === 'sent' || (step === 'review' && i === 0) ? 'text-green-600' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === s ? 'bg-primary text-white border-primary' : step === 'sent' || (step === 'review' && i === 0) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-secondary border-border'}`}>
                  {step === 'sent' || (step === 'review' && i === 0) ? '✓' : i + 1}
                </div>
                <span className="text-[10px] font-medium capitalize hidden sm:inline">{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px ${step === 'sent' || (step === 'review' && i === 0) ? 'bg-green-300' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── COMPOSE STEP ── */}
        {step === 'compose' && (
          <div className="flex flex-col gap-4">
            {/* Template selector */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Email Type</p>
              <div className="grid grid-cols-1 gap-2">
                {EMAIL_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDraft(prev => ({ ...prev, templateType: t.id }))}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${draft.templateType === t.id ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:border-primary/30 hover:bg-primary/3'}`}
                  >
                    <span className="text-lg mt-0.5 shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                    {draft.templateType === t.id && (
                      <div className="ml-auto shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client Name *</label>
                <input
                  type="text"
                  value={draft.clientName}
                  onChange={e => setDraft(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Client Email</label>
                <input
                  type="email"
                  value={draft.clientEmail}
                  onChange={e => setDraft(prev => ({ ...prev, clientEmail: e.target.value }))}
                  placeholder="client@email.com"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Case / Matter Details</label>
              <input
                type="text"
                value={draft.caseDetails}
                onChange={e => setDraft(prev => ({ ...prev, caseDetails: e.target.value }))}
                placeholder="e.g. Smith v. Jones — Employment Contract Dispute"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Additional Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={draft.customInstructions}
                onChange={e => setDraft(prev => ({ ...prev, customInstructions: e.target.value }))}
                placeholder={`e.g. "Request payroll records from Jan–Dec 2024" or "Offer $45,000 settlement"`}
                rows={3}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
              />
            </div>

            <button
              onClick={handleDraft}
              disabled={isDrafting || !draft.clientName.trim()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDrafting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Lexi is drafting…
                </>
              ) : (
                <>
                  <span>✨</span>
                  Draft with Lexi
                </>
              )}
            </button>
          </div>
        )}

        {/* ── REVIEW STEP ── */}
        {step === 'review' && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-amber-600 text-sm shrink-0">✏️</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">Review and edit the draft below before sending. You can modify any part of the email.</p>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Subject Line</label>
              <input
                type="text"
                value={draft.subject}
                onChange={e => setDraft(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* To */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">To</label>
              <input
                type="email"
                value={draft.clientEmail}
                onChange={e => setDraft(prev => ({ ...prev, clientEmail: e.target.value }))}
                placeholder="client@email.com (required to send)"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email Body</label>
              <textarea
                value={draft.draftedBody}
                onChange={e => setDraft(prev => ({ ...prev, draftedBody: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('compose')}
                className="flex-1 py-2.5 border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                ← Re-compose
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !draft.clientEmail.trim() || !draft.draftedBody.trim()}
                className="flex-[2] py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── SENT STEP ── */}
        {step === 'sent' && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Email Sent!</p>
              <p className="text-xs text-muted-foreground mt-1">Delivered to <strong>{draft.clientEmail}</strong></p>
              <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{draft.subject}"</p>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
              >
                Draft Another Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lexi Conflict Checker (inline) ───────────────────────────────────────────

function LexiConflictChecker() {
  const supabase = createClient();
  const [form, setForm] = React.useState({ name: '', email: '', entity: '', opposing: '', service: '' });
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<{ riskLevel: string; conflicts: Array<{ description: string; severity: string }> } | null>(null);
  const [error, setError] = React.useState('');

  const runCheck = async () => {
    if (!form.name.trim()) { setError('Client name is required'); return; }
    setChecking(true); setError(''); setResult(null);
    try {
      const conflicts: Array<{ description: string; severity: string }> = [];
      const name = form.name.toLowerCase();
      const email = form.email.toLowerCase();
      const opposing = form.opposing.toLowerCase();

      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('id, name, email, service, status')
        .or(email ? `name.ilike.%${name}%,email.ilike.%${email}%` : `name.ilike.%${name}%`)
        .limit(20);

      (inquiries || []).forEach(inq => {
        conflicts.push({ description: `Existing record: ${inq.name} (${inq.service}) — ${inq.status}`, severity: 'medium' });
      });

      if (opposing) {
        const { data: oppMatches } = await supabase.from('contact_inquiries').select('id, name, service').ilike('name', `%${opposing}%`).limit(10);
        (oppMatches || []).forEach(m => {
          conflicts.push({ description: `Opposing party matches existing client: ${m.name} (${m.service})`, severity: 'high' });
        });
      }

      const highCount = conflicts.filter(c => c.severity === 'high').length;
      const riskLevel = highCount > 0 ? 'high' : conflicts.length > 0 ? 'medium' : 'none';

      await supabase.from('conflict_checks').insert({
        checked_name: form.name, checked_email: form.email || null, checked_entity: form.entity || null,
        opposing_party: form.opposing || null, service_type: form.service || null,
        conflicts_found: conflicts, conflict_count: conflicts.length, risk_level: riskLevel, checked_by: 'Lexi',
      });

      setResult({ riskLevel, conflicts });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  const riskColors: Record<string, string> = {
    none: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    high: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
        Run a conflict check before onboarding a new client. Lexi scans existing records for name, email, and opposing party matches.
      </div>
      {['name', 'email', 'entity', 'opposing', 'service'].map(field => (
        <div key={field}>
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {field === 'name' ? 'Client Name *' : field === 'email' ? 'Email' : field === 'entity' ? 'Business/Entity' : field === 'opposing' ? 'Opposing Party' : 'Service Type'}
          </label>
          <input type={field === 'email' ? 'email' : 'text'} value={(form as Record<string, string>)[field]}
            onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </div>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={runCheck} disabled={checking || !form.name.trim()}
        className="w-full py-2.5 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: '#4A3728' }}>
        {checking ? 'Scanning…' : 'Run Conflict Check'}
      </button>
      {result && (
        <div className={`p-3 rounded-xl border text-sm ${riskColors[result.riskLevel]}`}>
          <p className="font-semibold mb-1">
            {result.riskLevel === 'none' ? '✓ No conflicts found — clear to onboard' : `⚠ ${result.conflicts.length} conflict${result.conflicts.length !== 1 ? 's' : ''} found — review before proceeding`}
          </p>
          {result.conflicts.map((c, i) => (
            <p key={i} className="text-xs mt-1">• {c.description}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LegalSecretaryAssistant({ onClose, floatingMode = false }: LegalSecretaryAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(!floatingMode);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'email' | 'hours' | 'session' | 'payments' | 'appointments' | 'conflict' | 'docs' | 'symbols' | 'brief' | 'deadline' | 'templates' | 'review' | 'comm' | 'intake' | 'dashboard' | 'billing' | 'audio' | 'folders' | 'search' | 'invoice' | 'casefiles' | 'settlement' | 'depoproep' | 'research_history'>('dashboard');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const lastUserMessageRef = useRef<string>('');

  // ── Session state ──────────────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState<LexiSession | null>(null);
  const [sessionClientName, setSessionClientName] = useState('');
  const [sessionCaseRef, setSessionCaseRef] = useState('');
  const [recentSessions, setRecentSessions] = useState<LexiSession[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic provider based on active tab ──────────────────────────────────
  const activeProviderRoute = getProviderForTab(activeTab);

  // Persist active tab to localStorage
  useEffect(() => {
    lsSet('lexi_active_tab', activeTab);
  }, [activeTab]);

  const { response, isLoading, error, sendMessage } = useChat(
    activeProviderRoute.provider,
    activeProviderRoute.model,
    true
  );

  useEffect(() => {
    if (error) toast.error('Assistant unavailable. Please try again.');
  }, [error]);

  // Load recent sessions on mount
  useEffect(() => {
    fetch('/api/lexi/session', { method: 'PUT' })
      .then(r => r.json())
      .then(d => { if (d.sessions) setRecentSessions(d.sessions); })
      .catch(() => {});
  }, []);

  // ── Save session (debounced) ───────────────────────────────────────────────
  const saveSession = useCallback((
    history: Array<{ role: string; content: string }>,
    newAlerts: LexiAlert[] = [],
    currentSession: LexiSession | null,
  ) => {
    if (!currentSession?.client_name) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const mergedAlerts = [
          ...(currentSession.alert_history || []),
          ...newAlerts,
        ].slice(-50);

        const recentExchanges = history.slice(-6).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
        let caseSummary = currentSession.case_summary || '';

        if (history.length > 0 && history.length % 4 === 0) {
          try {
            const summaryRes = await fetch('/api/ai/chat-completion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: 'OPEN_AI',
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a legal case summarizer. Given a conversation excerpt, produce a 2-3 sentence factual summary of the key legal matter, issues raised, and any important dates or deadlines mentioned. Be concise and factual.',
                  },
                  {
                    role: 'user',
                    content: `Summarize this legal conversation:\n\n${recentExchanges}\n\nPrevious summary: ${caseSummary || 'None'}`,
                  },
                ],
                parameters: { max_completion_tokens: 150 },
              }),
            });
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              const newSummary = summaryData?.choices?.[0]?.message?.content?.trim();
              if (newSummary) caseSummary = newSummary;
            }
          } catch {
            // summary generation is best-effort
          }
        }

        await fetch('/api/lexi/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: currentSession.client_name,
            caseRef: currentSession.case_ref,
            conversationHistory: history,
            caseSummary,
            alertHistory: mergedAlerts,
          }),
        });

        setActiveSession(prev => prev ? {
          ...prev,
          conversation_history: history,
          case_summary: caseSummary,
          alert_history: mergedAlerts,
        } : prev);
      } catch {
        // silently fail
      }
    }, 30_000); // 30s debounce — saves on inactivity, not every message
  }, []);

  // ── Flush session immediately (for onClose / beforeunload) ─────────────────
  const flushSessionNow = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setActiveSession(currentSession => {
      if (!currentSession?.client_name) return currentSession;
      const history = conversationRef.current;
      if (history.length === 0) return currentSession;
      // Fire-and-forget synchronous-style save
      fetch('/api/lexi/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: currentSession.client_name,
          caseRef: currentSession.case_ref,
          conversationHistory: history,
          caseSummary: currentSession.case_summary,
          alertHistory: currentSession.alert_history,
        }),
        keepalive: true, // ensures request completes even if page is closing
      }).catch(() => {});
      return currentSession;
    });
  }, []);

  // ── Save on page close (beforeunload) ─────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSessionNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushSessionNow]);

  // ── Load a session ─────────────────────────────────────────────────────────
  const loadSession = useCallback(async (clientName: string, caseRef?: string) => {
    setSessionLoading(true);
    try {
      const params = new URLSearchParams({ clientName });
      if (caseRef) params.set('caseRef', caseRef);
      const res = await fetch(`/api/lexi/session?${params}`);
      const data = await res.json();

      if (data.session) {
        const sess: LexiSession = data.session;
        setActiveSession(sess);

        const restored: Message[] = (sess.conversation_history || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(),
        }));

        if (restored.length > 0) {
          setMessages(restored);
          conversationRef.current = sess.conversation_history || [];
          setShowQuickPrompts(false);
          toast.success(`Session restored for ${sess.client_name}`);
        } else {
          const greeting: Message = {
            role: 'assistant',
            content: `Good day! I'm Lexi, your legal secretary at Broussard Legal Services. I'm ready to assist with ${clientName}${caseRef ? `'s matter: ${caseRef}` : "'s matter"}.\n\nHow can I help you today?`,
            timestamp: new Date(),
          };
          setMessages([greeting]);
          conversationRef.current = [{ role: 'assistant', content: greeting.content }];
          setShowQuickPrompts(true);
        }
      } else {
        setActiveSession({
          session_key: '',
          client_name: clientName,
          case_ref: caseRef,
          conversation_history: [],
        });
        const greeting: Message = {
          role: 'assistant',
          content: `Good day! I'm Lexi, your legal secretary at Broussard Legal Services. I'm starting a new session for ${clientName}${caseRef ? ` — ${caseRef}` : ''}.\n\nHow can I help you today?`,
          timestamp: new Date(),
        };
        setMessages([greeting]);
        conversationRef.current = [{ role: 'assistant', content: greeting.content }];
        setShowQuickPrompts(true);
      }

      setActiveTab('chat');
    } catch {
      toast.error('Could not load session');
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // Append streaming response to messages
  const lastAssistantRef = useRef<string>('');
  useEffect(() => {
    if (!response) return;
    if (isLoading) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && lastAssistantRef.current !== response) {
          lastAssistantRef.current = response;
          return [...prev.slice(0, -1), { ...last, content: response }];
        }
        if (last?.role !== 'assistant') {
          lastAssistantRef.current = response;
          return [...prev, { role: 'assistant', content: response, timestamp: new Date() }];
        }
        return prev;
      });
    } else {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          const finalMsg = { ...last, content: response };
          const updatedHistory = [
            ...conversationRef.current,
            { role: 'assistant', content: response },
          ];
          conversationRef.current = updatedHistory;
          lastAssistantRef.current = '';

          let newAlerts: LexiAlert[] = [];
          if (lastUserMessageRef.current) {
            newAlerts = detectAndPushAlerts(lastUserMessageRef.current, response);
            lastUserMessageRef.current = '';
          }

          setActiveSession(currentSession => {
            saveSession(updatedHistory, newAlerts, currentSession);
            return currentSession;
          });

          return [...prev.slice(0, -1), finalMsg];
        }
        return prev;
      });
    }
  }, [response, isLoading, saveSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isExpanded && messages.length === 0) {
      const greeting: Message = {
        role: 'assistant',
        content: "Good day! I'm Lexi, your legal secretary at Broussard Legal Services. I'm here to help you navigate your legal matters, understand your documents, and answer any questions you may have.\n\nHow can I assist you today?",
        timestamp: new Date(),
      };
      setMessages([greeting]);
      conversationRef.current = [{ role: 'assistant', content: greeting.content }];
    }
  }, [isExpanded, messages.length]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const updatedHistory = [...conversationRef.current, { role: 'user', content: text }];
    conversationRef.current = updatedHistory;
    lastUserMessageRef.current = text;
    setInput('');
    setShowQuickPrompts(false);
    lastAssistantRef.current = '';

    const systemPrompt = buildSystemPrompt(
      activeSession?.case_summary,
      activeSession?.client_name,
      activeSession?.case_ref,
    );

    // Cap history to last MAX_HISTORY_MESSAGES before sending to API
    const cappedHistory = capHistory(conversationRef.current);

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...cappedHistory,
    ];

    sendMessage(apiMessages, { max_completion_tokens: 1024 });
  }, [input, isLoading, sendMessage, activeSession]);

  const handleQuickPrompt = (text: string) => {
    setInput(text);
    setShowQuickPrompts(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Handle close with session flush ───────────────────────────────────────
  const handleClose = useCallback(() => {
    flushSessionNow();
    onClose();
  }, [flushSessionNow, onClose]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const containerClass = floatingMode
    ? 'fixed bottom-6 right-6 z-50 w-[380px] sm:w-[420px]'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';

  const panelClass = floatingMode
    ? `bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'h-[640px]' : 'h-auto'}`
    : 'bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-2xl h-[85vh] max-h-[740px]';

  return (
    <div className={containerClass} onClick={floatingMode ? undefined : (e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={panelClass}>
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">Lexi</p>
              <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-medium tracking-wide">AI Legal Secretary</span>
              {activeSession?.client_name && (
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium truncate max-w-[100px]">
                  {activeSession.client_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-white/70">
                {activeSession?.case_ref
                  ? `${activeSession.case_ref} · Persistent session`
                  : 'Broussard Legal Services · Available now'}
              </p>
              <span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded-full font-medium ml-1">
                {activeProviderRoute.icon} {activeProviderRoute.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {floatingMode && (
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isExpanded ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                </svg>
              </button>
            )}
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {(!floatingMode || isExpanded) && (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {([
                { id: 'dashboard', label: 'Home', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
                { id: 'chat', label: 'Chat', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                { id: 'search', label: 'Search', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
                { id: 'folders', label: 'Folders', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
                { id: 'billing', label: 'Clock', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { id: 'audio', label: 'Audio', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> },
                { id: 'email', label: 'Email', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
                { id: 'brief', label: 'Brief', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
                { id: 'deadline', label: 'Deadlines', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { id: 'templates', label: 'Templates', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
                { id: 'intake', label: 'Intake', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
                { id: 'review', label: 'Review', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
                { id: 'comm', label: 'Comm', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
                { id: 'hours', label: 'Hours', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { id: 'payments', label: 'Pay', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
                { id: 'appointments', label: 'Appts', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
                { id: 'invoice', label: 'Invoice', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> },
                { id: 'session', label: activeSession ? '●' : 'Cases', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                { id: 'conflict', label: 'Check', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                { id: 'docs', label: 'Docs', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
                { id: 'symbols', label: '§ Sym', icon: <span className="font-serif text-sm leading-none">§</span> },
                { id: 'casefiles', label: 'Files', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg> },
                { id: 'settlement', label: 'Settle', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
                { id: 'depoproep', label: 'Prep', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
                { id: 'research_history', label: 'History', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/3' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Intake Manager tab */}
            {activeTab === 'intake' && (
              <div className="flex-1 overflow-hidden">
                <LexiIntakeManager />
              </div>
            )}

            {/* Dashboard tab */}
            {activeTab === 'dashboard' && (
              <div className="flex-1 overflow-hidden">
                <LexiDashboard />
              </div>
            )}

            {/* Billing Clock tab */}
            {activeTab === 'billing' && (
              <div className="flex-1 overflow-hidden">
                <LexiBillingClock />
              </div>
            )}

            {/* Audio Recorder tab */}
            {activeTab === 'audio' && (
              <div className="flex-1 overflow-hidden">
                <LexiAudioRecorder />
              </div>
            )}

            {/* Folders tab */}
            {activeTab === 'folders' && (
              <div className="flex-1 overflow-hidden">
                <LexiFolders
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Search tab */}
            {activeTab === 'search' && (
              <div className="flex-1 overflow-hidden">
                <LexiSearch />
              </div>
            )}

            {/* Brief Assembly tab */}
            {activeTab === 'brief' && (
              <div className="flex-1 overflow-hidden">
                <LexiBriefAssembly
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Deadline Engine tab */}
            {activeTab === 'deadline' && (
              <div className="flex-1 overflow-hidden">
                <LexiDeadlineEngine />
              </div>
            )}

            {/* Template Library tab */}
            {activeTab === 'templates' && (
              <div className="flex-1 overflow-hidden">
                <LexiTemplateLibrary prefillClientName={activeSession?.client_name} />
              </div>
            )}

            {/* Document Review tab */}
            {activeTab === 'review' && (
              <div className="flex-1 overflow-hidden">
                <LexiDocumentReview
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Client Comm tab */}
            {activeTab === 'comm' && (
              <div className="flex-1 overflow-hidden">
                <LexiClientComm
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Docs tab */}
            {activeTab === 'docs' && (
              <div className="flex-1 overflow-hidden">
                <LexiDocumentDrafter
                  onClose={() => setActiveTab('chat')}
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Symbols tab */}
            {activeTab === 'symbols' && (
              <div className="flex-1 overflow-hidden">
                <LexiSymbolsPanel />
              </div>
            )}

            {/* Case Files tab */}
            {activeTab === 'casefiles' && (
              <div className="flex-1 overflow-hidden">
                <LexiCaseFiles
                  prefillClientName={activeSession?.client_name}
                  prefillCaseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Settlement Estimator tab */}
            {activeTab === 'settlement' && (
              <div className="flex-1 overflow-hidden">
                <LexiSettlementEstimator
                  clientName={activeSession?.client_name}
                  caseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Depo/Hearing Prep tab */}
            {activeTab === 'depoproep' && (
              <div className="flex-1 overflow-hidden">
                <LexiDepoPrep
                  clientName={activeSession?.client_name}
                  caseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Research History tab */}
            {activeTab === 'research_history' && (
              <div className="flex-1 overflow-hidden">
                <LexiResearchHistory />
              </div>
            )}

            {/* Conflict Check tab */}
            {activeTab === 'conflict' && (
              <div className="flex-1 overflow-y-auto p-4">
                <LexiConflictChecker />
              </div>
            )}

            {/* Email tab */}
            {activeTab === 'email' && (
              <div className="flex-1 overflow-hidden">
                <LexiEmailPanel onClose={() => setActiveTab('chat')} />
              </div>
            )}

            {/* Hours tab */}
            {activeTab === 'hours' && (
              <div className="flex-1 overflow-hidden">
                <LexiBillableHoursTracker />
              </div>
            )}

            {/* Payments tab */}
            {activeTab === 'payments' && (
              <div className="flex-1 overflow-hidden">
                <LexiPaymentsTab
                  clientName={activeSession?.client_name}
                  caseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Appointments tab */}
            {activeTab === 'appointments' && (
              <div className="flex-1 overflow-hidden">
                <LexiAppointmentsTab
                  clientName={activeSession?.client_name}
                  caseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Invoice tab */}
            {activeTab === 'invoice' && (
              <div className="flex-1 overflow-hidden">
                <LexiInvoiceTab
                  clientName={activeSession?.client_name}
                  caseRef={activeSession?.case_ref}
                />
              </div>
            )}

            {/* Session tab */}
            {activeTab === 'session' && (
              <div className="flex-1 overflow-hidden">
                <SessionPanel
                  clientName={sessionClientName}
                  caseRef={sessionCaseRef}
                  session={activeSession}
                  recentSessions={recentSessions}
                  onClientNameChange={setSessionClientName}
                  onCaseRefChange={setSessionCaseRef}
                  onLoadSession={(s) => {
                    setSessionClientName(s.client_name);
                    setSessionCaseRef(s.case_ref || '');
                    loadSession(s.client_name, s.case_ref);
                  }}
                  onStartNew={() => loadSession(sessionClientName, sessionCaseRef || undefined)}
                  isLoading={sessionLoading}
                />
              </div>
            )}

            {/* Chat tab */}
            {activeTab === 'chat' && (
              <>
                {/* Disclaimer banner */}
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-start gap-2 shrink-0">
                  <svg className="text-amber-600 mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Lexi provides general information only — not legal advice. For specific legal strategy, please consult directly with your attorney.
                    {activeSession?.client_name && (
                      <span className="ml-1 font-semibold text-amber-800">Session: {activeSession.client_name}{activeSession.case_ref ? ` · ${activeSession.case_ref}` : ''}</span>
                    )}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      )}
                      <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm'
                          }`}
                        >
                          {msg.content}
                          {msg.role === 'assistant' && isLoading && i === messages.length - 1 && (
                            <span className="inline-flex gap-0.5 ml-1">
                              <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Quick prompts */}
                  {showQuickPrompts && messages.length <= 1 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">Quick questions</p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_PROMPTS.map(prompt => (
                          <button
                            key={prompt.label}
                            onClick={() => handleQuickPrompt(prompt.text)}
                            className="text-left px-3 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 leading-snug"
                          >
                            <span className="font-semibold text-primary block mb-0.5">{prompt.label}</span>
                            <span className="text-muted-foreground line-clamp-2">{prompt.text.slice(0, 50)}…</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-border p-4 shrink-0">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={activeSession?.client_name ? `Ask Lexi about ${activeSession.client_name}'s matter…` : 'Ask Lexi anything about your legal matter…'}
                        disabled={isLoading}
                        rows={1}
                        className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none disabled:opacity-60"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                        onInput={e => {
                          const el = e.currentTarget;
                          el.style.height = 'auto';
                          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                        }}
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 shrink-0"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Press Enter to send · Shift+Enter for new line
                    {!activeSession && <span className="ml-1">· <button onClick={() => setActiveTab('session')} className="text-primary underline">Start a case session</button> for persistent history</span>}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
