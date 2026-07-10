'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/maggimaybroussard/45min';

const WHAT_WE_COVER = [
  {
    title: 'Your Case Priorities',
    body: 'We map out the specific legal support you need — research, drafting, discovery, or trial prep — and identify the highest-leverage starting point.',
  },
  {
    title: 'Workflow & Deadlines',
    body: 'Review your current caseload, upcoming court dates, and bottlenecks so we can build a support structure that fits your practice.',
  },
  {
    title: 'Engagement Options',
    body: 'Walk through retainer, project-based, and hourly arrangements. Leave with a clear picture of what working together looks like — no pressure.',
  },
];

const WHAT_TO_BRING = [
  'A brief overview of your current matters or upcoming projects',
  'Any specific deadlines or court dates on your radar',
  'Questions about how paralegal support integrates with your workflow',
  'Your preferred communication style and turnaround expectations',
];

// Generate next 14 available weekdays
function generateAvailableDates(): { label: string; value: string; dayName: string; iso: string }[] {
  const dates: { label: string; value: string; dayName: string; iso: string }[] = [];
  const d = new Date();
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
        iso: d.toISOString().split('T')[0],
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

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

type Step = 1 | 2 | 3;

interface FormData {
  date: string;
  time: string;
  name: string;
  email: string;
  firm: string;
  phone: string;
  focus: string;
  referralSource: string;
  smsConsent: boolean;
}

export default function StrategySessionPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    date: '',
    time: '',
    name: '',
    email: '',
    firm: '',
    phone: '',
    focus: '',
    referralSource: '',
    smsConsent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [dates, setDates] = useState<ReturnType<typeof generateAvailableDates>>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  useEffect(() => {
    setDates(generateAvailableDates());
    setTimeSlots(generateTimeSlots());
  }, []);

  const canProceedStep1 = !!form.date && !!form.time;
  const canProceedStep2 = !!form.name && !!form.email && !!form.focus && form.smsConsent;

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
          service: 'Strategy Session (45 min)',
          date: form.date,
          time: form.time,
          caseSummary: form.focus,
          firm: form.firm,
          phone: form.phone,
          referralSource: form.referralSource,
        }),
      });
      if (!res.ok) throw new Error('Failed to send confirmation');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels: Record<Step, string> = { 1: 'Pick a Time', 2: 'Your Details', 3: 'Confirm' };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">

        {/* Hero */}
        <section
          className="relative pt-28 pb-14 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e3a24 0%, #2d5a35 50%, #355E3B 100%)' }}
        >
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute top-16 left-8 w-2 h-2 rounded-full bg-white/20 pointer-events-none" />
          <div className="absolute bottom-8 right-16 w-3 h-3 rounded-full bg-white/15 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-3xl mx-auto relative z-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-8 transition-colors duration-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to Services
            </Link>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                >
                  Complimentary · 45 Minutes
                </span>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-4">
                  Strategy
                  <br />
                  <span className="italic opacity-80">Session</span>
                </h1>
                <p className="text-white/75 text-base md:text-lg leading-relaxed max-w-lg">
                  A focused, no-obligation conversation to understand your practice needs and map out exactly how paralegal support can move your cases forward.
                </p>
              </div>

              <div
                className="flex-shrink-0 rounded-2xl p-5 md:p-6 min-w-[200px]"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="text-white/50 text-xs uppercase tracking-widest mb-3">Session Details</div>
                <div className="space-y-2.5">
                  {[
                    { icon: 'clock', label: '45 minutes' },
                    { icon: 'video', label: 'Google Meet' },
                    { icon: 'shield', label: 'No obligation' },
                    { icon: 'mail', label: 'Instant confirmation' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-white/85 text-sm">
                      <span className="w-5 h-5 flex items-center justify-center opacity-60">
                        {icon === 'clock' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                        )}
                        {icon === 'video' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                        )}
                        {icon === 'shield' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                        )}
                        {icon === 'mail' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                          </svg>
                        )}
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What We Cover */}
        <section className="py-12 md:py-16 px-5 md:px-10 border-b border-border">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <span className="w-6 h-px bg-accent" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">What We Cover</span>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {WHAT_WE_COVER.map((item, i) => (
                <div
                  key={item.title}
                  className="rounded-xl p-6"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-4"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Booking Form */}
        {!submitted ? (
          <section className="py-12 md:py-16 px-5 md:px-10">
            <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_300px] gap-8 items-start">

              {/* Form */}
              <div>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-8">
                  {([1, 2, 3] as Step[]).map((s) => (
                    <React.Fragment key={s}>
                      <button
                        onClick={() => s < step && setStep(s)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                          step === s
                            ? 'bg-accent text-white'
                            : s < step
                            ? 'text-accent cursor-pointer hover:bg-accent/10' :'text-muted-foreground cursor-default'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            step === s ? 'bg-white/20' : s < step ? 'bg-accent/20' : 'bg-muted'
                          }`}
                        >
                          {s < step ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : s}
                        </span>
                        {stepLabels[s]}
                      </button>
                      {s < 3 && <span className="w-6 h-px bg-border flex-shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>

                {/* Step 1: Date & Time */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-3">Select a Date</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {dates.map((d) => (
                          <button
                            key={d.iso}
                            onClick={() => setForm((f) => ({ ...f, date: d.value }))}
                            className={`rounded-xl p-3 text-center transition-all duration-150 border ${
                              form.date === d.value
                                ? 'border-accent bg-accent/10 text-accent' :'border-border hover:border-accent/50 text-foreground'
                            }`}
                          >
                            <div className="text-xs text-muted-foreground mb-0.5">{d.dayName}</div>
                            <div className="text-sm font-semibold">{d.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.date && (
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-3">Select a Time</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {timeSlots.map((t) => (
                            <button
                              key={t}
                              onClick={() => setForm((f) => ({ ...f, time: t }))}
                              className={`rounded-lg py-2.5 text-sm font-medium transition-all duration-150 border ${
                                form.time === t
                                  ? 'border-accent bg-accent/10 text-accent' :'border-border hover:border-accent/50 text-foreground'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setStep(2)}
                      disabled={!canProceedStep1}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: canProceedStep1 ? 'var(--accent)' : undefined, color: canProceedStep1 ? 'white' : undefined, border: canProceedStep1 ? 'none' : '1px solid var(--border)' }}
                    >
                      Continue to Your Details
                    </button>
                  </div>
                )}

                {/* Step 2: Contact Details */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Full Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Jane Smith"
                          className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Email Address <span className="text-red-500">*</span></label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="jane@lawfirm.com"
                          className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Law Firm / Organization</label>
                        <input
                          type="text"
                          value={form.firm}
                          onChange={(e) => setForm((f) => ({ ...f, firm: e.target.value }))}
                          placeholder="Smith & Associates"
                          className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="(555) 000-0000"
                          className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">
                        What would you like to focus on? <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={form.focus}
                        onChange={(e) => setForm((f) => ({ ...f, focus: e.target.value }))}
                        rows={4}
                        placeholder="Briefly describe your current caseload, the type of support you're looking for, or any specific challenges you'd like to address in our session..."
                        className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">How did you hear about us?</label>
                      <select
                        value={form.referralSource}
                        onChange={(e) => setForm((f) => ({ ...f, referralSource: e.target.value }))}
                        className="w-full rounded-xl px-4 py-3 text-sm border border-border bg-background text-foreground focus:outline-none focus:border-accent transition-colors"
                      >
                        <option value="">Select an option</option>
                        <option value="email">Email newsletter</option>
                        <option value="referral">Referral from colleague</option>
                        <option value="search">Google / search</option>
                        <option value="social">Social media</option>
                        <option value="bar-association">Bar association</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* SMS Consent */}
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3.5">
                      <input
                        id="smsConsentStrategy"
                        type="checkbox"
                        checked={form.smsConsent}
                        onChange={(e) => setForm((f) => ({ ...f, smsConsent: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-accent"
                      />
                      <label htmlFor="smsConsentStrategy" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        By checking this box, I consent to receive SMS text messages from Broussard Legal Services at the phone number provided (if applicable). Message frequency varies. Message &amp; data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. View our{' '}
                        <a href="/privacy-policy" className="text-accent underline hover:opacity-80">Privacy Policy</a>{' '}
                        and{' '}
                        <a href="/terms-of-service" className="text-accent underline hover:opacity-80">Terms of Service</a>.
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="px-5 py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setStep(3)}
                        disabled={!canProceedStep2}
                        className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: canProceedStep2 ? 'var(--accent)' : undefined, color: canProceedStep2 ? 'white' : undefined, border: canProceedStep2 ? 'none' : '1px solid var(--border)' }}
                      >
                        Review & Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div
                      className="rounded-xl p-5 space-y-4"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                      <h3 className="font-semibold text-foreground text-sm uppercase tracking-widest">Session Summary</h3>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        {[
                          { label: 'Date', value: form.date },
                          { label: 'Time', value: form.time },
                          { label: 'Name', value: form.name },
                          { label: 'Email', value: form.email },
                          form.firm ? { label: 'Firm', value: form.firm } : null,
                          form.phone ? { label: 'Phone', value: form.phone } : null,
                        ].filter(Boolean).map((item) => (
                          <div key={item!.label}>
                            <span className="text-muted-foreground">{item!.label}: </span>
                            <span className="text-foreground font-medium">{item!.value}</span>
                          </div>
                        ))}
                      </div>
                      {form.focus && (
                        <div className="pt-3 border-t border-border">
                          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Focus Area</div>
                          <p className="text-sm text-foreground leading-relaxed">{form.focus}</p>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep(2)}
                        className="px-5 py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60"
                        style={{ background: 'var(--accent)' }}
                      >
                        {submitting ? 'Booking…' : 'Confirm Strategy Session'}
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      A confirmation email will be sent to {form.email} with your Google Meet link.
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-5 lg:sticky lg:top-24">
                {/* What to bring */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <h3 className="font-semibold text-foreground text-sm mb-4">What to Bring</h3>
                  <ul className="space-y-3">
                    {WHAT_TO_BRING.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contact fallback */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <h3 className="font-semibold text-foreground text-sm mb-3">Prefer to reach out directly?</h3>
                  <div className="space-y-2.5">
                    <a
                      href="mailto:maggi@broussardlegalservices.com"
                      className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-accent transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                      maggi@broussardlegalservices.com
                    </a>
                    <a
                      href="https://wa.me/18444936819"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-accent transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      WhatsApp: 1-844-493-6819
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Confirmation */
          <section className="py-20 px-5 md:px-10">
            <div className="max-w-xl mx-auto text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'var(--accent)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">
                You&apos;re booked, {form.name.split(' ')[0]}
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-2">
                Your 45-minute strategy session is confirmed for
              </p>
              <p className="font-semibold text-foreground text-lg mb-6">
                {form.date} at {form.time}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                A confirmation email with your Google Meet link has been sent to <strong>{form.email}</strong>. Check your inbox — and your spam folder just in case.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/"
                  className="px-6 py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Back to Home
                </Link>
                <Link
                  href="/services"
                  className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: 'var(--accent)' }}
                >
                  Explore Services
                </Link>
              </div>
            </div>
          </section>
        )}

      </main>
      <Footer />
    </>
  );
}
