'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  status: string;
  start_time: string;
  created_at: string;
}

interface ConsultationBooking {
  id: string;
  status: string;
  booking_date: string;
  booking_time: string;
  booking_type: string;
  client_name: string;
  client_email: string;
  confirmation_sent: boolean;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  customer_name: string;
  created_at: string;
}

interface EmailSeq {
  id: string;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  sequence_type: string;
  scheduled_at: string;
  sent_at: string | null;
}

interface Reminder {
  id: string;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  scheduled_at: string;
  sent_at: string | null;
}

interface ProspectEmail {
  id: string;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  scheduled_at: string;
  sent_at: string | null;
}

interface IntakeNurture {
  id: string;
  send_status: 'pending' | 'sent' | 'failed' | 'skipped';
  scheduled_at: string;
  sent_at: string | null;
}

interface DailyPoint {
  date: string;
  bookings: number;
  portalBookings: number;
  revenue: number;
}

interface ChannelBreakdown {
  channel: string;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  total: number;
  rate: number;
}

// ─── Constants (used in component) ───────────────────────────────────────────

const BOOKING_TYPES_LIST = [
  { key: 'initial_consultation', label: 'Initial Consultation' },
  { key: 'case_checkin', label: 'Case Check-In' },
  { key: 'follow_up', label: 'Follow-Up Meeting' },
  { key: 'document_review', label: 'Document Review' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT = '#355E3B';
const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba'];

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabelFromDate(dateStr: string) {
  // dateStr is YYYY-MM-DD
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent = false, warn = false,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent?: boolean; warn?: boolean;
}) {
  const bg = accent ? 'bg-emerald-50 border-emerald-200' : warn ? 'bg-amber-50 border-amber-200' : 'bg-card border-border';
  const iconBg = accent ? 'bg-emerald-100 text-emerald-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary';
  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-3 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      <p className="text-3xl font-semibold text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Email Channel Row ────────────────────────────────────────────────────────

function ChannelRow({ ch }: { ch: ChannelBreakdown }) {
  const rateColor = ch.rate >= 80 ? 'text-emerald-600' : ch.rate >= 50 ? 'text-amber-600' : 'text-red-500';
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="w-36 flex-shrink-0">
        <p className="text-sm font-medium text-foreground">{ch.channel}</p>
        <p className="text-xs text-muted-foreground">{ch.total} total</p>
      </div>
      <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden flex">
        {ch.total > 0 && (
          <>
            <div className="h-full bg-emerald-500" style={{ width: `${(ch.sent / ch.total) * 100}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${(ch.pending / ch.total) * 100}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${(ch.failed / ch.total) * 100}%` }} />
          </>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-xs">
        <span className="text-emerald-600 font-medium w-10 text-right">{ch.sent} sent</span>
        {ch.failed > 0 && <span className="text-red-500 font-medium w-12 text-right">{ch.failed} failed</span>}
        <span className={`font-bold w-10 text-right ${rateColor}`}>{ch.rate}%</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminAnalyticsDashboard() {
  const supabase = createClient();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [consultationBookings, setConsultationBookings] = useState<ConsultationBooking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sequences, setSequences] = useState<EmailSeq[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [prospectEmails, setProspectEmails] = useState<ProspectEmail[]>([]);
  const [intakeNurture, setIntakeNurture] = useState<IntakeNurture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [range, setRange] = useState<7 | 14 | 30>(30);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - range);
      const sinceISO = since.toISOString();
      const sinceDateStr = sinceISO.split('T')[0];

      const [bRes, cbRes, pRes, sRes, rRes, prRes, inRes] = await Promise.all([
        supabase.from('calendly_bookings').select('id, status, start_time, created_at').gte('created_at', sinceISO).order('created_at', { ascending: true }),
        supabase.from('consultation_bookings').select('id, status, booking_date, booking_time, booking_type, client_name, client_email, confirmation_sent, created_at').gte('booking_date', sinceDateStr).order('booking_date', { ascending: true }),
        supabase.from('payments').select('id, amount, currency, payment_status, payment_type, customer_name, created_at').gte('created_at', sinceISO).order('created_at', { ascending: true }),
        supabase.from('email_sequences').select('id, send_status, sequence_type, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('payment_reminder_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('prospect_followup_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
        supabase.from('intake_nurture_sequences').select('id, send_status, scheduled_at, sent_at').gte('created_at', sinceISO),
      ]);

      setBookings((bRes.data as Booking[]) ?? []);
      setConsultationBookings((cbRes.data as ConsultationBooking[]) ?? []);
      setPayments((pRes.data as Payment[]) ?? []);
      setSequences((sRes.data as EmailSeq[]) ?? []);
      setReminders((rRes.data as Reminder[]) ?? []);
      setProspectEmails((prRes.data as ProspectEmail[]) ?? []);
      setIntakeNurture((inRes.data as IntakeNurture[]) ?? []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Derived Metrics ──────────────────────────────────────────────────────────

  const confirmedBookings = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed');
  const canceledBookings = bookings.filter((b) => b.status === 'canceled' || b.status === 'cancelled');
  const cancelRate = bookings.length > 0 ? Math.round((canceledBookings.length / bookings.length) * 100) : 0;

  // Portal consultation bookings metrics
  const confirmedPortalBookings = consultationBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const cancelledPortalBookings = consultationBookings.filter((b) => b.status === 'cancelled');
  const pendingPortalBookings = consultationBookings.filter((b) => b.status === 'pending');
  const confirmationsSent = consultationBookings.filter((b) => b.confirmation_sent).length;
  const portalCancelRate = consultationBookings.length > 0
    ? Math.round((cancelledPortalBookings.length / consultationBookings.length) * 100)
    : 0;

  // Booking type breakdown
  const bookingTypeBreakdown = BOOKING_TYPES_LIST.map((type) => ({
    type: type.label,
    count: consultationBookings.filter((b) => b.booking_type === type.key).length,
  })).filter((t) => t.count > 0);

  const totalAllBookings = bookings.length + consultationBookings.length;

  const collectedRevenue = payments
    .filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid')
    .reduce((s, p) => s + p.amount / 100, 0);
  const pendingRevenue = payments
    .filter((p) => p.payment_status === 'pending' || p.payment_status === 'processing')
    .reduce((s, p) => s + p.amount / 100, 0);
  const avgPayment = payments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length > 0
    ? collectedRevenue / payments.filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid').length
    : 0;

  const allEmails = [...sequences, ...reminders, ...prospectEmails, ...intakeNurture];
  const totalEmailSent = allEmails.filter((e) => e.send_status === 'sent').length;
  const totalEmailFailed = allEmails.filter((e) => e.send_status === 'failed').length;
  const overallDeliveryRate = allEmails.length > 0 ? Math.round((totalEmailSent / allEmails.length) * 100) : 0;

  // ── Daily trend (bookings + portal bookings + revenue) ───────────────────────

  const dailyData: DailyPoint[] = (() => {
    const map: Record<string, { bookings: number; portalBookings: number; revenue: number }> = {};
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[dayLabel(d.toISOString())] = { bookings: 0, portalBookings: 0, revenue: 0 };
    }
    bookings.forEach((b) => {
      const k = dayLabel(b.created_at);
      if (map[k]) map[k].bookings += 1;
    });
    consultationBookings.forEach((b) => {
      const k = dayLabelFromDate(b.booking_date);
      if (map[k]) map[k].portalBookings += 1;
    });
    payments
      .filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid')
      .forEach((p) => {
        const k = dayLabel(p.created_at);
        if (map[k]) map[k].revenue += p.amount / 100;
      });
    return Object.entries(map).map(([date, v]) => ({ date, ...v }));
  })();

  // ── Email channel breakdown ──────────────────────────────────────────────────

  const channels: ChannelBreakdown[] = [
    {
      channel: 'Nurture Sequences',
      sent: sequences.filter((e) => e.send_status === 'sent').length,
      failed: sequences.filter((e) => e.send_status === 'failed').length,
      pending: sequences.filter((e) => e.send_status === 'pending').length,
      skipped: sequences.filter((e) => e.send_status === 'skipped').length,
      total: sequences.length,
      rate: sequences.length > 0 ? Math.round((sequences.filter((e) => e.send_status === 'sent').length / sequences.length) * 100) : 0,
    },
    {
      channel: 'Payment Reminders',
      sent: reminders.filter((e) => e.send_status === 'sent').length,
      failed: reminders.filter((e) => e.send_status === 'failed').length,
      pending: reminders.filter((e) => e.send_status === 'pending').length,
      skipped: reminders.filter((e) => e.send_status === 'skipped').length,
      total: reminders.length,
      rate: reminders.length > 0 ? Math.round((reminders.filter((e) => e.send_status === 'sent').length / reminders.length) * 100) : 0,
    },
    {
      channel: 'Prospect Follow-Ups',
      sent: prospectEmails.filter((e) => e.send_status === 'sent').length,
      failed: prospectEmails.filter((e) => e.send_status === 'failed').length,
      pending: prospectEmails.filter((e) => e.send_status === 'pending').length,
      skipped: prospectEmails.filter((e) => e.send_status === 'skipped').length,
      total: prospectEmails.length,
      rate: prospectEmails.length > 0 ? Math.round((prospectEmails.filter((e) => e.send_status === 'sent').length / prospectEmails.length) * 100) : 0,
    },
    {
      channel: 'Intake Nurture',
      sent: intakeNurture.filter((e) => e.send_status === 'sent').length,
      failed: intakeNurture.filter((e) => e.send_status === 'failed').length,
      pending: intakeNurture.filter((e) => e.send_status === 'pending').length,
      skipped: intakeNurture.filter((e) => e.send_status === 'skipped').length,
      total: intakeNurture.length,
      rate: intakeNurture.length > 0 ? Math.round((intakeNurture.filter((e) => e.send_status === 'sent').length / intakeNurture.length) * 100) : 0,
    },
  ].filter((ch) => ch.total > 0);

  // ── Revenue by payment type ──────────────────────────────────────────────────

  const revenueByType: { type: string; amount: number }[] = (() => {
    const map: Record<string, number> = {};
    payments
      .filter((p) => p.payment_status === 'succeeded' || p.payment_status === 'paid')
      .forEach((p) => {
        const t = p.payment_type || 'other';
        map[t] = (map[t] ?? 0) + p.amount / 100;
      });
    return Object.entries(map).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount);
  })();

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <div className="w-20 h-3 bg-muted/40 rounded animate-pulse mb-4" />
              <div className="w-16 h-8 bg-muted/60 rounded animate-pulse mb-2" />
              <div className="w-24 h-3 bg-muted/40 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="w-40 h-5 bg-muted/60 rounded animate-pulse mb-5" />
          <div className="w-full h-52 bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {lastRefreshed
            ? `Updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : 'Live data'}
        </div>
        <div className="flex items-center gap-2">
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                range === r ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-accent/50'
              }`}
            >
              {r}d
            </button>
          ))}
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:border-accent/50 hover:text-foreground transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Total Bookings (${range}d)`}
          value={totalAllBookings.toString()}
          sub={`${bookings.length} Calendly · ${consultationBookings.length} portal`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          label={`Revenue (${range}d)`}
          value={fmt(collectedRevenue)}
          sub={pendingRevenue > 0 ? `${fmt(pendingRevenue)} pending` : avgPayment > 0 ? `Avg ${fmt(avgPayment)} / payment` : 'No payments yet'}
          accent={collectedRevenue > 0}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <StatCard
          label="Email Delivery"
          value={`${overallDeliveryRate}%`}
          sub={`${totalEmailSent} sent · ${totalEmailFailed} failed`}
          accent={overallDeliveryRate >= 80}
          warn={overallDeliveryRate < 80 && overallDeliveryRate >= 50}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          }
        />
        <StatCard
          label="Portal Bookings"
          value={consultationBookings.length.toString()}
          sub={`${confirmationsSent} emails sent · ${portalCancelRate}% cancel`}
          accent={consultationBookings.length > 0}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </div>

      {/* ── Portal Booking Metrics ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-serif text-lg text-foreground mb-1">Portal Consultation Bookings</h3>
            <p className="text-xs text-muted-foreground">Direct bookings from the client portal — last {range} days</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: consultationBookings.length, color: 'text-foreground', bg: 'bg-secondary/30 border-border' },
            { label: 'Confirmed', value: confirmedPortalBookings.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Pending', value: pendingPortalBookings.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Cancelled', value: cancelledPortalBookings.length, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
          ].map((item) => (
            <div key={item.label} className={`border rounded-2xl p-4 text-center ${item.bg}`}>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Booking type breakdown */}
        {bookingTypeBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">By Appointment Type</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={bookingTypeBreakdown} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Bookings" fill={ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Confirmation email rate */}
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Confirmation Emails Sent</p>
              <p className="text-xs text-muted-foreground">{confirmationsSent} of {consultationBookings.length} bookings</p>
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#355E3B' }}>
            {consultationBookings.length > 0 ? Math.round((confirmationsSent / consultationBookings.length) * 100) : 0}%
          </p>
        </div>

        {/* Recent portal bookings table */}
        {consultationBookings.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Recent Portal Bookings</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client</th>
                    <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                    <th className="text-center px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {[...consultationBookings].reverse().slice(0, 8).map((b, i) => {
                    const statusColor =
                      b.status === 'confirmed' || b.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : b.status === 'pending'? 'bg-amber-100 text-amber-700 border-amber-200' :'bg-red-100 text-red-600 border-red-200';
                    const typeLabel = BOOKING_TYPES_LIST.find((t) => t.key === b.booking_type)?.label ?? b.booking_type;
                    return (
                      <tr key={b.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{b.client_name}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{typeLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusColor}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {b.confirmation_sent ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Daily Trend: Bookings & Revenue ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-serif text-lg text-foreground mb-1">Bookings & Revenue Trend</h3>
            <p className="text-xs text-muted-foreground">Calendly bookings, portal bookings, and collected revenue — last {range} days</p>
          </div>
        </div>
        {dailyData.every((d) => d.bookings === 0 && d.portalBookings === 0 && d.revenue === 0) ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No bookings or payments in this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBookings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPortal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval={range === 7 ? 0 : range === 14 ? 1 : 4}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                formatter={(value: number, name: string) =>
                  name === 'Revenue' ? [fmt(value), name] : [value, name]
                }
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
              <Area yAxisId="left" type="monotone" dataKey="bookings" name="Calendly" stroke={ACCENT} strokeWidth={2} fill="url(#gradBookings)" dot={false} />
              <Area yAxisId="left" type="monotone" dataKey="portalBookings" name="Portal" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#gradPortal)" dot={false} />
              <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[2]} strokeWidth={2} fill="url(#gradRevenue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Revenue by Type + Email Delivery Rate ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by payment type */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Revenue by Type</h3>
          <p className="text-xs text-muted-foreground mb-5">Collected payments broken down by category</p>
          {revenueByType.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No payments collected in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByType} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => [fmt(v), 'Revenue']} />
                <Bar dataKey="amount" name="Revenue" fill={ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total collected</span>
            <span className="text-sm font-bold text-foreground">{fmt(collectedRevenue)}</span>
          </div>
        </div>

        {/* Email delivery rate by channel */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-serif text-lg text-foreground mb-1">Email Delivery by Channel</h3>
          <p className="text-xs text-muted-foreground mb-5">Sent, pending, and failed per email type</p>
          {channels.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No emails scheduled in this period.</div>
          ) : (
            <div className="divide-y divide-border">
              {channels.map((ch) => (
                <ChannelRow key={ch.channel} ch={ch} />
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Overall delivery rate</span>
            <span className={`text-sm font-bold ${overallDeliveryRate >= 80 ? 'text-emerald-600' : overallDeliveryRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {overallDeliveryRate}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Booking Status Breakdown (Calendly) ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-serif text-lg text-foreground mb-1">Calendly Booking Status</h3>
        <p className="text-xs text-muted-foreground mb-5">Confirmed vs. canceled — last {range} days</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: bookings.length, color: 'text-foreground', bg: 'bg-secondary/30 border-border' },
            { label: 'Confirmed', value: confirmedBookings.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Canceled', value: canceledBookings.length, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
            { label: 'Cancel Rate', value: `${cancelRate}%`, color: cancelRate > 20 ? 'text-red-500' : 'text-foreground', bg: 'bg-secondary/30 border-border' },
          ].map((item) => (
            <div key={item.label} className={`border rounded-2xl p-4 text-center ${item.bg}`}>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        {bookings.length > 0 && (
          <div className="mt-5">
            <div className="h-3 rounded-full bg-secondary/40 overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(confirmedBookings.length / bookings.length) * 100}%` }} />
              <div className="h-full bg-red-400 transition-all duration-700" style={{ width: `${(canceledBookings.length / bookings.length) * 100}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">Confirmed</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-xs text-muted-foreground">Canceled</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent Payments Table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg text-foreground">Recent Payments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last {range} days — most recent first</p>
          </div>
          <span className="text-xs text-muted-foreground">{payments.length} total</span>
        </div>
        {payments.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">No payments in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-border bg-secondary/30">
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Customer</th>
                  <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Amount</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">Type</th>
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                  <th className="text-right px-6 py-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {[...payments].reverse().slice(0, 10).map((p, i) => {
                  const statusColor =
                    p.payment_status === 'succeeded' || p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : p.payment_status === 'pending'|| p.payment_status === 'processing' ? 'bg-amber-100 text-amber-700 border-amber-200' :'bg-red-100 text-red-600 border-red-200';
                  return (
                    <tr key={p.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-6 py-3.5 font-medium text-foreground">{p.customer_name || '—'}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-foreground">{fmt(p.amount / 100)}</td>
                      <td className="px-6 py-3.5 text-muted-foreground capitalize hidden sm:table-cell">{p.payment_type || '—'}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusColor}`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground text-right hidden md:table-cell">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
