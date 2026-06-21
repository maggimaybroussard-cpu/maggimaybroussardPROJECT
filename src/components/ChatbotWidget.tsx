'use client';

import React, { useState, useRef, useEffect } from 'react';
import { pushConversationToBroussard } from '@/lib/broussard';

const serviceOptions = [
  'Litigation Support',
  'Contract Review',
  'Legal Research',
  'Document Drafting',
  'Case Management',
  'Deposition Prep',
  'Other / Multiple Services',
];

type Step = 'greeting' | 'service' | 'name' | 'firm' | 'email' | 'submitting' | 'done' | 'error';

interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
}

interface LeadData {
  service: string;
  name: string;
  firm: string;
  email: string;
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [lead, setLead] = useState<Partial<LeadData>>({});
  const [emailError, setEmailError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize greeting when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          from: 'bot',
          text: "Hi! 👋 I'm here to help connect you with Broussard Legal Services. What type of legal support are you looking for?",
        },
      ]);
      setStep('service');
    }
  }, [open, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when step changes
  useEffect(() => {
    if (open && step !== 'service' && step !== 'submitting' && step !== 'done' && step !== 'error') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step, open]);

  const addMessage = (from: 'bot' | 'user', text: string) => {
    setMessages((prev) => [...prev, { from, text }]);
  };

  const handleServiceSelect = (service: string) => {
    setLead((prev) => ({ ...prev, service }));
    addMessage('user', service);
    setTimeout(() => {
      addMessage('bot', `Great choice! I can definitely help with ${service}. What's your name?`);
      setStep('name');
    }, 400);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput('');

    if (step === 'name') {
      if (value.length < 2) {
        addMessage('bot', 'Please enter your full name (at least 2 characters).');
        return;
      }
      setLead((prev) => ({ ...prev, name: value }));
      addMessage('user', value);
      setTimeout(() => {
        addMessage('bot', `Nice to meet you, ${value.split(' ')[0]}! What firm or company are you with? (Type "solo" if you're a solo practitioner)`);
        setStep('firm');
      }, 400);
    } else if (step === 'firm') {
      setLead((prev) => ({ ...prev, firm: value }));
      addMessage('user', value);
      setTimeout(() => {
        addMessage('bot', "Perfect. Last step — what's the best email address to reach you?");
        setStep('email');
      }, 400);
    } else if (step === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setEmailError('Please enter a valid email address.');
        addMessage('bot', 'That email address doesn\'t look right. Could you double-check it?');
        return;
      }
      setEmailError('');
      setLead((prev) => ({ ...prev, email: value }));
      addMessage('user', value);
      await submitLead({ ...lead, email: value } as LeadData);
    }
  };

  const submitLead = async (finalLead: LeadData) => {
    setStep('submitting');
    addMessage('bot', 'Perfect! Let me send your information to Maggi now…');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/capture-chatbot-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: finalLead.name,
          email: finalLead.email,
          firm: finalLead.firm,
          service: finalLead.service,
          message: `Pre-qualified via chatbot. Service interest: ${finalLead.service}`,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');

      // Sync conversation to Broussard app
      await pushConversationToBroussard({
        id: `chatbot-${Date.now()}`,
        title: `Chatbot inquiry — ${finalLead.service} (${finalLead.name})`,
        messages: messages.map((m) => ({ role: m.from === 'bot' ? 'assistant' : 'user', content: m.text })),
      });

      setTimeout(() => {
        addMessage(
          'bot',
          `You're all set, ${finalLead.name.split(' ')[0]}! 🎉 Maggi will be in touch within one business day. Check your inbox — a welcome email is on its way!`
        );
        setStep('done');
      }, 600);
    } catch {
      setTimeout(() => {
        addMessage('bot', 'Hmm, something went wrong. Please try the contact form instead — it only takes a minute!');
        setStep('error');
      }, 600);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setStep('greeting');
    setLead({});
    setInput('');
    setEmailError('');
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close chat' : 'Open chat — get a quick quote'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all duration-300 hover:scale-105"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat with Broussard Legal Services"
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '520px' }}
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Broussard Legal Services</p>
              <p className="text-xs text-white/70">Legal Services · Typically replies in 1 day</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Online" />
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
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'bot' ?'bg-secondary text-foreground rounded-tl-sm' :'bg-primary text-primary-foreground rounded-tr-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Service selection buttons */}
            {step === 'service' && (
              <div className="flex flex-col gap-2 mt-1">
                {serviceOptions.map((svc) => (
                  <button
                    key={svc}
                    onClick={() => handleServiceSelect(svc)}
                    className="text-left px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground hover:border-accent hover:bg-accent/5 transition-all duration-200"
                  >
                    {svc}
                  </button>
                ))}
              </div>
            )}

            {/* Done state CTA */}
            {step === 'done' && (
              <div className="flex flex-col gap-2 mt-1">
                <a
                  href="/availability"
                  className="text-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Book a Free Consultation →
                </a>
                <button
                  onClick={resetChat}
                  className="text-center px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Start over
                </button>
              </div>
            )}

            {/* Error state CTA */}
            {step === 'error' && (
              <div className="flex flex-col gap-2 mt-1">
                <a
                  href="/contact"
                  className="text-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Go to Contact Form →
                </a>
                <button
                  onClick={resetChat}
                  className="text-center px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Text input */}
          {(step === 'name' || step === 'firm' || step === 'email') && (
            <form onSubmit={handleTextSubmit} className="border-t border-border px-4 py-3 flex gap-2">
              <input
                ref={inputRef}
                type={step === 'email' ? 'email' : 'text'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label={
                  step === 'name' ? 'Enter your full name' :
                  step === 'firm' ? 'Enter your firm name' : 'Enter your email address'
                }
                placeholder={
                  step === 'name' ? 'Your full name…' :
                  step === 'firm'? 'Firm name or "solo"…' : 'your@email.com'
                }
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>
          )}

          {step === 'submitting' && (
            <div className="border-t border-border px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Sending your information…
            </div>
          )}
        </div>
      )}
    </>
  );
}
