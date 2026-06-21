'use client';

import React, { useState } from 'react';

interface BookingReminderFormData {
  name: string;
  email: string;
  phone: string;
  bookingDate: string;
  bookingTime: string;
  meetingLink: string;
}

const initialForm: BookingReminderFormData = {
  name: '',
  email: '',
  phone: '',
  bookingDate: '',
  bookingTime: '',
  meetingLink: '',
};

export default function BookingReminderSection() {
  const [form, setForm] = useState<BookingReminderFormData>(initialForm);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.bookingDate || !form.bookingTime) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: form.phone,
          name: form.name,
          email: form.email,
          bookingDate: form.bookingDate,
          bookingTime: form.bookingTime,
          meetingLink: form.meetingLink || 'https://broussardlegalservices.com/book-consultation',
          reminderType: 'booking_confirmation',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'Failed to send reminder');
      }

      setStatus('success');
      setForm(initialForm);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <section className="py-14 bg-background border-t border-border">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent mb-3">
            <span className="w-5 h-px bg-accent" />
            SMS Reminder
            <span className="w-5 h-px bg-accent" />
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Get a Booking Reminder
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Enter your consultation details and we&apos;ll send you an SMS reminder 24 hours before
            your session — including your Google Meet link.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {[
            { icon: '📱', label: 'SMS + Email reminder' },
            { icon: '🔗', label: 'Google Meet link included' },
            { icon: '⏰', label: '24 hours before your call' },
          ].map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20"
            >
              <span>{item.icon}</span>
              {item.label}
            </span>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Reminder Scheduled!</h3>
              <p className="text-sm text-muted-foreground mb-5">
                You&apos;ll receive an SMS reminder 24 hours before your consultation with your
                date, time, and Google Meet link.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-sm font-medium text-accent hover:underline"
              >
                Schedule another reminder
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reminder-name" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reminder-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reminder-phone" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reminder-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reminder-email" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="reminder-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="jane@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                  required
                />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reminder-date" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Consultation Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reminder-date"
                    name="bookingDate"
                    type="date"
                    value={form.bookingDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reminder-time" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Consultation Time (CST) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reminder-time"
                    name="bookingTime"
                    type="time"
                    value={form.bookingTime}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                    required
                  />
                </div>
              </div>

              {/* Google Meet Link (optional) */}
              <div>
                <label htmlFor="reminder-meet" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Google Meet Link <span className="text-muted-foreground font-normal normal-case">(optional — from your confirmation email)</span>
                </label>
                <input
                  id="reminder-meet"
                  name="meetingLink"
                  type="url"
                  value={form.meetingLink}
                  onChange={handleChange}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition"
                />
              </div>

              {/* Error */}
              {(status === 'error' || errorMsg) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {errorMsg || 'Something went wrong. Please try again.'}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#4A3728', color: '#fff' }}
              >
                {status === 'loading' ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Scheduling Reminder…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
                    </svg>
                    Send Me a Reminder
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                By submitting, you agree to receive a one-time SMS reminder. Reply STOP to opt out.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
