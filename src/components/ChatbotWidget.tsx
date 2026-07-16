'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

const SYSTEM_PROMPT = `You are a knowledgeable paralegal assistant for Broussard Legal Services, a professional legal services firm. Your role is to provide helpful, accurate paralegal guidance to prospects and clients who have case questions.

You can assist with:
- General questions about legal processes and procedures
- Explaining legal terminology and concepts
- Guidance on document preparation and what to expect
- Information about litigation support, contract review, legal research, document drafting, case management, and deposition prep
- Helping prospects understand if Broussard Legal Services can help with their situation

Important guidelines:
- Always clarify you are an AI paralegal assistant, not a licensed attorney
- Do not provide specific legal advice or attorney-client privileged communications
- For complex matters, recommend scheduling a consultation with the firm
- Be professional, empathetic, and thorough in your responses
- Keep responses concise but complete
- If asked about pricing, direct them to the /pricing page
- If asked to book a consultation, direct them to /availability
- Always maintain confidentiality and professionalism`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Simple markdown renderer — avoids react-markdown webpack issues with React 19
function SimpleMarkdown({ children }: { children: string }) {
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside my-1 space-y-0.5">
          {items.map((item, j) => <li key={j} className="text-sm">{item}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside my-1 space-y-0.5">
          {items.map((item, j) => <li key={j} className="text-sm">{item}</li>)}
        </ol>
      );
      continue;
    } else if (line.trim() === '') {
      if (elements.length > 0) {
        elements.push(<br key={i} />);
      }
    } else {
      // Inline formatting: bold and italic
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-black/10 px-1 rounded text-xs">$1</code>');
      elements.push(
        <p key={i} className="text-sm leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    }
    i++;
  }

  return <>{elements}</>;
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSignUpNudge, setShowSignUpNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasGreeted = useRef(false);

  const { user, loading: authLoading } = useAuth();
  const { response, isLoading, error, sendMessage } = useChat(
    'ANTHROPIC',
    'claude-sonnet-4-6',
    true
  );

  // Show toast on error
  useEffect(() => {
    if (error) {
      const msg = error.message || '';
      if (msg.includes('busy') || msg.includes('429') || msg.includes('rate')) {
        toast.error('The assistant is busy right now. Please wait a moment and try again.');
      } else if (msg.includes('unavailable') || msg.includes('502') || msg.includes('503')) {
        toast.error('The AI service is temporarily unavailable. Please try again shortly.');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  }, [error]);

  // Initialize greeting when opened
  useEffect(() => {
    if (open && !hasGreeted.current) {
      hasGreeted.current = true;
      setMessages([
        {
          role: 'assistant',
          content: "Hi! 👋 I'm the Broussard Legal Services paralegal assistant. I can answer your case questions and provide instant guidance on legal processes, document preparation, and more.\n\nWhat can I help you with today?",
        },
      ]);
    }
  }, [open]);

  // Track streaming response
  useEffect(() => {
    if (isLoading) {
      setStreamingContent(response);
    } else if (response && !isLoading) {
      // Streaming complete — commit to messages
      if (response.trim()) {
        setMessages((prev) => {
          // Avoid duplicating if already added
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.content === response) return prev;
          return [...prev, { role: 'assistant', content: response }];
        });
      }
      setStreamingContent('');
    }
  }, [response, isLoading]);

  // Show sign-up nudge after 3 user messages for unauthenticated users
  useEffect(() => {
    if (authLoading || user || nudgeDismissed) return;
    const userMsgCount = messages.filter((m) => m.role === 'user').length;
    if (userMsgCount >= 3 && !showSignUpNudge) {
      setShowSignUpNudge(true);
    }
  }, [messages, user, authLoading, nudgeDismissed, showSignUpNudge]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, showSignUpNudge]);

  // Focus textarea when opened
  useEffect(() => {
    if (open && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value || isLoading) return;

    const userMessage: Message = { role: 'user', content: value };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    sendMessage(apiMessages, { max_tokens: 1024, temperature: 0.7 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! 👋 I'm the Broussard Legal Services paralegal assistant. I can answer your case questions and provide instant guidance on legal processes, document preparation, and more.\n\nWhat can I help you with today?",
      },
    ]);
    setStreamingContent('');
    setInput('');
    setShowSignUpNudge(false);
    hasGreeted.current = true;
  };

  const suggestedQuestions = [
    'What documents do I need for a deposition?',
    'How does the litigation process work?',
    'Can you help with contract review?',
    'What is legal research support?',
  ];

  const showSuggestions = messages.length === 1 && !isLoading;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close chat' : 'Chat with our paralegal assistant'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all duration-300 hover:scale-105"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Unread indicator dot */}
      {!open && (
        <span className="fixed bottom-[74px] right-6 z-50 w-3 h-3 rounded-full bg-green-400 border-2 border-background" aria-hidden="true" />
      )}

      {/* Chat window */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paralegal assistant chat"
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '560px' }}
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Paralegal Assistant</p>
              <p className="text-xs text-white/70">Broussard Legal Services · AI-powered</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetChat}
                title="New conversation"
                aria-label="Start new conversation"
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                </svg>
              </button>
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Online" />
            </div>
          </div>

          {/* Disclaimer banner */}
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 shrink-0">
            <p className="text-xs text-amber-700 leading-snug">
              <strong>Note:</strong> This is an AI paralegal assistant, not a licensed attorney. For legal advice, please{' '}
              <a href="/availability" className="underline font-medium hover:text-amber-900">schedule a consultation</a>.
            </p>
          </div>

          {/* Messages */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ?'bg-primary text-primary-foreground rounded-tr-sm' :'bg-secondary text-foreground rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1 prose-a:text-primary prose-a:underline">
                      <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {isLoading && streamingContent && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-secondary text-foreground text-sm leading-relaxed">
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1 prose-a:text-primary prose-a:underline">
                    <SimpleMarkdown>{streamingContent}</SimpleMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator (before first chunk) */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-secondary flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-xs text-muted-foreground px-1">Quick questions:</p>
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="text-left px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Sign-up nudge for unauthenticated users after 3 messages */}
            {showSignUpNudge && !user && !nudgeDismissed && (
              <div className="mx-1 mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 shrink-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="19" y1="8" x2="19" y2="14"/>
                        <line x1="22" y1="11" x2="16" y2="11"/>
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground">Save your conversation</p>
                  </div>
                  <button
                    onClick={() => setNudgeDismissed(true)}
                    aria-label="Dismiss"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Create a free client account to save this conversation, track your case status, manage bookings, and access your documents.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/portal/register"
                    onClick={() => setOpen(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Create Account
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </Link>
                  <Link
                    href="/portal/login"
                    onClick={() => setOpen(false)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-border px-3 py-3 flex gap-2 items-end shrink-0"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a case question…"
              disabled={isLoading}
              rows={1}
              aria-label="Type your legal question"
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none overflow-hidden disabled:opacity-50"
              style={{ minHeight: '38px', maxHeight: '96px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 96) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {isLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-between shrink-0">
            {user ? (
              <>
                <Link href="/portal/dashboard" className="text-xs text-primary hover:underline font-medium">
                  My Portal →
                </Link>
                <a href="/availability" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Book consultation
                </a>
              </>
            ) : (
              <>
                <a href="/availability" className="text-xs text-primary hover:underline font-medium">
                  Book a consultation →
                </a>
                <Link href="/portal/register" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
