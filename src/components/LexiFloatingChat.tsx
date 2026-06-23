'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import {
  trackAssistantConversationStart,
  trackAssistantMessageSent,
  trackAssistantSessionEnd,
  trackAssistantQueryTopic,
  trackAssistantBookingCTAClick,
} from '@/lib/analytics';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are Lexi, a knowledgeable AI legal assistant for Broussard Legal Services, a professional contract paralegal firm run by Maggi May Broussard. You help website visitors understand their legal questions and guide them toward the right services.

Your role:
- Answer general legal questions clearly and helpfully
- Explain legal concepts in plain language
- Help visitors understand what type of legal support they may need
- Guide interested visitors to book a consultation or contact Maggi
- Be warm, professional, and reassuring

Important disclaimers:
- Always clarify that your responses are general legal information, not legal advice
- For specific legal matters, always recommend consulting with a licensed attorney
- You can suggest Maggi May Broussard's services when relevant

Services offered: Litigation Support, Contract Review, Legal Research, Document Drafting, Case Management, Deposition Prep.

Keep responses concise (2-4 sentences typically) and conversational. If a visitor seems ready to hire, suggest booking a free consultation at /availability.`;

const SUGGESTED_QUESTIONS = [
  'What is litigation support?',
  'How can a paralegal help my law firm?',
  'What does contract review involve?',
  'How do I get started?',
];

export default function LexiFloatingChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  const userMessageCountRef = useRef(0);
  const hasTrackedStartRef = useRef(false);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-4o-mini', true);

  // Track whether the previous render was loading (to detect completion)
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (error) toast.error('Lexi is temporarily unavailable. Please try again.');
  }, [error]);

  // Track streaming response
  useEffect(() => {
    if (isLoading && response) {
      setStreamingContent(response);
    }
  }, [response, isLoading]);

  // When streaming completes, commit the message
  useEffect(() => {
    if (!isLoading && response && streamingContent) {
      setMessages((prev) => {
        // Avoid duplicate if already added
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === response) return prev;
        return [...prev, { role: 'assistant', content: response }];
      });
      setStreamingContent('');
    }
  }, [isLoading, response, streamingContent]);

  // Sync conversation to Replit legal assistant after each assistant reply
  useEffect(() => {
    const justFinished = wasLoadingRef.current && !isLoading;
    wasLoadingRef.current = isLoading;

    if (!justFinished || !response) return;

    // Build the full conversation including the just-completed assistant message
    const fullHistory = messages.some((m) => m.role === 'assistant' && m.content === response)
      ? messages
      : [...messages, { role: 'assistant' as const, content: response }];

    // Only sync if there's a real exchange (at least one user + one assistant message)
    const hasUserMsg = fullHistory.some((m) => m.role === 'user');
    const hasAssistantMsg = fullHistory.some((m) => m.role === 'assistant' && m.content !== fullHistory[0]?.content);
    if (!hasUserMsg || !hasAssistantMsg) return;

    const conversationHistory = fullHistory.map((m) => ({ role: m.role, content: m.content }));

    fetch('/api/lexi/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'Public Visitor',
        caseRef: 'lexi-public-chat',
        conversationHistory,
        caseSummary: 'Public visitor conversation via Lexi floating chat',
      }),
    }).catch((err) => {
      console.warn('Lexi session sync failed (non-critical):', err);
    });
  }, [isLoading, response, messages]);

  // Track session start when chat opens
  useEffect(() => {
    if (open && !hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      sessionStartRef.current = Date.now();
      trackAssistantConversationStart('floating_chat');
    }
  }, [open]);

  // Track session end when chat closes or component unmounts
  useEffect(() => {
    if (!open && sessionStartRef.current !== null && userMessageCountRef.current > 0) {
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      trackAssistantSessionEnd({
        messageCount: userMessageCountRef.current,
        sessionDurationSeconds: durationSeconds,
        source: 'floating_chat',
      });
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (sessionStartRef.current !== null && userMessageCountRef.current > 0) {
        const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
        trackAssistantSessionEnd({
          messageCount: userMessageCountRef.current,
          sessionDurationSeconds: durationSeconds,
          source: 'floating_chat',
        });
      }
    };
  }, []);

  // Greeting on first open
  useEffect(() => {
    if (open && !hasGreeted.current) {
      hasGreeted.current = true;
      setMessages([
        {
          role: 'assistant',
          content:
            "Hi! I'm Lexi, your AI legal assistant. I can answer general legal questions and help you understand how Broussard Legal Services can support you. What's on your mind?",
        },
      ]);
    }
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const buildApiMessages = useCallback(
    (userText: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      return [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userText },
      ];
    },
    [messages]
  );

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      userMessageCountRef.current += 1;
      const currentCount = userMessageCountRef.current;
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      trackAssistantMessageSent({ messageCount: currentCount, source: 'floating_chat' });
      trackAssistantQueryTopic({ query: trimmed, messageCount: currentCount, source: 'floating_chat' });
      sendMessage(buildApiMessages(trimmed), { max_completion_tokens: 400 });
    },
    [isLoading, buildApiMessages, sendMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleSuggestion = (q: string) => {
    handleSend(q);
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Hi! I'm Lexi, your AI legal assistant. I can answer general legal questions and help you understand how Broussard Legal Services can support you. What's on your mind?",
      },
    ]);
    setInput('');
    setStreamingContent('');
  };

  const showSuggestions = messages.length <= 1 && !isLoading;

  return (
    <>
      {/* Floating toggle button — positioned bottom-left */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close Lexi AI chat' : 'Ask Lexi — AI legal assistant'}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 h-14 rounded-full bg-[#1B2A4A] text-white shadow-lg hover:opacity-90 transition-all duration-300 hover:scale-105"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold tracking-wide">Ask Lexi</span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lexi AI Legal Assistant"
          className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '540px' }}
        >
          {/* Header */}
          <div className="bg-[#1B2A4A] text-white px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-base font-bold">
              L
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Lexi</p>
              <p className="text-xs text-white/60">AI Legal Assistant · Broussard Legal</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                aria-label="Reset conversation"
                title="New conversation"
                className="text-white/50 hover:text-white/90 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                </svg>
              </button>
              <div className="w-2 h-2 rounded-full bg-emerald-400" title="Online" />
            </div>
          </div>

          {/* Messages */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-0.5">
                    L
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ?'bg-[#1B2A4A] text-white rounded-tr-sm' :'bg-white text-gray-800 rounded-tl-sm border border-gray-100 shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-0.5">
                  L
                </div>
                {streamingContent ? (
                  <div className="max-w-[78%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-white text-gray-800 border border-gray-100 shadow-sm">
                    {streamingContent}
                    <span className="inline-block w-1 h-3.5 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
                  </div>
                ) : (
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && (
              <div className="flex flex-col gap-1.5 mt-1">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="text-left px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-[#1B2A4A]/40 hover:bg-[#1B2A4A]/5 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* CTA after conversation */}
            {messages.length >= 4 && !isLoading && (
              <div className="mt-2 p-3 rounded-xl bg-[#1B2A4A]/5 border border-[#1B2A4A]/10 text-center">
                <p className="text-xs text-gray-600 mb-2">Ready to get started with Maggi?</p>
                <a
                  href="/availability"
                  onClick={() => trackAssistantBookingCTAClick(userMessageCountRef.current)}
                  className="inline-block px-4 py-1.5 rounded-lg bg-[#1B2A4A] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Book a Free Consultation →
                </a>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Disclaimer */}
          <div className="px-4 pt-2 pb-1 bg-white border-t border-gray-100 shrink-0">
            <p className="text-[10px] text-gray-400 text-center leading-tight">
              Lexi provides general legal information, not legal advice. For specific matters, consult a licensed attorney.
            </p>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="bg-white border-t border-gray-100 px-3 py-3 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a legal question…"
              disabled={isLoading}
              aria-label="Type your legal question"
              className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 focus:border-[#1B2A4A]/50 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl bg-[#1B2A4A] text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
