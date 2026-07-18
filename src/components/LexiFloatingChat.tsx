'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import LexiCalendlyEmbed from './LexiCalendlyEmbed';
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
  showCalendly?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'What is litigation support?',
  'How can a paralegal help my law firm?',
  'What does contract review involve?',
  'How do I get started?',
];

// Generate a stable visitor ID for conversation memory
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'lexi_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// Detect high-intent signals for Airtable sync
function detectHighIntent(messages: Message[]): boolean {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length < 2) return false;
  const fullText = userMessages.map((m) => m.content).join(' ').toLowerCase();
  const signals = [
    'hire', 'cost', 'price', 'fee', 'how much', 'retainer', 'consult',
    'book', 'schedule', 'appointment', 'urgent', 'asap', 'deadline',
    'lawsuit', 'sue', 'court', 'contract', 'sign', 'review my',
    'help me', 'need a', 'looking for', 'interested in',
  ];
  return signals.some((s) => fullText.includes(s));
}

export default function LexiFloatingChat() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [calendlyDismissed, setCalendlyDismissed] = useState(false);
  const [airtableSynced, setAirtableSynced] = useState(false);

  // Email transcript state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [transcriptEmail, setTranscriptEmail] = useState('');
  const [sendingTranscript, setSendingTranscript] = useState(false);

  // SMS summary state
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  const userMessageCountRef = useRef(0);
  const hasTrackedStartRef = useRef(false);
  const visitorIdRef = useRef<string>('');

  // Initialize visitor ID on mount (client-only)
  useEffect(() => {
    visitorIdRef.current = getVisitorId();
    setMounted(true);
  }, []);

  // Track session start when chat opens
  useEffect(() => {
    if (open && !hasTrackedStartRef.current) {
      hasTrackedStartRef.current = true;
      sessionStartRef.current = Date.now();
      trackAssistantConversationStart('floating_chat');
    }
  }, [open]);

  // Track session end when chat closes
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
            "Hi! I'm Lexi, your AI legal assistant for Broussard Legal Services. I can answer general legal questions and help you understand how Maggi can support you. What's on your mind?",
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
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Focus email input when modal opens
  useEffect(() => {
    if (showEmailModal) {
      const timer = setTimeout(() => emailInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [showEmailModal]);

  // Sync high-intent lead to Airtable (fire-and-forget)
  const syncToAirtable = useCallback(
    async (currentMessages: Message[], intentScore: 'High' | 'Medium' | 'Low' = 'High') => {
      if (airtableSynced) return;
      setAirtableSynced(true);
      try {
        await fetch('/api/lexi/airtable-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages.map((m) => ({ role: m.role, content: m.content })),
            visitorId: visitorIdRef.current,
            intentScore,
          }),
        });
      } catch {
        // Non-blocking — sync failure should not affect chat
      }
    },
    [airtableSynced]
  );

  // Send transcript via email
  const handleSendTranscript = useCallback(async () => {
    const email = transcriptEmail.trim();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      toast.error('Start a conversation first, then request the transcript.');
      return;
    }

    setSendingTranscript(true);
    try {
      const res = await fetch('/api/lexi/email-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          visitorId: visitorIdRef.current,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Transcript sent! Check your inbox.');
        setShowEmailModal(false);
        setTranscriptEmail('');
      } else {
        toast.error(data.error ?? 'Could not send transcript. Please try again.');
      }
    } catch {
      toast.error('Could not send transcript. Please try again.');
    } finally {
      setSendingTranscript(false);
    }
  }, [transcriptEmail, messages]);

  // Send conversation summary via SMS
  const handleSendSmsSummary = useCallback(async () => {
    const phone = smsPhone.trim();
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      toast.error('Start a conversation first, then request the summary.');
      return;
    }

    // Build a short summary from the conversation
    const summary = messages
      .filter((m) => m.role === 'assistant')
      .slice(-2)
      .map((m) => m.content)
      .join(' ')
      .slice(0, 400);

    setSendingSms(true);
    try {
      const res = await fetch('/api/lexi/sms-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`,
          clientName: 'Lexi Chat User',
          summary,
          visitorId: visitorIdRef.current,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Summary sent to your phone!');
        setShowSmsModal(false);
        setSmsPhone('');
      } else {
        toast.error(data.error ?? 'Could not send SMS. Please try again.');
      }
    } catch {
      toast.error('Could not send SMS. Please try again.');
    } finally {
      setSendingSms(false);
    }
  }, [smsPhone, messages]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || rateLimited) return;

      userMessageCountRef.current += 1;
      const currentCount = userMessageCountRef.current;

      const newUserMsg: Message = { role: 'user', content: trimmed };
      const updatedMessages = [...messages, newUserMsg];
      setMessages(updatedMessages);
      setInput('');
      setIsLoading(true);
      setStreamingContent('');

      trackAssistantMessageSent({ messageCount: currentCount, source: 'floating_chat' });
      trackAssistantQueryTopic({ query: trimmed, messageCount: currentCount, source: 'floating_chat' });

      try {
        const res = await fetch('/api/lexi/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            visitorId: visitorIdRef.current,
            stream: true,
          }),
        });

        // Handle rate limiting
        if (res.status === 429) {
          const data = await res.json();
          setRateLimited(true);
          const errorMsg =
            data.error ?? "You've reached the message limit. Please book a consultation for personalized help.";
          // Show Calendly embed on rate limit
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: errorMsg, showCalendly: !calendlyDismissed },
          ]);
          setIsLoading(false);
          // Sync to Airtable on rate limit (they engaged enough)
          void syncToAirtable(updatedMessages, 'High');
          return;
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                "I'm having trouble answering that right now. For accurate guidance on your situation, I'd recommend booking a free consultation with Maggi — she can give you a clear path forward.",
              showCalendly: !calendlyDismissed,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // Handle non-streaming JSON response (cached or off-topic)
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
          setIsLoading(false);
          return;
        }

        // Stream response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let bookingIntentDetected = false;

        if (!reader) {
          setIsLoading(false);
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'chunk' && parsed.chunk?.content) {
                accumulated += parsed.chunk.content;
                setStreamingContent(accumulated);
              } else if (parsed.type === 'done') {
                // Detect booking intent in the response or user message
                const lowerAccumulated = accumulated.toLowerCase();
                const lowerUserText = trimmed.toLowerCase();
                bookingIntentDetected =
                  lowerAccumulated.includes('/availability') ||
                  lowerAccumulated.includes('book') ||
                  lowerAccumulated.includes('consult') ||
                  lowerUserText.includes('book') ||
                  lowerUserText.includes('schedule') ||
                  lowerUserText.includes('consult') ||
                  lowerUserText.includes('hire') ||
                  lowerUserText.includes('cost') ||
                  lowerUserText.includes('price');

                const showCalendly = bookingIntentDetected && !calendlyDismissed;

                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant' && last.content === accumulated) return prev;
                  return [...prev, { role: 'assistant', content: accumulated, showCalendly }];
                });
                setStreamingContent('');

                // Sync to Airtable if high intent detected
                const allMessages = [...updatedMessages, { role: 'assistant' as const, content: accumulated }];
                if (bookingIntentDetected || detectHighIntent(updatedMessages)) {
                  void syncToAirtable(allMessages, bookingIntentDetected ? 'High' : 'Medium');
                }
              } else if (parsed.type === 'error') {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content:
                      "I'm having trouble with that question. For personalized guidance, please book a free consultation with Maggi at /availability.",
                    showCalendly: !calendlyDismissed,
                  },
                ]);
                setStreamingContent('');
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
      } catch (err) {
        toast.error('Lexi is temporarily unavailable. Please try again.');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I'm temporarily unavailable. For immediate assistance, please book a consultation with Maggi at /availability.",
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingContent('');
      }
    },
    [isLoading, messages, rateLimited, calendlyDismissed, syncToAirtable]
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
          "Hi! I'm Lexi, your AI legal assistant for Broussard Legal Services. I can answer general legal questions and help you understand how Maggi can support you. What's on your mind?",
      },
    ]);
    setInput('');
    setStreamingContent('');
    setRateLimited(false);
    setCalendlyDismissed(false);
    setAirtableSynced(false);
    setShowEmailModal(false);
    setTranscriptEmail('');
  };

  const showSuggestions = messages.length <= 1 && !isLoading;
  const hasConversation = messages.filter((m) => m.role === 'user').length > 0;

  if (!mounted) return null;

  return (
    <>
      {/* Floating toggle button — right side */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close Lexi AI chat' : 'Ask Lexi — AI legal assistant'}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 h-14 rounded-full bg-[#1B2A4A] text-white shadow-lg hover:opacity-90 transition-all duration-300 hover:scale-105"
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

      {/* Chat panel — anchored to right side */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lexi AI Legal Assistant"
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '580px' }}
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
              {/* Email transcript button — visible once conversation has started */}
              {hasConversation && (
                <button
                  onClick={() => setShowEmailModal(true)}
                  aria-label="Email conversation transcript"
                  title="Email me this transcript"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </button>
              )}
              {/* SMS summary button */}
              {hasConversation && (
                <button
                  onClick={() => setShowSmsModal(true)}
                  aria-label="Send conversation summary via SMS"
                  title="Text me a summary"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              )}
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

          {/* Email transcript modal — overlays the messages area */}
          {showEmailModal && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl">
              <div className="bg-white rounded-xl shadow-xl mx-4 p-5 w-full max-w-xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm text-gray-900">Email Transcript</p>
                  <button
                    onClick={() => { setShowEmailModal(false); setTranscriptEmail(''); }}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Enter your email and we'll send you a copy of this conversation for your records.
                </p>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={transcriptEmail}
                  onChange={(e) => setTranscriptEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendTranscript(); }}
                  placeholder="your@email.com"
                  aria-label="Your email address"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 focus:border-[#1B2A4A]/50 transition-all mb-3"
                />
                <button
                  onClick={handleSendTranscript}
                  disabled={sendingTranscript || !transcriptEmail.trim()}
                  className="w-full py-2 rounded-lg bg-[#1B2A4A] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingTranscript ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Send Transcript
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* SMS summary modal */}
          {showSmsModal && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl">
              <div className="bg-white rounded-xl shadow-xl mx-4 p-5 w-full max-w-xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm text-gray-900">Text Me a Summary</p>
                  <button
                    onClick={() => { setShowSmsModal(false); setSmsPhone(''); }}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Enter your phone number and we'll text you a summary of this conversation.
                </p>
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendSmsSummary(); }}
                  placeholder="+1 (555) 000-0000"
                  aria-label="Your phone number"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 focus:border-[#1B2A4A]/50 transition-all mb-3"
                />
                <button
                  onClick={handleSendSmsSummary}
                  disabled={sendingSms || !smsPhone.trim()}
                  className="w-full py-2 rounded-lg bg-[#1B2A4A] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingSms ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Send Summary
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
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
                {/* Inline Calendly embed for booking-intent messages */}
                {msg.role === 'assistant' && msg.showCalendly && (
                  <div className="w-full pl-8 mt-1">
                    <LexiCalendlyEmbed
                      onBooked={() => {
                        setMessages((prev) =>
                          prev.map((m, idx) =>
                            idx === i ? { ...m, showCalendly: false } : m
                          )
                        );
                        // Sync booked status to Airtable
                        void syncToAirtable(messages, 'High');
                      }}
                      onDismiss={() => {
                        setCalendlyDismissed(true);
                        setMessages((prev) =>
                          prev.map((m, idx) =>
                            idx === i ? { ...m, showCalendly: false } : m
                          )
                        );
                      }}
                    />
                  </div>
                )}
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

            {/* CTA after conversation (only if Calendly not already shown) */}
            {messages.length >= 4 && !isLoading && calendlyDismissed && (
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

            {/* Email transcript prompt — appears after 3+ user messages */}
            {messages.filter((m) => m.role === 'user').length >= 3 && !isLoading && !showEmailModal && (
              <div className="mt-1 flex items-center justify-center">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1B2A4A] transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email me this transcript
                </button>
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
              placeholder={rateLimited ? 'Daily limit reached — book a consultation' : 'Ask a legal question…'}
              disabled={isLoading || rateLimited}
              aria-label="Type your legal question"
              className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 focus:border-[#1B2A4A]/50 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || rateLimited}
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
