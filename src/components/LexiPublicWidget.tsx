'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'What does a paralegal do?',
  'How much does it cost?',
  'Can you help with contracts?',
  'How do I get started?',
];

const SYSTEM_PROMPT = `You are Lexi, the AI assistant for Broussard Legal Services — a professional contract paralegal firm based in New Orleans, LA serving clients nationwide.

Your role is to:
1. Answer general legal questions in plain language (NOT legal advice)
2. Explain what paralegal services Broussard Legal Services offers
3. Help visitors understand if they need paralegal support
4. Route interested visitors to book a free consultation

Services offered: litigation support, legal research, document drafting, case management, discovery assistance, contract review, court filing, client intake, estate planning, real estate, family law, business law.

Pricing: Project-based, monthly retainer ($750–$2,800/month), or hourly.

IMPORTANT RULES:
- Always clarify you provide general information, not legal advice
- For specific legal advice, always recommend consulting with an attorney
- Keep responses concise (2-3 paragraphs max)
- End responses with a gentle CTA to book a consultation when appropriate
- Never discuss competitor services
- Stay on topic: legal services and paralegal support only`;

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'lexi_public_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LexiPublicWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', true);

  useEffect(() => {
    if (error) toast.error('Unable to connect. Please try again.');
  }, [error]);

  // Accumulate streaming response
  useEffect(() => {
    if (isLoading && response) {
      setStreamingContent(response);
    } else if (!isLoading && response && streamingContent) {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      setStreamingContent('');
      // Show lead form after 2 exchanges
      if (messages.filter((m) => m.role === 'user').length >= 1 && !leadCaptured) {
        setTimeout(() => setShowLeadForm(true), 1500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: "Hi! I'm Lexi, Broussard Legal's AI assistant. I can answer general questions about paralegal services and help you figure out if we're a good fit for your legal needs. What can I help you with today?",
        },
      ]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, messages.length]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || isLoading) return;

      const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
      setMessages(newMessages);
      setInput('');

      const apiMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...newMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      sendMessage(apiMessages, { max_completion_tokens: 400 });
    },
    [input, isLoading, messages, sendMessage]
  );

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadSubmitting(true);
    try {
      await fetch('/api/lexi/airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          visitorId: getVisitorId(),
          intentScore: 'High',
          name: leadName,
          email: leadEmail,
        }),
      });
      setLeadCaptured(true);
      setShowLeadForm(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Thanks, ${leadName || 'there'}! I've saved your info. Maggi will follow up shortly. In the meantime, you can [book a free consultation](/availability) to get started right away.`,
        },
      ]);
    } catch {
      // silent fail
    } finally {
      setLeadSubmitting(false);
    }
  };

  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || '/availability';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: '#355E3B' }}
        aria-label="Chat with Lexi"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Pulse indicator */}
        {!open && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ background: '#FAF7F2', border: '1px solid #D9D0C5', height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: '#355E3B', borderColor: '#2d5233' }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">L</div>
            <div>
              <p className="text-white font-semibold text-sm">Lexi — Legal Assistant</p>
              <p className="text-green-200 text-xs">Broussard Legal Services</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-green-200 text-xs">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { background: '#355E3B', color: 'white' }
                      : { background: 'white', color: '#2C1F14', border: '1px solid #D9D0C5' }
                  }
                >
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>
                      {line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}
                      {j < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {isLoading && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-white border" style={{ color: '#2C1F14', borderColor: '#D9D0C5' }}>
                  {streamingContent}
                  <span className="inline-block w-1 h-3 bg-current ml-0.5 animate-pulse" />
                </div>
              </div>
            )}

            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-white border" style={{ borderColor: '#D9D0C5' }}>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Lead capture form */}
            {showLeadForm && !leadCaptured && (
              <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: '#C8965A' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#4A3728' }}>Want Maggi to follow up?</p>
                <p className="text-xs mb-3" style={{ color: '#7A6B5D' }}>Leave your info and she'll reach out within 1 business day.</p>
                <form onSubmit={handleLeadSubmit} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
                  />
                  <input
                    type="email"
                    placeholder="Email address *"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    required
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: '#D9D0C5', color: '#2C1F14' }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={leadSubmitting || !leadEmail.trim()}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{ background: '#355E3B' }}
                    >
                      {leadSubmitting ? 'Saving…' : 'Send'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLeadForm(false)}
                      className="px-3 py-2 rounded-lg text-sm border"
                      style={{ borderColor: '#D9D0C5', color: '#7A6B5D' }}
                    >
                      Skip
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions (only at start) */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all hover:bg-white"
                  style={{ borderColor: '#D9D0C5', color: '#4A3728', background: '#F5EDE0' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Book CTA */}
          {messages.length >= 3 && !showLeadForm && (
            <div className="px-4 pb-2">
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#C8965A' }}
              >
                📅 Book a Free Consultation
              </a>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: '#D9D0C5' }}>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask a legal question…"
                disabled={isLoading}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl border outline-none disabled:opacity-50"
                style={{ borderColor: '#D9D0C5', background: 'white', color: '#2C1F14' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: '#7A6B5D' }}>
              General info only — not legal advice
            </p>
          </div>
        </div>
      )}
    </>
  );
}
