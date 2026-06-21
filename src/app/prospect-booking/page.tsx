'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const SERVICES = [
  {
    id: 'litigation-support',
    title: 'Litigation Support',
    description: 'Trial prep, exhibit organization, deposition summaries, and deadline tracking.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'legal-research',
    title: 'Legal Research',
    description: 'Statutory, regulatory, and case law research with clear memoranda and citations.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 'document-drafting',
    title: 'Document Drafting',
    description: 'Pleadings, motions, contracts, and correspondence to your firm&apos;s standards.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    id: 'contract-review',title: 'Contract Review',description: 'Risk clause identification, missing provisions, and annotated summaries.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'case-management',title: 'Case Management',description: 'File organization, deadline calendaring, and status tracking across matters.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'discovery-assistance',title: 'Discovery Assistance',description: 'Document review, privilege log preparation, and discovery management.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

// Generate time slots 8am–6pm in 30-min increments
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) break;
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const min = m === 0 ? '00' : '30';
      slots.push(`${hour12}:${min} ${ampm}`);
    }
  }
  return slots;
}

// Generate next 14 available weekdays
function generateAvailableDates(): { label: string; value: string; dayName: string }[] {
  const dates: { label: string; value: string; dayName: string }[] = [];
  const today = new Date();
  let d = new Date(today);
  d.setDate(d.getDate() + 1);
  while (dates.length < 14) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dates.push({
        dayName: dayNames[day],
        label: `${monthNames[d.getMonth()]} ${d.getDate()}`,
        value: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      });
    }
    d = new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const BUDGET_OPTIONS = [
  'Under $500',
  '$500 – $1,000',
  '$1,000 – $2,500',
  '$2,500 – $5,000',
  '$5,000+',
  'Retainer / Ongoing',
  'Not sure yet',
];

type Step = 1 | 2 | 3 | 4;

interface FormData {
  service: string;
  date: string;
  time: string;
  name: string;
  email: string;
  firm: string;
  caseSummary: string;
  budget: string;
}

export default function ProspectBookingPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    service: '',
    date: '',
    time: '',
    name: '',
    email: '',
    firm: '',
    caseSummary: '',
    budget: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const TIME_SLOTS = generateTimeSlots();
  const DATES = generateAvailableDates();

  const canProceedStep1 = !!form.service;
  const canProceedStep2 = !!form.date && !!form.time;
  const canProceedStep3 = !!form.name && !!form.email && !!form.caseSummary;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/prospect-booking/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          service: SERVICES.find((s) => s.id === form.service)?.title ?? form.service,
          date: form.date,
          time: form.time,
          caseSummary: form.caseSummary,
          firm: form.firm,
          budget: form.budget,
        }),
      });
      if (!res.ok) throw new Error('Failed to send confirmation');
      setSubmitted(true);
      setStep(4);
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedService = SERVICES.find((s) => s.id === form.service);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section
          className="relative pt-28 pb-14 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 55%, #4a7c52 100%)' }}
        >
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-2xl mx-auto text-center relative z-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-6 transition-colors duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to Services
            </Link>

            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
            >
              New Client Intake
            </span>

            <h1 className="font-serif text-3xl md:text-5xl text-white leading-tight mb-4">
              Request a
              <br />
              <span className="italic opacity-80">Consultation</span>
            </h1>
            <p className="text-white/75 text-base md:text-lg leading-relaxed max-w-lg mx-auto">
              Select your service, choose a time, and share your case details. Confirmation sent instantly.
            </p>
          </div>
        </section>

        {/* Step Progress */}
        {!submitted && (
          <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="max-w-3xl mx-auto px-5 py-4">
              <div className="flex items-center gap-0">
                {(['Service', 'Time Slot', 'Your Details'] as const).map((label, i) => {
                  const stepNum = (i + 1) as Step;
                  const isActive = step === stepNum;
                  const isDone = step > stepNum;
                  return (
                    <React.Fragment key={label}>
                      <button
                        onClick={() => isDone && setStep(stepNum)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                          isActive
                            ? 'bg-accent text-white'
                            : isDone
                            ? 'text-accent cursor-pointer hover:bg-accent/10' :'text-muted-foreground cursor-default'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isActive ? 'bg-white/20' : isDone ? 'bg-accent text-white' : 'bg-border'
                          }`}
                        >
                          {isDone ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            stepNum
                          )}
                        </span>
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                      {i < 2 && (
                        <div className={`flex-1 h-px mx-1 transition-colors duration-300 ${step > stepNum ? 'bg-accent' : 'bg-border'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 md:py-14">

          {/* ── STEP 1: Service Selection ── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">Select a Service</h2>
              <p className="text-muted-foreground text-sm mb-8">Choose the type of legal support you need.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                {SERVICES.map((svc) => {
                  const isSelected = form.service === svc.id;
                  return (
                    <button
                      key={svc.id}
                      onClick={() => setForm((f) => ({ ...f, service: svc.id }))}
                      className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected
                          ? 'border-accent bg-accent/5' :'border-border bg-card hover:border-accent/40 hover:bg-accent/3'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
                            isSelected ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {svc.icon}
                        </div>
                        <div>
                          <p className={`font-semibold text-sm mb-1 ${isSelected ? 'text-accent' : 'text-foreground'}`}>
                            {svc.title}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{svc.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => canProceedStep1 && setStep(2)}
                  disabled={!canProceedStep1}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Time Slot Selection ── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">Choose a Time Slot</h2>
              <p className="text-muted-foreground text-sm mb-8">All times are Central Time (CT). 30-minute sessions.</p>

              {/* Date picker */}
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Select Date</p>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {DATES.map((d) => {
                    const isSelected = form.date === d.value;
                    return (
                      <button
                        key={d.value}
                        onClick={() => setForm((f) => ({ ...f, date: d.value }))}
                        className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 min-w-[64px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isSelected ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/40'
                        }`}
                      >
                        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isSelected ? 'text-accent' : 'text-muted-foreground'}`}>
                          {d.dayName}
                        </span>
                        <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-accent' : 'text-foreground'}`}>
                          {d.label.split(' ')[1]}
                        </span>
                        <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-accent/70' : 'text-muted-foreground'}`}>
                          {d.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {form.date && (
                <div className="mb-10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Select Time</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = form.time === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setForm((f) => ({ ...f, time: slot }))}
                          className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            isSelected
                              ? 'border-accent bg-accent text-white' :'border-border bg-card text-foreground hover:border-accent/40'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!form.date && (
                <div className="mb-10 py-10 text-center text-muted-foreground text-sm">
                  Select a date above to see available times.
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:border-accent/40 transition-all duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => canProceedStep2 && setStep(3)}
                  disabled={!canProceedStep2}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Intake Details ── */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">Your Details</h2>
              <p className="text-muted-foreground text-sm mb-8">Help us prepare for your consultation.</p>

              {/* Booking summary card */}
              <div
                className="rounded-2xl p-4 mb-8 flex flex-wrap gap-4 items-center"
                style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.18)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.15)' }}>
                    {selectedService?.icon}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{selectedService?.title}</span>
                </div>
                <div className="w-px h-4 bg-border hidden sm:block" />
                <span className="text-sm text-muted-foreground">{form.date}</span>
                <div className="w-px h-4 bg-border hidden sm:block" />
                <span className="text-sm font-medium" style={{ color: '#355E3B' }}>{form.time} CT</span>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Full Name <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Email Address <span className="text-accent">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="jane@lawfirm.com"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Law Firm / Organization
                  </label>
                  <input
                    type="text"
                    value={form.firm}
                    onChange={(e) => setForm((f) => ({ ...f, firm: e.target.value }))}
                    placeholder="Smith & Associates LLP"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Case Summary <span className="text-accent">*</span>
                  </label>
                  <textarea
                    value={form.caseSummary}
                    onChange={(e) => setForm((f) => ({ ...f, caseSummary: e.target.value }))}
                    placeholder="Briefly describe your matter — the type of case, current stage, and what support you need..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">{form.caseSummary.length}/1000 characters</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Estimated Budget
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_OPTIONS.map((opt) => {
                      const isSelected = form.budget === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, budget: isSelected ? '' : opt }))}
                          className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            isSelected
                              ? 'border-accent bg-accent text-white' :'border-border bg-card text-foreground hover:border-accent/40'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:border-accent/40 transition-all duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canProceedStep3 || submitting}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      Confirm Booking
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Confirmation ── */}
          {step === 4 && submitted && (
            <div className="animate-fade-in text-center py-8">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(53,94,59,0.12)' }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                You're Confirmed
              </h2>
              <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto leading-relaxed">
                A confirmation email has been sent to <strong className="text-foreground">{form.email}</strong>. We'll be in touch before your session.
              </p>

              {/* Summary card */}
              <div
                className="rounded-2xl p-6 text-left max-w-md mx-auto mb-10"
                style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.18)' }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Booking Summary</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Service', value: selectedService?.title ?? form.service },
                    { label: 'Date', value: form.date },
                    { label: 'Time', value: `${form.time} CT` },
                    ...(form.firm ? [{ label: 'Firm', value: form.firm }] : []),
                    ...(form.budget ? [{ label: 'Budget', value: form.budget }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:border-accent/40 transition-all duration-200"
                >
                  Back to Home
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  View All Services
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
