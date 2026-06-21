'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConsultationScheduler from '@/components/ConsultationScheduler';

const TRUST_SIGNALS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Confidential',
    sub: 'Attorney-client privilege from first contact',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: 'Instant Confirmation',
    sub: 'Google Meet link sent to your inbox immediately',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    label: 'No Obligation',
    sub: 'Free initial consultation — no commitment required',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    label: 'Remote-Friendly',
    sub: 'Video, phone, or in-person — your choice',
  },
];

const WHAT_HAPPENS = [
  {
    num: '01',
    title: 'Pick a slot',
    body: 'Choose a date and time that fits your schedule. Weekday availability, 8 AM – 5 PM CST.',
  },
  {
    num: '02',
    title: 'Share your situation',
    body: 'A brief description of your legal matter so the consultation is focused and productive from minute one.',
  },
  {
    num: '03',
    title: 'Get your link',
    body: 'Instant confirmation email with your Google Meet link, calendar invite, and prep checklist.',
  },
  {
    num: '04',
    title: 'We talk strategy',
    body: 'Discuss your case, explore options, and leave with a clear next step — no vague advice.',
  },
];

interface BookingResult {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  meetingLink: string;
  emailSent: boolean;
}

export default function SchedulePage() {
  const [booked, setBooked] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<BookingResult | null>(null);

  const handleBookingComplete = (booking: BookingResult) => {
    setBookingDetails(booking);
    setBooked(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (booked && bookingDetails) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center px-5 py-32">
          <div className="max-w-lg w-full text-center">
            {/* Success icon */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(53,94,59,0.12)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
            >
              Consultation Booked
            </span>

            <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
              You&apos;re confirmed,{' '}
              <span className="italic" style={{ color: '#355E3B' }}>
                {bookingDetails.clientName.split(' ')[0]}
              </span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-8">
              Check your inbox — a confirmation email with your Google Meet link and calendar invite is on its way to{' '}
              <strong className="text-foreground">{bookingDetails.clientEmail}</strong>.
            </p>

            <div
              className="rounded-2xl border p-6 mb-8 text-left"
              style={{ borderColor: 'rgba(53,94,59,0.2)', background: 'rgba(53,94,59,0.04)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Booking Summary</p>
              <div className="space-y-3">
                {[
                  { label: 'Date', value: bookingDetails.bookingDate },
                  { label: 'Time', value: bookingDetails.bookingTime },
                  { label: 'Duration', value: `${bookingDetails.durationMinutes} minutes` },
                  { label: 'Format', value: 'Google Meet (link in email)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border"
                style={{ borderColor: 'rgba(53,94,59,0.4)', color: '#355E3B' }}
              >
                Back to Home
              </Link>
              <Link
                href="/services"
                className="px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest text-white transition-all duration-200 hover:opacity-90"
                style={{ background: '#355E3B' }}
              >
                Explore Services
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          className="relative pt-28 pb-16 px-5 md:px-10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e3d24 0%, #2d5a35 45%, #355E3B 70%, #4a7c52 100%)' }}
        >
          {/* Decorative rings */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/8 pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute top-1/2 -left-24 w-64 h-64 rounded-full border border-white/6 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="max-w-4xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <div>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 text-white/55 hover:text-white/85 text-xs font-medium uppercase tracking-widest mb-6 transition-colors duration-200"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Services
                </Link>

                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
                  style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.88)' }}
                >
                  Free Consultation
                </span>

                <h1 className="font-serif text-4xl md:text-6xl text-white leading-[1.05] mb-5">
                  Schedule Your
                  <br />
                  <span className="italic" style={{ opacity: 0.78 }}>Consultation</span>
                </h1>

                <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-md">
                  Pick a time that works for you. No phone tag, no waiting — instant confirmation with everything you need to prepare.
                </p>
              </div>

              {/* Trust signals — right side */}
              <div className="flex flex-col gap-3 md:min-w-[260px]">
                {TRUST_SIGNALS.map((t) => (
                  <div
                    key={t.label}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.09)' }}
                  >
                    <span className="text-white/80 mt-0.5 shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">{t.label}</p>
                      <p className="text-white/60 text-xs leading-snug mt-0.5">{t.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Main: Scheduler + How It Works ───────────────────────────────── */}
        <section className="py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_340px] gap-8 items-start">

            {/* Left: Scheduler */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-5 h-px bg-accent" />
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                  Choose Your Time
                </span>
              </div>
              <ConsultationScheduler onBookingComplete={handleBookingComplete} />
            </div>

            {/* Right: How It Works + FAQ */}
            <div className="flex flex-col gap-6 lg:sticky lg:top-24">

              {/* How it works */}
              <div
                className="rounded-2xl border p-6"
                style={{ borderColor: 'rgba(53,94,59,0.18)', background: 'rgba(53,94,59,0.03)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
                  What to Expect
                </p>
                <div className="flex flex-col gap-5">
                  {WHAT_HAPPENS.map((step) => (
                    <div key={step.num} className="flex gap-4">
                      <span
                        className="text-xs font-bold tabular-nums shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
                      >
                        {step.num}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{step.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick FAQ */}
              <div
                className="rounded-2xl border p-6"
                style={{ borderColor: 'rgba(53,94,59,0.18)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Common Questions
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    {
                      q: 'Is the consultation really free?',
                      a: 'Yes — initial consultations are complimentary. No credit card required.',
                    },
                    {
                      q: 'What should I bring?',
                      a: 'Any relevant documents, dates, or notes about your situation. The more context, the better.',
                    },
                    {
                      q: 'Can I reschedule?',
                      a: 'Absolutely. Use the link in your confirmation email to reschedule up to 24 hours before.',
                    },
                  ].map(({ q, a }) => (
                    <div key={q}>
                      <p className="text-sm font-semibold text-foreground leading-snug">{q}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{a}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prefer to call? */}
              <div
                className="rounded-2xl p-5 flex items-start gap-4"
                style={{ background: 'rgba(200,150,90,0.08)', border: '1px solid rgba(200,150,90,0.25)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#C8965A' }}>Prefer to reach out directly?</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Email{' '}
                    <a
                      href="mailto:broussardlegalservices@gmail.com"
                      className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                      style={{ color: '#C8965A' }}
                    >
                      broussardlegalservices@gmail.com
                    </a>{' '}
                    or visit the{' '}
                    <Link href="/contact" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#C8965A' }}>
                      contact page
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
