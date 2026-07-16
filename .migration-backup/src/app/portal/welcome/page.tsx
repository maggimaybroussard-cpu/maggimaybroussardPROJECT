'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WalkthroughStep {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
  tips: string[];
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconDocuments() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconMessages() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconInvoices() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}
function IconCases() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ── Walkthrough Steps Data ────────────────────────────────────────────────────
const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 1,
    icon: <IconDashboard />,
    title: 'Your Dashboard',
    description: 'Your home base. See your active case status, upcoming deadlines, recent messages, and pending invoices — all in one place.',
    action: { label: 'Go to Dashboard', href: '/portal/dashboard' },
    tips: [
      'Case status updates in real time as Maggi May progresses your matter',
      'Upcoming deadlines and consultations appear in the timeline panel',
      'Unread message badges keep you informed at a glance',
    ],
  },
  {
    id: 2,
    icon: <IconCases />,
    title: 'Case Details',
    description: 'View the full context of your matter: milestones, documents, messages, invoices, and tasks — all organized in one unified view.',
    action: { label: 'View My Cases', href: '/portal/cases' },
    tips: [
      'Each case has its own detail page with 5 organized tabs',
      'Track milestones from Intake → Active → Billed → Closed',
      'Admin notes and case updates appear in the Overview tab',
    ],
  },
  {
    id: 3,
    icon: <IconDocuments />,
    title: 'Case Documents',
    description: 'Upload, download, and e-sign all case-related files. Your documents are encrypted, organized by category, and always accessible.',
    action: { label: 'View Documents', href: '/portal/documents' },
    tips: [
      'Upload supporting documents directly from your browser — no email needed',
      'Pending e-signatures appear at the top of your documents list',
      'All files are AES-256 encrypted and stored securely in the cloud',
      'Download any document at any time for your own records',
    ],
  },
  {
    id: 4,
    icon: <IconMessages />,
    title: 'Secure Messaging',
    description: 'Communicate directly with Maggi May through the portal. All messages are private, threaded, and timestamped for your records.',
    action: { label: 'Open Messages', href: '/portal/messages' },
    tips: [
      'Send a message any time — Maggi May typically responds within 1 business day',
      'Double-checkmarks confirm when your message has been read',
      'Attach documents or reference case files directly in a message',
      'All conversations are confidential and stored securely',
    ],
  },
  {
    id: 5,
    icon: <IconInvoices />,
    title: 'Invoices & Billing',
    description: 'View all invoices, pay securely online, and track your retainer balance. No more chasing paper invoices.',
    action: { label: 'View Billing', href: '/portal/billing' },
    tips: [
      'Invoices are issued on the 1st of each month with Net 15 payment terms',
      'Pay securely by card directly from the portal — no login to a separate system',
      'Your retainer balance and hours used are always visible',
      'Payment receipts are automatically emailed to you',
    ],
  },
];

// ── Quick-Start Checklist ─────────────────────────────────────────────────────
const QUICK_START_ITEMS = [
  { id: 'profile', label: 'Complete your profile', href: '/portal/settings', detail: 'Add your phone number and notification preferences' },
  { id: 'documents', label: 'Review your retainer agreement', href: '/portal/documents', detail: 'Your signed agreement is in the Documents section' },
  { id: 'case', label: 'Check your case status', href: '/portal/cases', detail: 'See where your matter stands in the pipeline' },
  { id: 'messages', label: 'Send your first message', href: '/portal/messages', detail: 'Introduce yourself or ask any initial questions' },
  { id: 'billing', label: 'Review your billing setup', href: '/portal/billing', detail: 'Confirm your payment method and invoice preferences' },
];

// ── Step Card ─────────────────────────────────────────────────────────────────
function WalkthroughCard({
  step,
  isActive,
  isCompleted,
  onClick,
}: {
  step: WalkthroughStep;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-200 ${
        isActive
          ? 'border-primary/40 bg-primary/5 shadow-sm'
          : isCompleted
          ? 'border-emerald-200 bg-emerald-50/50' :'border-border bg-card hover:border-primary/20 hover:bg-primary/3'
      }`}
    >
      <div className="p-4 flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? 'bg-primary text-primary-foreground'
              : isCompleted
              ? 'bg-emerald-100 text-emerald-700' :'bg-muted/60 text-muted-foreground'
          }`}
        >
          {isCompleted ? <IconCheck /> : step.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isActive ? 'text-primary' : isCompleted ? 'text-emerald-700' : 'text-foreground'}`}>
              {step.title}
            </span>
            {isCompleted && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Done</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 font-light">{step.description}</p>
        </div>
        <div className={`shrink-0 mt-1 transition-transform duration-200 ${isActive ? 'rotate-90' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalWelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  const currentStep = WALKTHROUGH_STEPS.find((s) => s.id === activeStep)!;

  const handleStepClick = (stepId: number) => {
    if (activeStep !== stepId) {
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
    }
    setActiveStep(stepId);
  };

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, activeStep]));
    if (activeStep < WALKTHROUGH_STEPS.length) {
      setActiveStep(activeStep + 1);
    }
  };

  const toggleChecklist = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const firstName = user?.user_metadata?.fullName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';
  const allWalkthroughDone = completedSteps.size >= WALKTHROUGH_STEPS.length;
  const checklistProgress = checkedItems.size;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {[
                { href: '/portal/dashboard', label: 'Dashboard' },
                { href: '/portal/cases', label: 'Cases' },
                { href: '/portal/documents', label: 'Documents' },
                { href: '/portal/messages', label: 'Messages' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                Go to Dashboard
                <IconArrowRight />
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
              >
                {signingOut ? '…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {/* ── Welcome Hero ── */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
            <span className="text-amber-500"><IconStar /></span>
            Welcome to Your Portal
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
            Welcome, {firstName}!
          </h1>
          <p className="text-base text-muted-foreground font-light max-w-2xl leading-relaxed">
            Your client portal is fully activated. This guide will walk you through everything you need to know — from accessing your case documents to messaging Maggi May directly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Walkthrough Steps List ── */}
          <div className="lg:col-span-1 space-y-2.5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Portal Walkthrough</h2>
              <span className="text-xs text-muted-foreground">
                {completedSteps.size}/{WALKTHROUGH_STEPS.length} done
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-muted/40 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps.size / WALKTHROUGH_STEPS.length) * 100}%` }}
              />
            </div>
            {WALKTHROUGH_STEPS.map((step) => (
              <WalkthroughCard
                key={step.id}
                step={step}
                isActive={activeStep === step.id}
                isCompleted={completedSteps.has(step.id)}
                onClick={() => handleStepClick(step.id)}
              />
            ))}
          </div>

          {/* ── Right: Step Detail + Quick-Start ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Step Detail Card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Card header */}
              <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, #4A3728 0%, #3A2A1E 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                    {currentStep.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-amber-300/80 mb-0.5">
                      Step {currentStep.id} of {WALKTHROUGH_STEPS.length}
                    </div>
                    <h3 className="font-serif text-xl text-white">{currentStep.title}</h3>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
                  {currentStep.description}
                </p>

                {/* Tips */}
                <div className="bg-muted/30 rounded-xl p-4 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What to know</p>
                  <ul className="space-y-2.5">
                    {currentStep.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground font-light">
                        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <IconCheck />
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action + Navigation */}
                <div className="flex items-center gap-3 flex-wrap">
                  {currentStep.action && (
                    <Link
                      href={currentStep.action.href}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                      {currentStep.action.label}
                      <IconArrowRight />
                    </Link>
                  )}
                  {activeStep < WALKTHROUGH_STEPS.length ? (
                    <button
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-muted/40 transition-colors"
                    >
                      Next Step
                      <IconArrowRight />
                    </button>
                  ) : (
                    <Link
                      href="/portal/dashboard"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                    >
                      Go to Dashboard
                      <IconArrowRight />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* ── Quick-Start Checklist ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg text-foreground">Quick-Start Checklist</h3>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">Complete these 5 steps to get fully set up</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-serif text-primary">{checklistProgress}<span className="text-base text-muted-foreground font-light">/{QUICK_START_ITEMS.length}</span></div>
                  <div className="text-xs text-muted-foreground">completed</div>
                </div>
              </div>

              {/* Checklist progress bar */}
              <div className="h-1 bg-muted/30 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(checklistProgress / QUICK_START_ITEMS.length) * 100}%`,
                    background: 'linear-gradient(to right, #C8965A, #4A3728)',
                  }}
                />
              </div>

              <div className="divide-y divide-border/50">
                {QUICK_START_ITEMS.map((item) => {
                  const checked = checkedItems.has(item.id);
                  return (
                    <div key={item.id} className={`px-6 py-4 flex items-center gap-4 transition-colors ${checked ? 'bg-emerald-50/40' : 'hover:bg-muted/20'}`}>
                      <button
                        onClick={() => toggleChecklist(item.id)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                          checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {checked && <IconCheck />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground font-light mt-0.5">{item.detail}</p>
                      </div>
                      <Link
                        href={item.href}
                        className="shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        Go <IconArrowRight />
                      </Link>
                    </div>
                  );
                })}
              </div>

              {checklistProgress === QUICK_START_ITEMS.length && (
                <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                    <IconCheck />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">You're all set!</p>
                    <p className="text-xs text-emerald-700 font-light">Your portal is fully configured. Head to your dashboard to get started.</p>
                  </div>
                  <Link
                    href="/portal/dashboard"
                    className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-widest hover:bg-emerald-700 transition-colors shrink-0"
                  >
                    Dashboard <IconArrowRight />
                  </Link>
                </div>
              )}
            </div>

            {/* ── Contact Card ── */}
            <div className="bg-card border border-border rounded-2xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary shrink-0">
                <IconShield />
              </div>
              <div className="flex-1">
                <h4 className="font-serif text-base text-foreground mb-1">Need help getting started?</h4>
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-3">
                  Maggi May is here to help. Send a message through the portal or reach out directly by email — all communications are confidential.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href="/portal/messages"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    <IconMessages />
                    Send a Message
                  </Link>
                  <a
                    href="mailto:maggimaybroussard@gmail.com"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    <IconMail />
                    maggimaybroussard@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
