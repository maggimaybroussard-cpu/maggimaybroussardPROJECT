'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  'What services do you offer?',
  'How much does it cost?',
  'How do I get started?',
  'Are you available nationwide?',
];

const SYSTEM_PROMPT = `You are Lexi, the AI legal assistant for Broussard Legal Services — a professional contract paralegal firm based in New Orleans, LA, serving clients nationwide. 

Your role is to:
1. Answer general questions about paralegal services, legal processes, and how Broussard Legal Services can help
2. Capture lead information (name, email, legal matter type) when appropriate
3. Route interested visitors to book a consultation

Key facts:
- Services: litigation support, legal research, document drafting, contract review, family law, estate planning, real estate, business formation, court filing
- Turnaround: 24-48 hours standard
- Coverage: All 50 states, 100% remote
- Pricing: Transparent, competitive — view at /pricing
- Book: /book-consultation

IMPORTANT: You are NOT an attorney and cannot provide legal advice. Always recommend consulting a licensed attorney for legal advice. Keep responses concise (2-3 sentences max). When someone shows interest in hiring, ask for their name and email to connect them with Maggi.`;

export default function LexiHomepageWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);
  const msgCountRef = useRef(0);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', true);

  useEffect(() => {
    if (error) toast.error('Lexi is temporarily unavailable. Please try again.');
  }, [error]);

  // Append streamed response as assistant message
  const prevResponseRef = useRef('');
  useEffect(() => {
    if (response && !isLoading && response !== prevResponseRef.current) {
      prevResponseRef.current = response;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: response }];
        }
        return [...prev, { role: 'assistant', content: response }];
      });
      // Show lead form after 3 exchanges
      if (msgCountRef.current >= 3 && !leadCaptured && !showLeadForm) {
        setShowLeadForm(true);
      }
    }
  }, [response, isLoading, leadCaptured, showLeadForm]);

  // Greeting on open
  useEffect(() => {
    if (open && !hasGreeted.current) {
      hasGreeted.current = true;
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm Lexi 👋 I'm here to answer your questions about Broussard Legal Services. What can I help you with today?",
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, response]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    msgCountRef.current += 1;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...newMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];
    sendMessage(apiMessages, { max_completion_tokens: 300 });
  }, [input, isLoading, messages, sendMessage]);

  const handleLeadSubmit = useCallback(async () => {
    if (!leadName.trim() || !leadEmail.trim()) return;
    setSubmittingLead(true);
    try {
      await fetch('/api/lexi/airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          visitorId: `homepage_${Date.now()}`,
          intentScore: 'High',
          name: leadName,
          email: leadEmail,
        }),
      });
      setLeadCaptured(true);
      setShowLeadForm(false);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Thanks, ${leadName}! I've passed your info to Maggi. She'll reach out to ${leadEmail} shortly. In the meantime, you can [book a consultation directly](/book-consultation).`,
      }]);
    } catch {
      toast.error('Could not save your info. Please try again.');
    } finally {
      setSubmittingLead(false);
    }
  }, [leadName, leadEmail, messages]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1b2a4a] text-white shadow-2xl flex items-center justify-center hover:bg-[#1b2a4a]/90 transition-all duration-300 hover:scale-105"
        aria-label="Chat with Lexi"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: '520px' }}>
          {/* Header */}
          <div className="bg-[#1b2a4a] px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">L</div>
            <div>
              <div className="text-white font-semibold text-sm">Lexi</div>
              <div className="text-white/60 text-xs">AI Legal Assistant · Broussard Legal</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/60 text-xs">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ?'bg-[#1b2a4a] text-white rounded-br-sm' :'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  {msg.content.includes('[book a consultation directly]') ? (
                    <span>
                      {msg.content.split('[book a consultation directly]')[0]}
                      <Link href="/book-consultation" className="underline font-medium">book a consultation directly</Link>
                      {msg.content.split('[book a consultation directly]')[1]?.replace('(/book-consultation)', '')}
                    </span>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Lead capture form */}
            {showLeadForm && !leadCaptured && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Want Maggi to follow up with you?</p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleLeadSubmit}
                    disabled={submittingLead || !leadName.trim() || !leadEmail.trim()}
                    className="flex-1 bg-[#1b2a4a] text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-[#1b2a4a]/90 disabled:opacity-50 transition-colors"
                  >
                    {submittingLead ? 'Sending...' : 'Connect Me'}
                  </button>
                  <button
                    onClick={() => setShowLeadForm(false)}
                    className="px-3 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 px-3 py-2 flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask Lexi anything..."
              className="flex-1 text-sm border-0 outline-none bg-transparent text-slate-800 placeholder-slate-400"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-8 h-8 rounded-full bg-[#1b2a4a] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#1b2a4a]/90 transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-50 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">Not legal advice · Under attorney supervision</p>
            <Link href="/book-consultation" className="text-[10px] text-[#1b2a4a] font-semibold hover:underline">Book Consultation →</Link>
          </div>
        </div>
      )}
    </>
  );
}
