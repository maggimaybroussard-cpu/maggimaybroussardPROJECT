'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useChat } from '@/lib/hooks/useChat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  showBookingCTA?: boolean;
}

const BOOKING_TRIGGERS = [
  'hire', 'cost', 'price', 'fee', 'how much', 'retainer', 'consult',
  'book', 'schedule', 'appointment', 'urgent', 'asap', 'deadline',
  'lawsuit', 'sue', 'court', 'contract', 'sign', 'review my',
  'help me', 'need a', 'looking for', 'interested in', 'available',
  'start', 'begin', 'work with', 'services',
];

const QUICK_QUESTIONS = [
  'What services do you offer?',
  'How does a paralegal help my firm?',
  'What is your turnaround time?',
  'How do I get started?',
];

const SYSTEM_PROMPT = `You are Lexi, the AI legal assistant for Broussard Legal Services — a professional contract paralegal firm based in New Orleans, LA serving law firms nationwide.

Your role is to:
1. Answer general legal questions clearly and helpfully
2. Explain what Broussard Legal Services offers (litigation support, legal research, document drafting, contract review, case management)
3. Route interested visitors to book a consultation

IMPORTANT RULES:
- You are a paralegal assistant, NOT an attorney. Always clarify you cannot provide legal advice.
- Keep responses concise (2-4 sentences max for general questions)
- When someone shows interest in hiring or needs specific legal help, encourage them to book a free consultation
- Be warm, professional, and approachable
- Mention that Maggi May Broussard is the lead paralegal with 10+ years experience
- Services include: Litigation Support, Legal Research, Document Drafting, Contract Review, Case Management, Deposition Prep
- Pricing starts at $750/month for retainer packages
- Response time: 48-hour standard turnaround

PARALEGAL DISCLAIMER: Always remind users that Broussard Legal Services provides paralegal services under attorney supervision and does not provide legal advice.`;

function detectBookingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_TRIGGERS.some(t => lower.includes(t));
}

export default function LexiPublicChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [hasGreeted, setHasGreeted] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visitorIdRef = useRef<string>('');

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', true);

  // Init visitor ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = 'lexi_pub_visitor';
      let id = localStorage.getItem(key);
      if (!id) {
        id = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(key, id);
      }
      visitorIdRef.current = id;
    }
  }, []);

  // Greeting on first open
  useEffect(() => {
    if (open && !hasGreeted) {
      setHasGreeted(true);
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm Lexi 👋 — your AI legal assistant for Broussard Legal Services. I can answer general legal questions and help you understand how we can support your firm. What can I help you with today?",
      }]);
    }
  }, [open, hasGreeted]);

  // Capture streaming response
  useEffect(() => {
    if (response) {
      setStreamingContent(response);
    }
    if (response && !isLoading) {
      const showCTA = detectBookingIntent(messages.filter(m => m.role === 'user').map(m => m.content).join(' '));
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.role === 'assistant' && m.content === ''));
        return [...filtered, { role: 'assistant', content: response, showBookingCTA: showCTA }];
      });
      setStreamingContent('');
    }
  }, [response, isLoading]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Show lead capture after 3 messages if not captured
  useEffect(() => {
    if (messageCount >= 3 && !leadCaptured && !showLeadCapture) {
      setShowLeadCapture(true);
    }
  }, [messageCount, leadCaptured, showLeadCapture]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    const userMessage: Message = { role: 'user', content: msg };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setMessageCount(c => c + 1);

    // Add placeholder for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...newMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    sendMessage(apiMessages, { max_completion_tokens: 300 });
  }, [input, messages, isLoading, sendMessage]);

  const handleLeadCapture = async () => {
    if (!leadEmail.trim() || !leadEmail.includes('@')) return;
    setLeadSubmitting(true);
    try {
      await fetch('/api/lexi/airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          visitorId: visitorIdRef.current,
          email: leadEmail,
          intentScore: 'Medium',
          source: 'homepage_lexi_widget',
        }),
      });
      setLeadCaptured(true);
      setShowLeadCapture(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Thanks! I've saved your email (${leadEmail}). Maggi will follow up with you shortly. In the meantime, feel free to book a free consultation directly! 📅`,
        showBookingCTA: true,
      }]);
    } catch {
      // silent fail
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {!open && (
          <div className="bg-white rounded-2xl shadow-lg border border-border px-4 py-2.5 text-sm text-foreground font-medium animate-bounce-subtle max-w-[200px] text-center">
            Ask Lexi a legal question ✨
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close Lexi chat' : 'Open Lexi chat'}
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #355E3B 0%, #4a7c59 100%)' }}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
          style={{ height: '520px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: 'linear-gradient(135deg, #355E3B 0%, #4a7c59 100%)' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">L</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Lexi — Legal Assistant</p>
              <p className="text-white/70 text-xs">Broussard Legal Services · GPT-4o Mini</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-white/70 text-xs">Online</span>
            </div>
          </div>

          {/* Paralegal Disclaimer Banner */}
          <div className="bg-amber-50 border-b border-amber-100 px-3 py-1.5">
            <p className="text-amber-700 text-[10px] leading-relaxed">
              ⚖️ <strong>Paralegal Notice:</strong> Lexi provides general information only — not legal advice. No attorney-client relationship is formed.{' '}
              <Link href="/disclaimers" className="underline hover:text-amber-900" onClick={() => setOpen(false)}>Full disclaimer</Link>
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.filter(m => m.content !== '').map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user' ?'text-white rounded-br-sm' :'bg-secondary/60 text-foreground rounded-bl-sm'
                }`} style={msg.role === 'user' ? { background: '#355E3B' } : {}}>
                  {msg.content}
                  {msg.showBookingCTA && msg.role === 'assistant' && (
                    <div className="mt-2.5 pt-2.5 border-t border-border/40">
                      <Link
                        href="/book-consultation"
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90"
                        style={{ background: '#1b2a4a' }}
                      >
                        📅 Book Free Consultation
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-foreground max-w-[85%]">
                  {streamingContent || (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Lead capture prompt */}
            {showLeadCapture && !leadCaptured && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
                <p className="text-blue-800 font-medium mb-2">💌 Want Maggi to follow up with you?</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={e => setLeadEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-blue-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    onKeyDown={e => e.key === 'Enter' && handleLeadCapture()}
                  />
                  <button
                    onClick={handleLeadCapture}
                    disabled={leadSubmitting}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                    style={{ background: '#355E3B' }}
                  >
                    {leadSubmitting ? '…' : 'Send'}
                  </button>
                  <button
                    onClick={() => setShowLeadCapture(false)}
                    className="px-2 py-1.5 rounded-lg text-blue-500 text-xs hover:bg-blue-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick questions (only when no messages from user yet) */}
          {messages.filter(m => m.role === 'user').length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:border-accent hover:text-foreground transition-colors bg-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-border">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a legal question…"
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-secondary/30 disabled:opacity-60"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
                style={{ background: '#355E3B' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
              Powered by GPT-4o Mini · General info only, not legal advice
            </p>
          </div>
        </div>
      )}
    </>
  );
}
